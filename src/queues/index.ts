import { buildServer } from "../server.js";
import { redis, redisPublisher, redisSubscriber } from "../lib/redis.js";
import { createAgentSyncWorker, scheduleActiveJobSyncs } from "./agentSync.js";
import { createSnsRefreshWorker, scheduleSnsRefresh } from "./snsRefresh.js";

const app = await buildServer();
const agentSyncWorker = createAgentSyncWorker(app.services);
const snsRefreshWorker = createSnsRefreshWorker(app.services);

await scheduleActiveJobSyncs(app.services);
await scheduleSnsRefresh();

app.log.info("TrustMesh workers started");

const shutdown = async () => {
  await agentSyncWorker.close();
  await snsRefreshWorker.close();
  await app.close();
  await app.services.prisma.$disconnect();
  await redis.quit?.();
  await redisPublisher.quit?.();
  await redisSubscriber.quit?.();
  process.exit(0);
};

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
