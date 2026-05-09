import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ok } from "../lib/envelope.js";
import { AppError } from "../lib/errors.js";
import { iso } from "../lib/serialize.js";
import { parseWith, revokeAgentBodySchema } from "../lib/schemas.js";
import { assertAgentOwner } from "../middleware/access.js";
import { getDescendants, publishAgentRevoked } from "../services/agentLifecycle.js";
import { verifyRevocationTx } from "../services/anchor.js";
import { resolveNameToWallet } from "../services/sns.js";

const paramsSchema = z.object({ id: z.string().min(1) });

export async function registerAgentRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  app.get("/:id", async (request, reply) => {
    const params = parseWith(paramsSchema, request.params);
    await assertAgentOwner(app, params.id, request.authUser.id);

    const agent = await app.services.prisma.agent.findUnique({
      where: { id: params.id },
      include: {
        parentAgent: {
          select: {
            id: true,
            solSubName: true
          }
        },
        children: {
          select: {
            id: true
          }
        },
        sentMessages: {
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 12,
          select: {
            id: true,
            action: true,
            txHash: true,
            verified: true,
            createdAt: true
          }
        }
      }
    });

    if (!agent) {
      throw new AppError("NOT_FOUND", "Agent not found");
    }

    const lastActionAt = agent.sentMessages[0]?.createdAt ?? null;
    let walletAddr: string | null = null;
    try {
      walletAddr = await resolveNameToWallet(agent.solSubName);
    } catch {
      walletAddr = null;
    }

    return reply.send(
      ok({
        id: agent.id,
        jobId: agent.jobId,
        label: agent.solSubName,
        solSubName: agent.solSubName,
        type: agent.type,
        status: agent.status,
        parentAgentId: agent.parentAgentId,
        parentSolSubName: agent.parentAgent?.solSubName ?? null,
        actionCount: agent.actionCount,
        createdAt: iso(agent.createdAt),
        walletAddr,
        spawnTxHash: agent.spawnTxHash,
        revokedAt: agent.revokedAt ? iso(agent.revokedAt) : null,
        revokeTxHash: agent.revokeTxHash ?? null,
        lastActionAt: lastActionAt ? iso(lastActionAt) : null,
        childCount: agent.children.length,
        actions: agent.sentMessages.map((message) => ({
          id: message.id,
          createdAt: iso(message.createdAt),
          description: message.action,
          verified: message.verified,
          txHash: message.txHash
        }))
      })
    );
  });

  app.post("/:id/revoke", async (request, reply) => {
    const params = parseWith(paramsSchema, request.params);
    const body = parseWith(revokeAgentBodySchema, request.body);
    const agent = await app.services.prisma.agent.findUnique({
      where: { id: params.id },
      include: {
        job: {
          include: {
            owner: {
              select: {
                id: true,
                walletAddr: true
              }
            }
          }
        }
      }
    });

    if (!agent) {
      throw new AppError("NOT_FOUND", "Agent not found");
    }

    if (agent.job.owner.walletAddr !== request.authUser.walletAddr) {
      return reply.status(403).send({ error: "FORBIDDEN" });
    }

    if (agent.status !== "ACTIVE") {
      return reply.status(409).send({ error: "AGENT_ALREADY_REVOKED" });
    }

    const agentWallet = await resolveNameToWallet(agent.solSubName);
    const onchainMatch = await verifyRevocationTx(body.revokeTxHash, agentWallet);
    if (!onchainMatch) {
      return reply.status(422).send({ error: "ONCHAIN_MISMATCH" });
    }

    const revokedAt = new Date();
    const descendantIds = await app.services.prisma.$transaction(async (tx) => {
      const descendants = await getDescendants(tx, agent.id);
      await tx.agent.update({
        where: { id: agent.id },
        data: {
          status: "REVOKED",
          revokedAt,
          revokeTxHash: body.revokeTxHash
        }
      });
      if (descendants.length > 0) {
        await tx.agent.updateMany({
          where: { id: { in: descendants } },
          data: {
            status: "REVOKED",
            revokedAt
          }
        });
      }

      return descendants;
    });

    await publishAgentRevoked(agent.jobId, agent.id, descendantIds);
    return reply.send(ok({ revokedId: agent.id, cascadeCount: descendantIds.length }));
  });
}
