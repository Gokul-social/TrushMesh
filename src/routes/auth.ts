import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { REDIS_KEYS } from "../lib/constants.js";
import { ok } from "../lib/envelope.js";
import { env } from "../lib/env.js";
import { AppError } from "../lib/errors.js";
import { parseWith, walletAddressSchema } from "../lib/schemas.js";
import {
  buildSiwsMessage,
  createNonce,
  extractSiwsNonce,
  verifyWalletSignature
} from "../services/crypto.js";
import { getJson, setJson } from "../services/redis.js";

const challengeBodySchema = z.object({
  walletAddr: walletAddressSchema
});

const verifyBodySchema = z.object({
  walletAddr: walletAddressSchema,
  message: z.string().min(1),
  signature: z.string().min(1)
});

type ChallengeRecord = {
  walletAddr: string;
  message: string;
  expiresAt: string;
};

export async function registerAuthRoutes(app: FastifyInstance) {
  app.post("/challenge", async (request, reply) => {
    const body = parseWith(challengeBodySchema, request.body);
    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + 5 * 60 * 1000);
    const nonce = createNonce();
    const requestOrigin =
      typeof request.headers.origin === "string" && request.headers.origin.length > 0
        ? request.headers.origin
        : env.FRONTEND_URL;
    const message = buildSiwsMessage({
      walletAddr: body.walletAddr,
      nonce,
      issuedAt,
      expiresAt,
      domain: new URL(requestOrigin).origin
    });

    await setJson(
      app.services.redis,
      REDIS_KEYS.siwsChallenge(nonce),
      { walletAddr: body.walletAddr, message, expiresAt: expiresAt.toISOString() },
      300
    );

    return reply.send(ok({ nonce, message, expiresAt: expiresAt.toISOString() }));
  });

  app.post("/verify", async (request, reply) => {
    const body = parseWith(verifyBodySchema, request.body);
    const nonce = extractSiwsNonce(body.message);
    if (!nonce) {
      throw new AppError("VALIDATION_ERROR", "SIWS message is missing nonce");
    }

    const challenge = await getJson<ChallengeRecord>(
      app.services.redis,
      REDIS_KEYS.siwsChallenge(nonce)
    );

    if (!challenge || challenge.walletAddr !== body.walletAddr || challenge.message !== body.message) {
      throw new AppError("UNAUTHORIZED", "Invalid or expired challenge");
    }

    if (new Date(challenge.expiresAt).getTime() < Date.now()) {
      throw new AppError("UNAUTHORIZED", "Challenge expired");
    }

    if (!verifyWalletSignature(body.message, body.signature, body.walletAddr)) {
      throw new AppError("UNAUTHORIZED", "Wallet signature verification failed");
    }

    const solName = await app.services.sns.resolveWalletToName(body.walletAddr);
    const user = await app.services.prisma.user.upsert({
      where: { walletAddr: body.walletAddr },
      create: { walletAddr: body.walletAddr, solName },
      update: { solName },
      select: { id: true, walletAddr: true, solName: true, createdAt: true }
    });

    await app.services.redis.del(REDIS_KEYS.siwsChallenge(nonce));

    const token = app.jwt.sign(
      { sub: user.id, walletAddr: user.walletAddr },
      { expiresIn: "24h" }
    );

    return reply.send(
      ok({
        token,
        expiresIn: 86400,
        user: {
          ...user,
          createdAt: user.createdAt.toISOString()
        }
      })
    );
  });

  app.get("/me", { preHandler: [app.authenticate] }, async (request, reply) => {
    const solName = await app.services.sns.resolveWalletToName(request.authUser.walletAddr);
    const user = await app.services.prisma.user.update({
      where: { id: request.authUser.id },
      data: { solName },
      select: { id: true, walletAddr: true, solName: true, createdAt: true }
    });

    return reply.send(
      ok({
        ...user,
        createdAt: user.createdAt.toISOString()
      })
    );
  });
}
