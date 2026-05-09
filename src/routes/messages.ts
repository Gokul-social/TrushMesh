import { Prisma } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { REDIS_KEYS } from "../lib/constants.js";
import { ok } from "../lib/envelope.js";
import { AppError } from "../lib/errors.js";
import { paginationQuerySchema, parseWith } from "../lib/schemas.js";
import { iso } from "../lib/serialize.js";
import { assertJobOwner } from "../middleware/access.js";
import { canonicalAgentMessage, verifyAgentMessage } from "../services/crypto.js";
import { incrementWithTtl } from "../services/redis.js";
import { publishJobEvent } from "../websocket/broadcast.js";

const listMessagesQuerySchema = paginationQuerySchema.extend({
  jobId: z.string().min(1)
});

const createMessageBodySchema = z.object({
  jobId: z.string().min(1),
  senderId: z.string().min(1),
  receiverId: z.string().min(1).nullable().optional(),
  action: z.string().trim().min(3).max(2000),
  txHash: z.string().min(8),
  signatureHex: z.string().regex(/^[0-9a-fA-F]{128}$/)
});

export async function registerMessageRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  app.get("/", async (request, reply) => {
    const query = parseWith(listMessagesQuerySchema, request.query);
    const limit = query.limit ?? 25;
    await assertJobOwner(app, query.jobId, request.authUser.id);

    const messages = await app.services.prisma.agentMessage.findMany({
      where: { jobId: query.jobId },
      take: limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: messageSelect
    });

    const hasNextPage = messages.length > limit;
    const page = hasNextPage ? messages.slice(0, -1) : messages;
    return reply.send(ok(page.map(mapMessage), { nextCursor: hasNextPage ? page[page.length - 1]?.id : null }));
  });

  app.post("/", async (request, reply) => {
    const body = parseWith(createMessageBodySchema, request.body);
    await assertJobOwner(app, body.jobId, request.authUser.id);

    const sender = await app.services.prisma.agent.findFirst({
      where: { id: body.senderId, jobId: body.jobId, ownerId: request.authUser.id },
      select: { id: true, solSubName: true }
    });
    if (!sender) {
      throw new AppError("VALIDATION_ERROR", "Sender agent must belong to the job");
    }

    const receiver = body.receiverId
      ? await app.services.prisma.agent.findFirst({
          where: { id: body.receiverId, jobId: body.jobId, ownerId: request.authUser.id },
          select: { id: true, solSubName: true }
        })
      : null;

    if (body.receiverId && !receiver) {
      throw new AppError("VALIDATION_ERROR", "Receiver agent must belong to the job");
    }

    const signedMessage = canonicalAgentMessage({
      jobId: body.jobId,
      senderSolName: sender.solSubName,
      receiverSolName: receiver?.solSubName ?? null,
      action: body.action,
      txHash: body.txHash
    });

    const senderWallet = await app.services.sns.resolveNameToWallet(sender.solSubName);
    const verified = safeVerify(signedMessage, body.signatureHex, senderWallet);
    if (!verified) {
      await incrementWithTtl(app.services.redis, REDIS_KEYS.unauthorizedCounter, 60 * 60);
      await app.services.redis.del(REDIS_KEYS.statsGlobal);
      throw new AppError("ONCHAIN_MISMATCH", "Agent message signature did not verify", {
        expected: { signer: sender.solSubName, wallet: senderWallet },
        actual: { txHash: body.txHash }
      });
    }

    try {
      const created = await app.services.prisma.$transaction(async (tx) => {
        const message = await tx.agentMessage.create({
          data: {
            jobId: body.jobId,
            senderId: body.senderId,
            receiverId: body.receiverId ?? null,
            action: body.action,
            txHash: body.txHash,
            signatureHex: body.signatureHex,
            verified
          },
          select: messageSelect
        });

        await tx.agent.update({
          where: { id: body.senderId },
          data: { actionCount: { increment: 1 } },
          select: { id: true }
        });

        return message;
      });

      await publishJobEvent(app.services, body.jobId, { type: "NEW_MESSAGE", message: mapMessage(created) });
      return reply.status(201).send(ok(mapMessage(created)));
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new AppError("CONFLICT", "Message tx hash already exists for this sender");
      }
      throw error;
    }
  });

  app.get("/:id/verify", async (request, reply) => {
    const params = parseWith(z.object({ id: z.string().min(1) }), request.params);
    const message = await app.services.prisma.agentMessage.findFirst({
      where: {
        id: params.id,
        job: { ownerId: request.authUser.id }
      },
      select: messageSelect
    });

    if (!message) {
      throw new AppError("NOT_FOUND", "Message not found");
    }

    const signedMessage = canonicalAgentMessage({
      jobId: message.jobId,
      senderSolName: message.sender.solSubName,
      receiverSolName: message.receiver?.solSubName ?? null,
      action: message.action,
      txHash: message.txHash
    });

    const senderWallet = await app.services.sns.resolveNameToWallet(message.sender.solSubName);
    const verified = safeVerify(signedMessage, message.signatureHex, senderWallet);

    if (verified !== message.verified) {
      await app.services.prisma.agentMessage.update({
        where: { id: message.id },
        data: { verified },
        select: { id: true }
      });
      await app.services.redis.del(REDIS_KEYS.statsGlobal);
    }

    return reply.send(ok({ id: message.id, verified }));
  });
}

const messageSelect = {
  id: true,
  jobId: true,
  action: true,
  txHash: true,
  signatureHex: true,
  verified: true,
  createdAt: true,
  sender: { select: { id: true, solSubName: true, type: true } },
  receiver: { select: { id: true, solSubName: true, type: true } }
} satisfies Prisma.AgentMessageSelect;

function safeVerify(message: string, signatureHex: string, wallet: string) {
  try {
    return verifyAgentMessage(message, signatureHex, wallet);
  } catch {
    return false;
  }
}

function mapMessage(message: {
  id: string;
  jobId: string;
  action: string;
  txHash: string;
  signatureHex: string;
  verified: boolean;
  createdAt: Date;
  sender: { id: string; solSubName: string; type: string };
  receiver: { id: string; solSubName: string; type: string } | null;
}) {
  return {
    ...message,
    createdAt: iso(message.createdAt)
  };
}
