import { Queue, Worker } from "bullmq";
import { PublicKey } from "@solana/web3.js";
import type { AppServices } from "../server.js";
import { AGENT_SYNC_QUEUE, jobChannel } from "../lib/constants.js";
import { createRedisConnection, redisPublisher } from "../lib/redis.js";
import { logger } from "../lib/logger.js";
import { getDescendants, mapOnchainAgentStatus } from "../services/agentLifecycle.js";
import { deriveJobPda, getAgentAccountData } from "../services/anchor.js";
import { resolveNameToWallet } from "../services/sns.js";

export type AgentSyncPayload = {
  jobId: string;
  agentWallets: Array<{
    agentId: string;
    wallet: string;
    jobPubkey: string;
  }>;
};

const REPEAT_EVERY_MS = 15000;
const SYNC_JOB_NAME = "sync";

let queueInstance: Queue<AgentSyncPayload> | null = null;

function getQueue() {
  queueInstance ??= new Queue<AgentSyncPayload>(AGENT_SYNC_QUEUE, {
    connection: createRedisConnection("bullmq")
  });
  return queueInstance;
}

export function createAgentSyncWorker(_services: AppServices) {
  return new Worker<AgentSyncPayload>(
    AGENT_SYNC_QUEUE,
    async (job) => {
      for (const agentWallet of job.data.agentWallets) {
        await syncAgent(job.data.jobId, agentWallet);
      }
    },
    {
      connection: createRedisConnection("bullmq"),
      concurrency: 5
    }
  );
}

export async function scheduleAgentSync(jobId: string, agentWallets: AgentSyncPayload["agentWallets"]) {
  await getQueue().add(
    SYNC_JOB_NAME,
    { jobId, agentWallets },
    {
      repeat: { every: REPEAT_EVERY_MS },
      jobId: `sync-${jobId}`,
      removeOnComplete: true
    }
  );
}

export async function cancelAgentSync(jobId: string) {
  await getQueue().removeRepeatable(SYNC_JOB_NAME, {
    every: REPEAT_EVERY_MS,
    jobId: `sync-${jobId}`
  });
}

export async function scheduleActiveJobSyncs(services: AppServices) {
  const activeJobs = await services.prisma.job.findMany({
    where: { status: "ACTIVE" },
    include: {
      owner: {
        select: { walletAddr: true }
      },
      agents: {
        select: {
          id: true,
          solSubName: true
        }
      }
    }
  });

  for (const job of activeJobs) {
    const jobPubkey = deriveJobPda(job.owner.walletAddr, job.onchainId).toBase58();
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
          } catch (error) {
            logger.warn({ err: error, agentId: agent.id }, "skipping agent sync scheduling for unresolved SNS name");
            return null;
          }
        })
      )
    ).filter((entry): entry is AgentSyncPayload["agentWallets"][number] => entry !== null);

    await scheduleAgentSync(job.id, agentWallets);
  }
}

async function syncAgent(
  jobId: string,
  agentWallet: AgentSyncPayload["agentWallets"][number]
) {
  try {
    const onchain = await getAgentAccountData(new PublicKey(agentWallet.jobPubkey), agentWallet.wallet);
    if (!onchain) {
      return;
    }

    const { prisma } = (await import("../lib/prisma.js"));
    const dbAgent = await prisma.agent.findUnique({
      where: { id: agentWallet.agentId },
      select: {
        id: true,
        jobId: true,
        status: true,
        actionCount: true
      }
    });

    if (!dbAgent) {
      return;
    }

    const onchainStatus = mapOnchainAgentStatus(onchain.status);
    if (onchainStatus === "REVOKED" && dbAgent.status === "ACTIVE") {
      const revokedAt = new Date();
      const descendants = await prisma.$transaction(async (tx) => {
        const descendantIds = await getDescendants(tx, dbAgent.id);
        await tx.agent.update({
          where: { id: dbAgent.id },
          data: { status: "REVOKED", revokedAt }
        });
        if (descendantIds.length > 0) {
          await tx.agent.updateMany({
            where: { id: { in: descendantIds } },
            data: { status: "REVOKED", revokedAt }
          });
        }
        return descendantIds;
      });

      await redisPublisher.publish(
        jobChannel(jobId),
        JSON.stringify({ type: "AGENT_REVOKED", agentId: dbAgent.id, cascade: descendants })
      );
      return;
    }

    if (onchainStatus !== dbAgent.status) {
      await prisma.agent.update({
        where: { id: dbAgent.id },
        data: { status: onchainStatus }
      });
      await redisPublisher.publish(
        jobChannel(jobId),
        JSON.stringify({ type: "AGENT_STATUS_CHANGE", agentId: dbAgent.id, status: onchainStatus })
      );
    }

    if (onchain.actionCount > dbAgent.actionCount) {
      await prisma.agent.update({
        where: { id: dbAgent.id },
        data: { actionCount: onchain.actionCount }
      });
      await redisPublisher.publish(
        jobChannel(jobId),
        JSON.stringify({ type: "AGENT_STATUS_CHANGE", agentId: dbAgent.id, status: onchainStatus })
      );
    }
  } catch (error) {
    logger.error({ err: error, jobId, agentId: agentWallet.agentId }, "agent sync iteration failed");
  }
}
