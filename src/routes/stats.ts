import type { FastifyInstance } from "fastify";
import { REDIS_KEYS } from "../lib/constants.js";
import { ok } from "../lib/envelope.js";
import { getJson, setJson } from "../services/redis.js";

type GlobalStats = {
  activeJobs: number;
  totalAgents: number;
  unauthorizedActions: number;
};

export async function registerStatsRoutes(app: FastifyInstance) {
  app.get("/global", async (_request, reply) => {
    const cached = await getJson<GlobalStats>(app.services.redis, REDIS_KEYS.statsGlobal);
    if (cached) {
      return reply.send(ok(cached, { cached: true }));
    }

    const [activeJobs, totalAgents, unverifiedMessages, recentUnauthorizedRaw] = await Promise.all([
      app.services.prisma.job.count({ where: { status: "ACTIVE" } }),
      app.services.prisma.agent.count(),
      app.services.prisma.agentMessage.count({ where: { verified: false } }),
      app.services.redis.get(REDIS_KEYS.unauthorizedCounter)
    ]);

    const stats: GlobalStats = {
      activeJobs,
      totalAgents,
      unauthorizedActions: unverifiedMessages + Number(recentUnauthorizedRaw ?? 0)
    };

    await setJson(app.services.redis, REDIS_KEYS.statsGlobal, stats, 30);
    return reply.send(ok(stats, { cached: false }));
  });
}
