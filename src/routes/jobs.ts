import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { REDIS_KEYS } from "../lib/constants.js";
import { ok } from "../lib/envelope.js";
import { AppError } from "../lib/errors.js";
import {
  agentTypeSchema,
  jobStatusSchema,
  jobTemplateSchema,
  paginationQuerySchema,
  parseWith,
  solNameSchema,
  walletAddressSchema
} from "../lib/schemas.js";
import { decimal, iso } from "../lib/serialize.js";
import { assertJobOwner } from "../middleware/access.js";
import { buildGraphSnapshot } from "../services/graph.js";
import { publishJobEvent } from "../websocket/broadcast.js";

const listJobsQuerySchema = paginationQuerySchema.extend({
  status: jobStatusSchema.optional(),
  ownerWallet: walletAddressSchema.optional()
});

const createJobBodySchema = z.object({
  onchainId: z.string().min(3),
  deployTxHash: z.string().min(8).optional(),
  description: z.string().trim().min(3).max(1000),
  template: jobTemplateSchema,
  budgetSol: z.union([z.string(), z.number()]).transform(String).refine((value) => Number(value) > 0, {
    message: "Budget must be greater than zero"
  }),
  agents: z
    .array(
      z.object({
        solSubName: solNameSchema,
        type: agentTypeSchema,
        parentSolSubName: solNameSchema.optional(),
        spawnTxHash: z.string().min(8)
      })
    )
    .min(1)
});

const updateStatusBodySchema = z.object({
  status: jobStatusSchema,
  txHash: z.string().min(8)
});

export async function registerJobRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  app.get("/", async (request, reply) => {
    const query = parseWith(listJobsQuerySchema, request.query);
    const limit = query.limit ?? 25;
    if (query.ownerWallet && query.ownerWallet !== request.authUser.walletAddr) {
      throw new AppError("FORBIDDEN", "Cannot list jobs for another wallet");
    }

    const jobs = await app.services.prisma.job.findMany({
      where: {
        ownerId: request.authUser.id,
        ...(query.status ? { status: query.status } : {})
      },
      take: limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        onchainId: true,
        description: true,
        template: true,
        budgetSol: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        owner: { select: { walletAddr: true, solName: true } },
        _count: { select: { agents: true, messages: true } }
      }
    });

    const hasNextPage = jobs.length > limit;
    const page = hasNextPage ? jobs.slice(0, -1) : jobs;
    return reply.send(
      ok(page.map(mapJobSummary), {
        nextCursor: hasNextPage ? page[page.length - 1]?.id : null
      })
    );
  });

  app.get("/:id", async (request, reply) => {
    const params = parseWith(z.object({ id: z.string().min(1) }), request.params);
    await assertJobOwner(app, params.id, request.authUser.id);

    const job = await app.services.prisma.job.findFirst({
      where: { id: params.id, ownerId: request.authUser.id },
      select: {
        id: true,
        onchainId: true,
        description: true,
        template: true,
        budgetSol: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        agents: {
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          select: {
            id: true,
            solSubName: true,
            type: true,
            status: true,
            parentAgentId: true,
            actionCount: true,
            createdAt: true
          }
        },
        _count: { select: { messages: true, agents: true } }
      }
    });

    if (!job) {
      throw new AppError("NOT_FOUND", "Job not found");
    }

    return reply.send(
      ok({
        ...mapJobSummary(job),
        agents: job.agents.map((agent) => ({
          ...agent,
          createdAt: iso(agent.createdAt)
        })),
        agentTree: buildAgentTree(job.agents),
        messageCount: job._count.messages
      })
    );
  });

  app.post("/", async (request, reply) => {
    const body = parseWith(createJobBodySchema, request.body);
    validateAgentDefinitions(body.agents);

    const txHash = body.deployTxHash ?? body.onchainId;
    const verified = await app.services.anchor.verifyDelegationLog(txHash, {
      jobOnchainId: body.onchainId,
      agentSolNames: body.agents.map((agent) => agent.solSubName)
    });

    if (!verified) {
      throw new AppError("ONCHAIN_MISMATCH", "Onchain delegation log did not match request", {
        expected: { jobOnchainId: body.onchainId, agentSolNames: body.agents.map((agent) => agent.solSubName) },
        actual: { txHash }
      });
    }

    const created = await app.services.prisma.$transaction(async (tx) => {
      const job = await tx.job.create({
        data: {
          onchainId: body.onchainId,
          ownerId: request.authUser.id,
          description: body.description,
          template: body.template,
          budgetSol: body.budgetSol
        },
        select: {
          id: true,
          onchainId: true,
          description: true,
          template: true,
          budgetSol: true,
          status: true,
          createdAt: true,
          updatedAt: true
        }
      });

      const agentIds = new Map<string, string>();
      const createdAgents = [];
      for (const agent of body.agents) {
        const parentAgentId = agent.parentSolSubName ? agentIds.get(agent.parentSolSubName) : null;
        if (agent.parentSolSubName && !parentAgentId) {
          throw new AppError("VALIDATION_ERROR", `Parent ${agent.parentSolSubName} must be declared before child`);
        }

        const createdAgent = await tx.agent.create({
          data: {
            jobId: job.id,
            ownerId: request.authUser.id,
            solSubName: agent.solSubName,
            type: agent.type,
            parentAgentId,
            spawnTxHash: agent.spawnTxHash
          },
          select: {
            id: true,
            jobId: true,
            solSubName: true,
            type: true,
            status: true,
            parentAgentId: true,
            actionCount: true,
            createdAt: true
          }
        });
        agentIds.set(agent.solSubName, createdAgent.id);
        createdAgents.push(createdAgent);
      }

      return { job, agents: createdAgents };
    });

    await app.services.redis.del(REDIS_KEYS.statsGlobal);
    for (const agent of created.agents) {
      await publishJobEvent(app.services, created.job.id, {
        type: "AGENT_SPAWNED",
        agent: { ...agent, createdAt: iso(agent.createdAt) }
      });
    }

    return reply.status(201).send(
      ok({
        ...mapJobSummary({ ...created.job, _count: { agents: created.agents.length, messages: 0 } }),
        agents: created.agents.map((agent) => ({ ...agent, createdAt: iso(agent.createdAt) }))
      })
    );
  });

  app.patch("/:id/status", async (request, reply) => {
    const params = parseWith(z.object({ id: z.string().min(1) }), request.params);
    const body = parseWith(updateStatusBodySchema, request.body);
    const job = await assertJobOwner(app, params.id, request.authUser.id);
    const verified = await app.services.anchor.verifyDelegationLog(body.txHash, {
      jobOnchainId: job.onchainId
    });

    if (!verified) {
      throw new AppError("ONCHAIN_MISMATCH", "Onchain job status update did not match", {
        expected: { jobOnchainId: job.onchainId, status: body.status },
        actual: { txHash: body.txHash }
      });
    }

    const updated = await app.services.prisma.job.update({
      where: { id: params.id },
      data: { status: body.status },
      select: {
        id: true,
        onchainId: true,
        description: true,
        template: true,
        budgetSol: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { agents: true, messages: true } }
      }
    });

    await app.services.redis.del(REDIS_KEYS.statsGlobal);
    if (updated.status === "COMPLETE") {
      await publishJobEvent(app.services, updated.id, { type: "JOB_COMPLETE", jobId: updated.id });
    }

    return reply.send(ok(mapJobSummary(updated)));
  });

  app.get("/:id/snapshot", async (request, reply) => {
    const params = parseWith(z.object({ id: z.string().min(1) }), request.params);
    await assertJobOwner(app, params.id, request.authUser.id);
    return reply.send(ok(await buildGraphSnapshot(app.services.prisma, params.id, request.authUser.id)));
  });
}

function mapJobSummary(job: {
  id: string;
  onchainId: string;
  description: string;
  template: string;
  budgetSol: { toString(): string };
  status: string;
  createdAt: Date;
  updatedAt: Date;
  owner?: { walletAddr: string; solName: string | null };
  _count?: { agents: number; messages: number };
}) {
  return {
    id: job.id,
    onchainId: job.onchainId,
    description: job.description,
    template: job.template,
    budgetSol: decimal(job.budgetSol),
    status: job.status,
    createdAt: iso(job.createdAt),
    updatedAt: iso(job.updatedAt),
    owner: job.owner,
    counts: job._count
  };
}

function validateAgentDefinitions(agents: Array<{ solSubName: string; parentSolSubName?: string }>) {
  const names = new Set<string>();
  for (const agent of agents) {
    if (names.has(agent.solSubName)) {
      throw new AppError("VALIDATION_ERROR", `Duplicate agent sub-name: ${agent.solSubName}`);
    }
    names.add(agent.solSubName);
  }
}

function buildAgentTree(
  agents: Array<{
    id: string;
    solSubName: string;
    type: string;
    status: string;
    parentAgentId: string | null;
    actionCount: number;
    createdAt: Date;
  }>
) {
  const nodes = new Map<string, Record<string, unknown> & { children: unknown[] }>();
  for (const agent of agents) {
    nodes.set(agent.id, {
      id: agent.id,
      solSubName: agent.solSubName,
      type: agent.type,
      status: agent.status,
      actionCount: agent.actionCount,
      createdAt: iso(agent.createdAt),
      children: []
    });
  }

  const roots: unknown[] = [];
  for (const agent of agents) {
    const node = nodes.get(agent.id)!;
    const parent = agent.parentAgentId ? nodes.get(agent.parentAgentId) : null;
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}
