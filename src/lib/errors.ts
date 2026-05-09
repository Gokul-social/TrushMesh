import { ZodError } from "zod";

export type ErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "ONCHAIN_MISMATCH"
  | "RATE_LIMITED"
  | "CONFLICT"
  | "INTERNAL_ERROR";

const statusByCode: Record<ErrorCode, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION_ERROR: 400,
  ONCHAIN_MISMATCH: 422,
  RATE_LIMITED: 429,
  CONFLICT: 409,
  INTERNAL_ERROR: 500
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly statusCode: number;
  readonly details?: unknown;

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusByCode[code];
    this.details = details;
  }
}

export function zodToAppError(error: ZodError) {
  return new AppError("VALIDATION_ERROR", "Request validation failed", {
    issues: error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message
    }))
  });
}

export function assertFound<T>(value: T | null | undefined, message = "Resource not found"): T {
  if (!value) {
    throw new AppError("NOT_FOUND", message);
  }
  return value;
}
