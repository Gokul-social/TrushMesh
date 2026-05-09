import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { createRedisConnection } from "../lib/redis.js";
import { logger } from "../lib/logger.js";
import { buildGraphSnapshot } from "../services/graph.js";

type SocketLike = {
  send(payload: string): void;
  close(code?: number): void;
  on(event: "close", listener: () => void): void;
};

const wsQuerySchema = z.object({
  jobId: z.string().min(1),
  token: z.string().min(1)
});

export async function handleWebsocketConnection(
  app: FastifyInstance,
  socket: SocketLike,
  request: FastifyRequest
) {
  const parsedQuery = wsQuerySchema.safeParse(request.query);
  if (!parsedQuery.success) {
    socket.close(4000);
    return;
  }

  const { jobId, token } = parsedQuery.data;

  let authUser: { id: string; walletAddr: string };
  try {
    const payload = app.jwt.verify<{ sub: string; walletAddr: string }>(token);
    authUser = {
      id: payload.sub,
      walletAddr: payload.walletAddr
    };
  } catch {
    socket.close(4001);
    return;
  }

  const user = await app.services.prisma.user.findUnique({
    where: { id: authUser.id },
    select: { id: true, walletAddr: true }
  });

  if (!user || user.walletAddr !== authUser.walletAddr) {
    socket.close(4001);
    return;
  }

  const job = await app.services.prisma.job.findUnique({
    where: { id: jobId },
    select: { id: true, ownerId: true }
  });

  if (!job || job.ownerId !== user.id) {
    socket.close(4001);
    return;
  }

  const subscriber = createRedisConnection("subscriber");
  const channel = `job:${jobId}`;

  const graph = await buildGraphSnapshot(app.services.prisma, jobId, user.id);
  socket.send(JSON.stringify({ type: "SNAPSHOT", nodes: graph.nodes, edges: graph.edges }));

  subscriber.on("message", (messageChannel: string, message: string) => {
    if (messageChannel === channel) {
      socket.send(message);
    }
  });

  await subscriber.subscribe(channel);

  socket.on("close", () => {
    void subscriber.unsubscribe(channel).catch((error: unknown) => {
      logger.warn({ err: error, channel }, "websocket unsubscribe failed");
    });
    void subscriber.quit?.();
  });
}
