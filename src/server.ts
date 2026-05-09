import Fastify, { type FastifyInstance, type FastifyServerOptions } from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import websocket from "@fastify/websocket";
import type { PrismaClient } from "@prisma/client";
import { API_PREFIX } from "./lib/constants.js";
import { env } from "./lib/env.js";
import { loggerOptions } from "./lib/logger.js";
import { prisma as defaultPrisma } from "./lib/prisma.js";
import { redis as defaultRedis, type RedisLike } from "./lib/redis.js";
import { registerErrorHandlers } from "./middleware/errorHandler.js";
import { authPlugin } from "./middleware/auth.js";
import { anchorService, type AnchorVerifier } from "./services/anchor.js";
import { createSnsResolver, type SnsResolver } from "./services/sns.js";
import { registerWebsocketRoutes } from "./websocket/index.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerJobRoutes } from "./routes/jobs.js";
import { registerAgentRoutes } from "./routes/agents.js";
import { registerMessageRoutes } from "./routes/messages.js";
import { registerStatsRoutes } from "./routes/stats.js";
import { registerGraphRoutes } from "./routes/graph.js";

export type AppServices = {
  prisma: PrismaClient;
  redis: RedisLike;
  sns: SnsResolver;
  anchor: AnchorVerifier;
};

export type BuildServerOptions = {
  logger?: FastifyServerOptions["logger"];
  disableRateLimit?: boolean;
  disableWebsocket?: boolean;
  services?: Partial<AppServices>;
};

declare module "fastify" {
  interface FastifyInstance {
    services: AppServices;
  }
}

export async function buildServer(options: BuildServerOptions = {}) {
  const app = Fastify({
    logger: options.logger ?? loggerOptions,
    trustProxy: true
  });

  const services = createServices(options.services);
  app.decorate("services", services);

  registerErrorHandlers(app);

  const allowedOrigins = new Set(
    [
      env.FRONTEND_URL,
      process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
      process.env.VERCEL_BRANCH_URL ? `https://${process.env.VERCEL_BRANCH_URL}` : null,
      process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : null
    ].filter((origin): origin is string => Boolean(origin))
  );

  await app.register(cors, {
    credentials: true,
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("CORS origin not allowed"), false);
    }
  });

  if (!options.disableRateLimit) {
    await app.register(rateLimit, {
      max: 100,
      timeWindow: "1 minute",
      errorResponseBuilder() {
        return {
          data: null,
          error: {
            code: "RATE_LIMITED",
            message: "Rate limit exceeded"
          }
        };
      }
    });
  }

  await app.register(jwt, {
    secret: env.JWT_SECRET
  });

  if (!options.disableWebsocket) {
    await app.register(websocket);
  }
  await app.register(authPlugin);

  await app.register(registerAuthRoutes, { prefix: `${API_PREFIX}/auth` });
  await app.register(registerJobRoutes, { prefix: `${API_PREFIX}/jobs` });
  await app.register(registerAgentRoutes, { prefix: `${API_PREFIX}/agents` });
  await app.register(registerMessageRoutes, { prefix: `${API_PREFIX}/messages` });
  await app.register(registerStatsRoutes, { prefix: `${API_PREFIX}/stats` });
  await app.register(registerGraphRoutes, { prefix: `${API_PREFIX}/graph` });
  if (!options.disableWebsocket) {
    await registerWebsocketRoutes(app);
  }

  return app;
}

function createServices(overrides: Partial<AppServices> = {}): AppServices {
  const redis = overrides.redis ?? defaultRedis;
  const sns = overrides.sns ?? createSnsResolver(redis);
  const anchor = overrides.anchor ?? anchorService;

  return {
    prisma: overrides.prisma ?? defaultPrisma,
    redis,
    sns,
    anchor
  };
}
