import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ok } from "../lib/envelope.js";
import { parseWith } from "../lib/schemas.js";
import { assertJobOwner } from "../middleware/access.js";
import { buildGraphSnapshot } from "../services/graph.js";

export async function registerGraphRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  app.get("/:jobId", async (request, reply) => {
    const params = parseWith(z.object({ jobId: z.string().min(1) }), request.params);
    await assertJobOwner(app, params.jobId, request.authUser.id);
    return reply.send(ok(await buildGraphSnapshot(app.services.prisma, params.jobId, request.authUser.id)));
  });
}
