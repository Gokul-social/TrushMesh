import type { PrismaClient } from "@prisma/client";
import { iso } from "../lib/serialize.js";

export type GraphNode = {
  id: string;
  jobId: string;
  label: string;
  solSubName: string;
  type: string;
  status: string;
  parentAgentId: string | null;
  actionCount: number;
  createdAt: string;
};

export type DelegationEdge = {
  id: string;
  source: string;
  target: string;
  type: "DELEGATION";
};

export type GraphSnapshot = {
  nodes: GraphNode[];
  edges: DelegationEdge[];
};

export async function buildGraphSnapshot(
  prisma: PrismaClient,
  jobId: string,
  ownerId?: string
): Promise<GraphSnapshot> {
  const agents = await prisma.agent.findMany({
    where: ownerId ? { jobId, job: { ownerId } } : { jobId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
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

  return {
    nodes: agents.map((agent) => ({
      id: agent.id,
      jobId: agent.jobId,
      label: agent.solSubName,
      solSubName: agent.solSubName,
      type: agent.type,
      status: agent.status,
      parentAgentId: agent.parentAgentId,
      actionCount: agent.actionCount,
      createdAt: iso(agent.createdAt)
    })),
    edges: agents
      .filter((agent) => agent.parentAgentId)
      .map((agent) => ({
        id: `${agent.parentAgentId}->${agent.id}`,
        source: agent.parentAgentId!,
        target: agent.id,
        type: "DELEGATION"
      }))
  };
}
