import { buildServer } from "./server.js";
import { env } from "./lib/env.js";
import { redis, redisPublisher, redisSubscriber } from "./lib/redis.js";

const app = await buildServer();

const shutdown = async (signal: string) => {
  app.log.info({ signal }, "shutting down");
  await app.close();
  await app.services.prisma.$disconnect();
  await redis.quit?.();
  await redisPublisher.quit?.();
  await redisSubscriber.quit?.();
  process.exit(0);
};

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

await app.listen({ port: env.PORT, host: "0.0.0.0" });
