import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { REDIS_KEYS } from "../lib/constants.js";
import { ok } from "../lib/envelope.js";
import { AppError } from "../lib/errors.js";
import {
  agentTypeSchema,
  paginationQuerySchema,
  parseWith,
  solNameSchema
} from "../lib/schemas.js";
import { iso } from "../lib/serialize.js";
import { assertAgentOwner, assertJobOwner } from "../middleware/access.js";
import { publishJobEvent } from "../websocket/broadcast.js";

const listAgentsQuerySchema = z.object({
  jobId: z.string().min(1)
});

const createAgentBodySchema = z.object({
  jobId: z.string().min(1),
  solSubName: solNameSchema,
  type: agentTypeSchema,
  parentAgentId: z.string().min(1).optional().nullable(),
  spawnTxHash: z.string().min(8)
});

const revokeBodySchema = z.object({
  txHash: z.string().min(8)
});

export async function registerAgentRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  app.get("/", async (request, reply) => {
    const query = parseWith(listAgentsQuerySchema, request.query);
    await assertJobOwner(app, query.jobId, request.authUser.id);

    const agents = await app.services.prisma.agent.findMany({
      where: { jobId: query.jobId, ownerId: request.authUser.id },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        jobId: true,
        solSubName: true,
        type: true,
        status: true,
        parentAgentId: true,
        spawnTxHash: true,
        revokedAt: true,
        revokeTxHash: true,
        actionCount: true,
        createdAt: true
      }
    });

    return reply.send(ok(agents.map(mapAgent)));
  });

  app.get("/:id", async (request, reply) => {
    const params = parseWith(z.object({ id: z.string().min(1) }), request.params);
    const query = parseWith(paginationQuerySchema, request.query);
    const limit = query.limit ?? 25;
    const agent = await assertAgentOwner(app, params.id, request.authUser.id);

    const messages = await app.services.prisma.agentMessage.findMany({
      where: {
        OR: [{ senderId: agent.id }, { receiverId: agent.id }]
      },
      take: limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        jobId: true,
        action: true,
        txHash: true,
        verified: true,
        createdAt: true,
        sender: { select: { id: true, solSubName: true, type: true } },
        receiver: { select: { id: true, solSubName: true, type: true } }
      }
    });

    const hasNextPage = messages.length > limit;
    const page = hasNextPage ? messages.slice(0, -1) : messages;

    return reply.send(
      ok(
        {
          agent,
          actionLog: page.map(mapMessageLite)
        },
        { nextCursor: hasNextPage ? page[page.length - 1]?.id : null }
      )
    );
  });

  app.post("/", async (request, reply) => {
    const body = parseWith(createAgentBodySchema, request.body);
    const job = await assertJobOwner(app, body.jobId, request.authUser.id);

    if (body.parentAgentId) {
      const parent = await app.services.prisma.agent.findFirst({
        where: { id: body.parentAgentId, jobId: body.jobId, ownerId: request.authUser.id },
        select: { id: true }
      });
      if (!parent) {
        throw new AppError("VALIDATION_ERROR", "Parent agent must belong to the same job");
      }
    }

    const verified = await app.services.anchor.verifyDelegationLog(body.spawnTxHash, {
      jobOnchainId: job.onchainId,
      agentSolNames: [body.solSubName]
    });

    if (!verified) {
      throw new AppError("ONCHAIN_MISMATCH", "Onchain agent spawn log did not match", {
        expected: { jobOnchainId: job.onchainId, agentSolNames: [body.solSubName] },
        actual: { txHash: body.spawnTxHash }
      });
    }

    const agent = await app.services.prisma.agent.create({
      data: {
        jobId: body.jobId,
        ownerId: request.authUser.id,
        solSubName: body.solSubName,
        type: body.type,
        parentAgentId: body.parentAgentId ?? null,
        spawnTxHash: body.spawnTxHash
      },
      select: {
        id: true,
        jobId: true,
        solSubName: true,
        type: true,
        status: true,
        parentAgentId: true,
        spawnTxHash: true,
        revokedAt: true,
        revokeTxHash: true,
        actionCount: true,
        createdAt: true
      }
    });

    await app.services.redis.del(REDIS_KEYS.statsGlobal);
    await publishJobEvent(app.services, agent.jobId, { type: "AGENT_SPAWNED", agent: mapAgent(agent) });

    return reply.status(201).send(ok(mapAgent(agent)));
  });

  app.post("/:id/revoke", async (request, reply) => {
    const params = parseWith(z.object({ id: z.string().min(1) }), request.params);
    const body = parseWith(revokeBodySchema, request.body);
    const agent = await assertAgentOwner(app, params.id, request.authUser.id);
    const verified = await app.services.anchor.verifyRevocationTx(body.txHash, agent.solSubName);

    if (!verified) {
      throw new AppError("ONCHAIN_MISMATCH", "Onchain revocation tx did not match agent", {
        expected: { agentSolName: agent.solSubName },
        actual: { txHash: body.txHash }
      });
    }

    const cascade = await collectAgentCascade(app, agent.id);
    const revokedAt = new Date();
    await app.services.prisma.agent.updateMany({
      where: { id: { in: cascade }, ownerId: request.authUser.id },
      data: {
        status: "REVOKED",
        revokedAt,
        revokeTxHash: body.txHash
      }
    });

    await app.services.redis.del(REDIS_KEYS.statsGlobal);
    await publishJobEvent(app.services, agent.jobId, {
      type: "AGENT_REVOKED",
      agentId: agent.id,
      cascade
    });

    return reply.send(ok({ agentId: agent.id, cascade, revokedAt: iso(revokedAt) }));
  });
}

async function collectAgentCascade(app: FastifyInstance, rootId: string) {
  const cascade = [rootId];
  let frontier = [rootId];

  while (frontier.length > 0) {
    const children = await app.services.prisma.agent.findMany({
      where: {
        parentAgentId: { in: frontier },
        status: { not: "REVOKED" }
      },
      select: { id: true }
    });
    frontier = children.map((child) => child.id);
    cascade.push(...frontier);
  }

  return cascade;
}

function mapAgent(agent: {
  id: string;
  jobId: string;
  solSubName: string;
  type: string;
  status: string;
  parentAgentId: string | null;
  spawnTxHash: string;
  revokedAt: Date | null;
  revokeTxHash: string | null;
  actionCount: number;
  createdAt: Date;
}) {
  return {
    ...agent,
    createdAt: iso(agent.createdAt),
    revokedAt: agent.revokedAt ? iso(agent.revokedAt) : null
  };
}

function mapMessageLite(message: {
  id: string;
  jobId: string;
  action: string;
  txHash: string;
  verified: boolean;
  createdAt: Date;
  sender: { id: string; solSubName: string; type: string };
  receiver: { id: string; solSubName: string; type: string } | null;
}) {
  return {
    ...message,
    createdAt: iso(message.createdAt)
  };
}
