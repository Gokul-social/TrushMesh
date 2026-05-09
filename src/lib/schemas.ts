import { PublicKey } from "@solana/web3.js";
import { z } from "zod";
import { JOB_TEMPLATES } from "./constants.js";

export const walletAddressSchema = z.string().refine((value) => {
  try {
    new PublicKey(value);
    return true;
  } catch {
    return false;
  }
}, "Invalid Solana wallet address");

export const cuidSchema = z.string().min(8);

export const solNameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9-]+(\.[a-z0-9-]+)*\.sol$/, "Invalid .sol name");

export const paginationQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25)
});

export const jobStatusSchema = z.enum(["ACTIVE", "COMPLETE", "REVOKED"]);
export const agentTypeSchema = z.enum(["PLANNER", "EXECUTOR", "ANALYZER", "TRADER", "CONFIRMER"]);
export const agentStatusSchema = z.enum(["ACTIVE", "WARNING", "REVOKED", "COMPLETE"]);
export const jobTemplateSchema = z.enum(JOB_TEMPLATES);

export function parseWith<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw result.error;
  }
  return result.data;
}
