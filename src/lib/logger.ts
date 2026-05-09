import pino from "pino";
import type { FastifyServerOptions } from "fastify";
import { env } from "./env.js";

export const loggerOptions: FastifyServerOptions["logger"] =
  env.NODE_ENV === "test"
    ? false
    : {
        level: env.NODE_ENV === "production" ? "info" : "debug",
        redact: ["req.headers.authorization", "JWT_SECRET", "DATABASE_URL"]
      };

export const logger = pino(typeof loggerOptions === "object" ? loggerOptions : { enabled: false });
