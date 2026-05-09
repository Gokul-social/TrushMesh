import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import { AppError, zodToAppError } from "../lib/errors.js";
import { fail } from "../lib/envelope.js";
import { env } from "../lib/env.js";

export function registerErrorHandlers(app: FastifyInstance) {
  app.setNotFoundHandler((request, reply) => {
    request.log.warn({ url: request.url }, "route not found");
    reply.status(404).send(fail("NOT_FOUND", "Route not found"));
  });

  app.setErrorHandler((error, request, reply) => {
    const appError = normalizeError(error);
    logStructuredError(request, appError, error);
    reply
      .status(appError.statusCode)
      .send(
        fail(
          appError.code,
          appError.message,
          env.NODE_ENV === "production" ? appError.details : withDevDetails(appError.details, error)
        )
      );
  });
}

function normalizeError(error: unknown) {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof ZodError) {
    return zodToAppError(error);
  }

  if (isFastifyError(error) && error.statusCode === 429) {
    return new AppError("RATE_LIMITED", "Rate limit exceeded");
  }

  return new AppError("INTERNAL_ERROR", "Internal server error");
}

function logStructuredError(request: FastifyRequest, appError: AppError, original: unknown) {
  const level = appError.statusCode >= 500 ? "error" : "warn";
  request.log[level](
    {
      code: appError.code,
      statusCode: appError.statusCode,
      details: appError.details,
      err: env.NODE_ENV === "production" ? undefined : original
    },
    appError.message
  );
}

function withDevDetails(details: unknown, error: unknown) {
  return {
    details,
    stack: error instanceof Error ? error.stack : undefined
  };
}

function isFastifyError(error: unknown): error is FastifyError {
  return typeof error === "object" && error !== null && "statusCode" in error;
}

export async function sendError(reply: FastifyReply, error: AppError) {
  return reply.status(error.statusCode).send(fail(error.code, error.message, error.details));
}
