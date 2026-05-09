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

export const hash32HexSchema = z.string().regex(/^[0-9a-fA-F]{64}$/, "Expected 32-byte hex string");
export const signatureHexSchema = z.string().regex(/^[0-9a-fA-F]{128}$/, "Expected 64-byte signature hex");
export const subNameSchema = z.string().trim().toLowerCase().regex(/^[a-z0-9-]{1,32}$/, "Invalid sub-name");

export const jobStatusSchema = z.enum(["PENDING", "ACTIVE", "COMPLETE", "REVOKED"]);
export const agentTypeSchema = z.enum(["PLANNER", "EXECUTOR", "ANALYZER", "TRADER", "CONFIRMER"]);
export const agentStatusSchema = z.enum(["ACTIVE", "WARNING", "REVOKED", "COMPLETE"]);
export const jobTemplateSchema = z.enum(JOB_TEMPLATES);

export const createJobBodySchema = z.object({
  onchainId: hash32HexSchema,
  description: z.string().trim().min(1).max(500),
  template: jobTemplateSchema,
  budgetSol: z.number().min(0.01).max(100),
  plannerSubName: subNameSchema,
  executorSubNames: z.array(subNameSchema).min(1).max(5)
});

export const activateJobBodySchema = z.object({
  initTxHash: z.string().trim().min(1)
});

export const updateJobStatusBodySchema = z.object({
  status: z.enum(["COMPLETE", "REVOKED"]),
  txHash: z.string().trim().min(1).optional()
});

export const revokeAgentBodySchema = z.object({
  revokeTxHash: z.string().trim().min(1)
});

export const createMessageBodySchema = z.object({
  jobId: z.string().min(1),
  senderSolName: solNameSchema,
  receiverSolName: solNameSchema.optional(),
  action: z.string().trim().min(1).max(200),
  txHash: z.string().trim().min(1),
  signatureHex: signatureHexSchema
});

export function parseWith<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw result.error;
  }
  return result.data;
}
