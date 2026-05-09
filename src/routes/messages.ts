import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ok } from "../lib/envelope.js";
import { AppError } from "../lib/errors.js";
import { iso } from "../lib/serialize.js";
import { createMessageBodySchema, parseWith } from "../lib/schemas.js";
import { assertJobOwner } from "../middleware/access.js";
import { verifyEd25519Signature } from "../services/crypto.js";
import { resolveNameToWallet } from "../services/sns.js";
import { publishJobEvent } from "../websocket/broadcast.js";

export async function registerMessageRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  app.get("/", async (request, reply) => {
    const query = parseWith(
      z.object({
        jobId: z.string().min(1),
        cursor: z.string().optional(),
        limit: z.coerce.number().int().min(1).max(200).default(25)
      }),
      request.query
    );
    const limit = query.limit ?? 25;

    await assertJobOwner(app, query.jobId, request.authUser.id);

    const messages = await app.services.prisma.agentMessage.findMany({
      where: { jobId: query.jobId },
      take: limit + 1,
      ...(query.cursor
        ? {
            cursor: { id: query.cursor },
            skip: 1
          }
        : {}),
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      include: {
        sender: {
          select: {
            solSubName: true
          }
        },
        receiver: {
          select: {
            solSubName: true
          }
        }
      }
    });

    const hasNextPage = messages.length > limit;
    const slice = hasNextPage ? messages.slice(0, limit) : messages;

    return reply.send(
      ok({
        items: slice.map((message) => ({
          id: message.id,
          jobId: message.jobId,
          senderId: message.senderId,
          senderName: message.sender.solSubName,
          receiverId: message.receiverId,
          receiverName: message.receiver?.solSubName ?? null,
          action: message.action,
          txHash: message.txHash,
          signatureHex: message.signatureHex,
          verified: message.verified,
          createdAt: iso(message.createdAt)
        })),
        nextCursor: hasNextPage ? slice[slice.length - 1]?.id ?? null : null
      })
    );
  });

  app.post("/", async (request, reply) => {
    const body = parseWith(createMessageBodySchema, request.body);
    const job = await app.services.prisma.job.findUnique({
      where: { id: body.jobId },
      select: { id: true, status: true }
    });

    if (!job) {
      throw new AppError("NOT_FOUND", "Job not found");
    }

    if (job.status !== "ACTIVE") {
      return reply.status(409).send({ error: "JOB_NOT_ACTIVE" });
    }

    let senderWalletAddress: string;
    try {
      senderWalletAddress = await resolveNameToWallet(body.senderSolName);
    } catch {
      return reply.status(422).send({ error: "SNS_RESOLUTION_FAILED" });
    }

    const sender = await app.services.prisma.agent.findFirst({
      where: {
        jobId: body.jobId,
        solSubName: body.senderSolName
      },
      select: {
        id: true,
        status: true
      }
    });

    if (!sender) {
      return reply.status(404).send({ error: "AGENT_NOT_FOUND" });
    }

    if (sender.status !== "ACTIVE") {
      return reply.status(409).send({ error: "AGENT_REVOKED" });
    }

    const receiver = body.receiverSolName
      ? await app.services.prisma.agent.findFirst({
          where: {
            jobId: body.jobId,
            solSubName: body.receiverSolName
          },
          select: { id: true }
        })
      : null;

    const verified = await verifyEd25519Signature(body.action, body.signatureHex, senderWalletAddress);
    if (!verified) {
      return reply.status(422).send({ error: "INVALID_SIGNATURE" });
    }

    const createdMessage = await app.services.prisma.$transaction(async (tx) => {
      const message = await tx.agentMessage.create({
        data: {
          jobId: body.jobId,
          senderId: sender.id,
          receiverId: receiver?.id ?? null,
          action: body.action,
          txHash: body.txHash,
          signatureHex: body.signatureHex,
          verified: true
        }
      });

      await tx.agent.update({
        where: { id: sender.id },
        data: {
          actionCount: {
            increment: 1
          }
        }
      });

      return message;
    });

    const responseMessage = {
      id: createdMessage.id,
      jobId: createdMessage.jobId,
      senderId: createdMessage.senderId,
      senderName: body.senderSolName,
      receiverId: createdMessage.receiverId,
      receiverName: body.receiverSolName ?? null,
      action: createdMessage.action,
      txHash: createdMessage.txHash,
      signatureHex: createdMessage.signatureHex,
      verified: createdMessage.verified,
      createdAt: iso(createdMessage.createdAt)
    };

    await publishJobEvent(body.jobId, { type: "NEW_MESSAGE", message: responseMessage });
    return reply.status(201).send(ok(responseMessage));
  });
}
