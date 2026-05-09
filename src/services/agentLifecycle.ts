import { jobChannel } from "../lib/constants.js";
import { redisPublisher } from "../lib/redis.js";

type AgentFinder = {
  agent: {
    findMany(args: {
      where: { parentAgentId: string };
      select: { id: true };
    }): Promise<Array<{ id: string }>>;
  };
};

export async function getDescendants(prisma: AgentFinder, agentId: string): Promise<string[]> {
  const children = await prisma.agent.findMany({
    where: { parentAgentId: agentId },
    select: { id: true }
  });

  const descendants: string[] = [];
  for (const child of children) {
    descendants.push(child.id);
    descendants.push(...(await getDescendants(prisma, child.id)));
  }

  return descendants;
}

export function mapOnchainAgentStatus(status: number) {
  switch (status) {
    case 0:
      return "ACTIVE" as const;
    case 1:
      return "WARNING" as const;
    case 2:
      return "REVOKED" as const;
    case 3:
      return "COMPLETE" as const;
    default:
      return "ACTIVE" as const;
  }
}

export async function publishAgentRevoked(jobId: string, agentId: string, cascade: string[]) {
  await redisPublisher.publish(
    jobChannel(jobId),
    JSON.stringify({ type: "AGENT_REVOKED", agentId, cascade })
  );
}
