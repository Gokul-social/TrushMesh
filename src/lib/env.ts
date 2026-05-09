import "dotenv/config";
import { z } from "zod";

const inferredFrontendUrl =
  process.env.FRONTEND_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined) ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : undefined) ??
  "http://localhost:5173";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  SOLANA_RPC_URL: z.string().url(),
  ANCHOR_PROGRAM_ID: z.string().min(32),
  SNS_PROGRAM_ID: z.string().min(32),
  FRONTEND_URL: z.string().url().default(inferredFrontendUrl),
  PORT: z.coerce.number().int().positive().default(3001),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development")
});

export const env = envSchema.parse(process.env);

export type Env = typeof env;
