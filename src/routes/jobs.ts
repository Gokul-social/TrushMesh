import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ok } from "../lib/envelope.js";
import { AppError } from "../lib/errors.js";
import { decimal, iso } from "../lib/serialize.js";
import {
  activateJobBodySchema,
  createJobBodySchema,
  jobStatusSchema,
  parseWith,
  subNameSchema,
  updateJobStatusBodySchema
} from "../lib/schemas.js";
import { assertJobOwner } from "../middleware/access.js";
import { scheduleAgentSync, cancelAgentSync } from "../queues/agentSync.js";
import { deriveJobPda, verifyJobInit } from "../services/anchor.js";
import { resolveNameToWallet, resolveWalletToName, validateSubName } from "../services/sns.js";
import { publishJobEvent } from "../websocket/broadcast.js";

const paramsSchema = z.object({ id: z.string().min(1) });

export async function registerJobRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  app.get("/", async (request, reply) => {
    const query = parseWith(
      z.object({
        status: jobStatusSchema.optional()
      }),
      request.query
    );

    const jobs = await app.services.prisma.job.findMany({
      where: {
        ownerId: request.authUser.id,
        ...(query.status ? { status: query.status } : {})
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      include: {
        owner: {
          select: {
            solName: true
          }
        },
        agents: {
          select: {
            status: true
          }
        }
      }
    });

    return reply.send(
      ok(
        jobs.map((job) => ({
          id: job.id,
          onchainId: job.onchainId,
          ownerId: job.ownerId,
          ownerSolName: job.owner.solName,
          description: job.description,
          template: job.template,
          budgetSol: decimal(job.budgetSol),
          status: job.status,
          createdAt: iso(job.createdAt),
          updatedAt: iso(job.updatedAt),
          agentCount: job.agents.length,
          activeAgentCount: job.agents.filter((agent) => agent.status === "ACTIVE").length,
          breachCount: 0
        }))
      )
    );
  });

  app.get("/validate-sub-name", async (request, reply) => {
    const query = parseWith(
      z.object({
        subName: subNameSchema
      }),
      request.query
    );

    const ownerSolName = await resolveWalletToName(request.authUser.walletAddr);
    const valid = ownerSolName ? await validateSubName(query.subName, ownerSolName) : false;

    return reply.send(
      ok({
        valid,
        fullName: ownerSolName ? `${query.subName}.${ownerSolName}` : query.subName
      })
    );
  });

  app.get("/:id", async (request, reply) => {
    const params = parseWith(paramsSchema, request.params);
    await assertJobOwner(app, params.id, request.authUser.id);

    const job = await app.services.prisma.job.findUnique({
      where: { id: params.id },
      include: {
        owner: {
          select: {
            solName: true
          }
        },
        agents: {
          select: {
            status: true
          }
        }
      }
    });

    if (!job) {
      throw new AppError("NOT_FOUND", "Job not found");
    }

    return reply.send(
      ok({
        id: job.id,
        onchainId: job.onchainId,
        ownerId: job.ownerId,
        ownerSolName: job.owner.solName,
        description: job.description,
        template: job.template,
        budgetSol: decimal(job.budgetSol),
        status: job.status,
        createdAt: iso(job.createdAt),
        updatedAt: iso(job.updatedAt),
        agentCount: job.agents.length,
        activeAgentCount: job.agents.filter((agent) => agent.status === "ACTIVE").length,
        breachCount: 0
      })
    );
  });

  app.post("/", async (request, reply) => {
    const body = parseWith(createJobBodySchema, request.body);
    const ownerWallet = request.authUser.walletAddr;
    const ownerSolName = await resolveWalletToName(ownerWallet);

    if (!ownerSolName || !(await validateSubName(body.plannerSubName, ownerSolName))) {
      return reply.status(400).send({ error: "INVALID_SUB_NAME", field: "plannerSubName" });
    }

    for (const executorSubName of body.executorSubNames) {
      if (!(await validateSubName(executorSubName, ownerSolName))) {
        return reply.status(400).send({ error: "INVALID_SUB_NAME", field: "executorSubNames" });
      }
    }

    if (!ownerSolName) {
      return reply.status(400).send({ error: "OWNER_SOL_NAME_REQUIRED" });
    }

    const job = await app.services.prisma.$transaction(async (tx) => {
      const createdJob = await tx.job.create({
        data: {
          onchainId: body.onchainId,
          ownerId: request.authUser.id,
          description: body.description,
          template: body.template,
          budgetSol: body.budgetSol,
          status: "PENDING"
        }
      });

      const planner = await tx.agent.create({
        data: {
          jobId: createdJob.id,
          ownerId: request.authUser.id,
          solSubName: `${body.plannerSubName}.${ownerSolName}`,
          type: "PLANNER",
          spawnTxHash: `pending-${createdJob.onchainId}-planner`
        }
      });

      if (body.executorSubNames.length > 0) {
        await tx.agent.createMany({
          data: body.executorSubNames.map((executorSubName, index) => ({
            jobId: createdJob.id,
            ownerId: request.authUser.id,
            solSubName: `${executorSubName}.${ownerSolName}`,
            type: "EXECUTOR",
            parentAgentId: planner.id,
            spawnTxHash: `pending-${createdJob.onchainId}-executor-${index + 1}`
          }))
        });
      }

      return createdJob;
    });

    return reply.status(201).send(
      ok({
        ...job,
        budgetSol: decimal(job.budgetSol),
        createdAt: iso(job.createdAt),
        updatedAt: iso(job.updatedAt)
      })
    );
  });

  app.patch("/:id/activate", async (request, reply) => {
    const params = parseWith(paramsSchema, request.params);
    const body = parseWith(activateJobBodySchema, request.body);
    const job = await app.services.prisma.job.findUnique({
      where: { id: params.id },
      include: {
        agents: {
          select: {
            id: true,
            solSubName: true
          }
        }
      }
    });

    if (!job) {
      throw new AppError("NOT_FOUND", "Job not found");
    }

    if (job.ownerId !== request.authUser.id) {
      return reply.status(403).send({ error: "FORBIDDEN" });
    }

    if (job.status !== "PENDING") {
      return reply.status(409).send({ error: "JOB_ALREADY_ACTIVE" });
    }

    const onchainMatch = await verifyJobInit(body.initTxHash, job.onchainId);
    if (!onchainMatch) {
      return reply.status(422).send({ error: "ONCHAIN_MISMATCH", txHash: body.initTxHash });
    }

    const updatedJob = await app.services.prisma.job.update({
      where: { id: job.id },
      data: { status: "ACTIVE" }
    });

    const jobPubkey = deriveJobPda(request.authUser.walletAddr, job.onchainId).toBase58();
    const agentWallets = (
      await Promise.all(
        job.agents.map(async (agent) => {
          try {
            const wallet = await resolveNameToWallet(agent.solSubName);
            return {
              agentId: agent.id,
              wallet,
              jobPubkey
            };
          } catch {
            return null;
          }
        })
      )
    ).filter((entry): entry is { agentId: string; wallet: string; jobPubkey: string } => entry !== null);

    await scheduleAgentSync(job.id, agentWallets);
    return reply.send(
      ok({
        ...updatedJob,
        budgetSol: decimal(updatedJob.budgetSol),
        createdAt: iso(updatedJob.createdAt),
        updatedAt: iso(updatedJob.updatedAt)
      })
    );
  });

  app.patch("/:id/status", async (request, reply) => {
    const params = parseWith(paramsSchema, request.params);
    const body = parseWith(updateJobStatusBodySchema, request.body);
    const job = await app.services.prisma.job.findUnique({
      where: { id: params.id },
      select: { id: true, ownerId: true, status: true }
    });

    if (!job) {
      throw new AppError("NOT_FOUND", "Job not found");
    }

    if (job.ownerId !== request.authUser.id) {
      return reply.status(403).send({ error: "FORBIDDEN" });
    }

    const updatedJob = await app.services.prisma.job.update({
      where: { id: params.id },
      data: { status: body.status }
    });

    if (body.status === "COMPLETE" || body.status === "REVOKED") {
      await cancelAgentSync(job.id);
    }

    if (body.status === "COMPLETE") {
      await publishJobEvent(job.id, { type: "JOB_COMPLETE", jobId: job.id });
    }

    return reply.send(
      ok({
        ...updatedJob,
        budgetSol: decimal(updatedJob.budgetSol),
        createdAt: iso(updatedJob.createdAt),
        updatedAt: iso(updatedJob.updatedAt)
      })
    );
  });
}
