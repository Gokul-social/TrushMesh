import { Queue, Worker, type JobsOptions } from "bullmq";
import type { AppServices } from "../server.js";
import { SNS_REFRESH_QUEUE } from "../lib/constants.js";
import { createRedisConnection } from "../services/redis.js";

export const REFRESH_SOL_NAMES = "REFRESH_SOL_NAMES";

export function createSnsRefreshQueue() {
  return new Queue(SNS_REFRESH_QUEUE, {
    connection: createRedisConnection("bullmq")
  });
}

export function createSnsRefreshWorker(services: AppServices) {
  return new Worker(
    SNS_REFRESH_QUEUE,
    async (job) => {
      if (job.name !== REFRESH_SOL_NAMES) {
        return;
      }
      await refreshSolNames(services);
    },
    {
      connection: createRedisConnection("bullmq"),
      concurrency: 1
    }
  );
}

export async function scheduleSnsRefresh(queue = createSnsRefreshQueue()) {
  const repeat: JobsOptions = {
    repeat: { every: 60 * 60 * 1000 },
    removeOnComplete: 10,
    removeOnFail: 20
  };

  await queue.add(REFRESH_SOL_NAMES, {}, { ...repeat, jobId: "refresh-sol-names" });
}

async function refreshSolNames(services: AppServices) {
  const users = await services.prisma.user.findMany({
    select: { id: true, walletAddr: true }
  });

  for (const user of users) {
    const solName = await services.sns.resolveWalletToName(user.walletAddr);
    await services.prisma.user.update({
      where: { id: user.id },
      data: { solName },
      select: { id: true }
    });
  }
}
