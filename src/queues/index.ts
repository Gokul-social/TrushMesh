import { buildServer } from "../server.js";
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
  await app.services.redis.quit?.();
  await app.services.redisPub.quit?.();
  await app.services.redisSub.quit?.();
  process.exit(0);
};

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
