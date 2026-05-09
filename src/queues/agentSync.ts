import { Queue, Worker, type JobsOptions } from "bullmq";
import { Connection, PublicKey } from "@solana/web3.js";
import type { AppServices } from "../server.js";
import { AGENT_SYNC_QUEUE } from "../lib/constants.js";
import { env } from "../lib/env.js";
import { createRedisConnection } from "../services/redis.js";
import { canonicalAgentMessage, verifyAgentMessage } from "../services/crypto.js";
import { publishJobEvent } from "../websocket/broadcast.js";

export const SYNC_AGENT_ACTIONS = "SYNC_AGENT_ACTIONS";

export function createAgentSyncQueue() {
  return new Queue(AGENT_SYNC_QUEUE, {
    connection: createRedisConnection("bullmq")
  });
}

export function createAgentSyncWorker(services: AppServices) {
  const connection = new Connection(env.SOLANA_RPC_URL, "confirmed");
  return new Worker(
    AGENT_SYNC_QUEUE,
    async (job) => {
      if (job.name !== SYNC_AGENT_ACTIONS) {
        return;
      }
      await syncAgentActions(services, connection, job.data.jobId as string);
    },
    {
      connection: createRedisConnection("bullmq"),
      concurrency: 5
    }
  );
}

export async function scheduleActiveJobSyncs(services: AppServices, queue = createAgentSyncQueue()) {
  const activeJobs = await services.prisma.job.findMany({
    where: { status: "ACTIVE" },
    select: { id: true }
  });

  const repeat: JobsOptions = {
    repeat: { every: 15000 },
    removeOnComplete: 50,
    removeOnFail: 100
  };

  for (const activeJob of activeJobs) {
    await queue.add(SYNC_AGENT_ACTIONS, { jobId: activeJob.id }, { ...repeat, jobId: `sync:${activeJob.id}` });
  }
}

async function syncAgentActions(
  services: AppServices,
  connection: Connection,
  jobId: string
) {
  const job = await services.prisma.job.findUnique({
    where: { id: jobId },
    select: { id: true, onchainId: true }
  });

  if (!job) {
    return;
  }

  const agents = await services.prisma.agent.findMany({
    where: { jobId, status: { not: "REVOKED" } },
    select: { id: true, solSubName: true }
  });

  for (const agent of agents) {
    const wallet = await resolveWalletSafely(services, agent.solSubName);
    if (!wallet) {
      continue;
    }

    const signatures = await connection.getSignaturesForAddress(new PublicKey(wallet), { limit: 20 });
    for (const signature of signatures) {
      const existing = await services.prisma.agentMessage.findFirst({
        where: { senderId: agent.id, txHash: signature.signature },
        select: { id: true }
      });
      if (existing) {
        continue;
      }

      const onchain = await services.anchor.extractAgentMessage(signature.signature);
      if (!onchain || onchain.jobOnchainId !== job.onchainId || onchain.senderSolName !== agent.solSubName) {
        continue;
      }

      const receiver = onchain.receiverSolName
        ? await services.prisma.agent.findFirst({
            where: { jobId, solSubName: onchain.receiverSolName },
            select: { id: true, solSubName: true }
          })
        : null;

      const canonical = canonicalAgentMessage({
        jobId,
        senderSolName: onchain.senderSolName,
        receiverSolName: receiver?.solSubName ?? null,
        action: onchain.action,
        txHash: signature.signature
      });

      const verified = verifyAgentMessage(canonical, onchain.signatureHex, wallet);
      if (!verified) {
        continue;
      }

      const message = await services.prisma.agentMessage.create({
        data: {
          jobId,
          senderId: agent.id,
          receiverId: receiver?.id ?? null,
          action: onchain.action,
          txHash: signature.signature,
          signatureHex: onchain.signatureHex,
          verified
        },
        select: {
          id: true,
          jobId: true,
          action: true,
          txHash: true,
          signatureHex: true,
          verified: true,
          createdAt: true,
          sender: { select: { id: true, solSubName: true, type: true } },
          receiver: { select: { id: true, solSubName: true, type: true } }
        }
      });

      await services.prisma.agent.update({
        where: { id: agent.id },
        data: { actionCount: { increment: 1 } },
        select: { id: true }
      });

      await publishJobEvent(services, jobId, {
        type: "NEW_MESSAGE",
        message: { ...message, createdAt: message.createdAt.toISOString() }
      });
    }
  }
}

async function resolveWalletSafely(services: AppServices, solName: string) {
  try {
    return await services.sns.resolveNameToWallet(solName);
  } catch {
    return null;
  }
}
