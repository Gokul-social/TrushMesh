import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AppError } from "../lib/errors.js";
import { buildGraphSnapshot } from "../services/graph.js";
import type { TrustMeshWsEvent } from "./broadcast.js";

const wsQuerySchema = z.object({
  jobId: z.string().min(1)
});

export async function registerWebsocketRoutes(app: FastifyInstance) {
  app.get("/ws", { websocket: true }, async (socket, request) => {
    const parsed = wsQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      socket.send(JSON.stringify({ type: "ERROR", error: "VALIDATION_ERROR" }));
      socket.close();
      return;
    }

    const { jobId } = parsed.data;
    const job = await app.services.prisma.job.findUnique({
      where: { id: jobId },
      select: { id: true }
    });

    if (!job) {
      throw new AppError("NOT_FOUND", "Job not found");
    }

    const graph = await buildGraphSnapshot(app.services.prisma, jobId);
    const snapshot: TrustMeshWsEvent = { type: "GRAPH_SNAPSHOT", jobId, graph };
    socket.send(JSON.stringify(snapshot));
    await app.services.wsHub.add(jobId, socket);
  });
}
