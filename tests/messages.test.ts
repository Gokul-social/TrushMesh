import nacl from "tweetnacl";
import { describe, expect, it } from "vitest";
import { Keypair } from "@solana/web3.js";
import { authHeader, makeSns, makeTestApp } from "./helpers.js";
import { bytesToHex, canonicalAgentMessage } from "../src/services/crypto.js";

describe("message ingestion", () => {
  it("verifies an Ed25519 agent signature before writing the audit log", async () => {
    const keypair = Keypair.generate();
    const wallet = keypair.publicKey.toBase58();
    const action = "Requested historical block data";
    const txHash = "message-tx-a7f3c2";
    const signed = canonicalAgentMessage({
      jobId: "job_1",
      senderSolName: "planner.alice.sol",
      receiverSolName: null,
      action,
      txHash
    });
    const signatureHex = bytesToHex(nacl.sign.detached(new TextEncoder().encode(signed), keypair.secretKey));

    const app = await makeTestApp({
      sns: makeSns({ resolveNameToWallet: async () => wallet }),
      prisma: {
        agent: {
          findFirst: async () => ({ id: "agent_1", solSubName: "planner.alice.sol" }),
          count: async () => 1
        },
        $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
          callback({
            agentMessage: {
              create: async () => ({
                id: "msg_1",
                jobId: "job_1",
                action,
                txHash,
                signatureHex,
                verified: true,
                createdAt: new Date("2026-05-08T00:00:00.000Z"),
                sender: { id: "agent_1", solSubName: "planner.alice.sol", type: "PLANNER" },
                receiver: null
              })
            },
            agent: {
              update: async () => ({ id: "agent_1" })
            }
          })
      }
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/messages",
      headers: {
        Authorization: authHeader(app)
      },
      payload: {
        jobId: "job_1",
        senderId: "agent_1",
        action,
        txHash,
        signatureHex
      }
    });

    expect(response.statusCode).toBe(201);
    const responseBody = JSON.parse(response.body) as { data: { verified: boolean; id: string } };
    expect(responseBody.data.verified).toBe(true);
    expect(responseBody.data.id).toBe("msg_1");

    await app.close();
  });
});
