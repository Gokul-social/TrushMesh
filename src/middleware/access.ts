import type { FastifyInstance } from "fastify";
import { AppError } from "../lib/errors.js";

export async function assertJobOwner(app: FastifyInstance, jobId: string, ownerId: string) {
  const job = await app.services.prisma.job.findFirst({
    where: { id: jobId, ownerId },
    select: { id: true, onchainId: true, ownerId: true, status: true }
  });

  if (!job) {
    throw new AppError("NOT_FOUND", "Job not found");
  }

  return job;
}

export async function assertAgentOwner(app: FastifyInstance, agentId: string, ownerId: string) {
  const agent = await app.services.prisma.agent.findFirst({
    where: { id: agentId, ownerId },
    select: {
      id: true,
      jobId: true,
      ownerId: true,
      solSubName: true,
      status: true,
      parentAgentId: true
    }
  });

  if (!agent) {
    throw new AppError("NOT_FOUND", "Agent not found");
  }

  return agent;
}
