import { beforeEach, describe, expect, it, vi } from "vitest";
import { authHeader, makeTestApp } from "../helpers.js";

const { resolveNameToWalletMock, verifyEd25519SignatureMock, publishMock } = vi.hoisted(() => ({
  resolveNameToWalletMock: vi.fn(),
  verifyEd25519SignatureMock: vi.fn(),
  publishMock: vi.fn()
}));

vi.mock("../../src/services/sns.js", () => ({
  resolveNameToWallet: resolveNameToWalletMock,
  resolveWalletToName: vi.fn(),
  validateSubName: vi.fn(),
  createSnsResolver: () => ({
    resolveNameToWallet: resolveNameToWalletMock,
    resolveWalletToName: vi.fn(),
    validateSubName: vi.fn()
  })
}));

vi.mock("../../src/services/crypto.js", () => ({
  createNonce: vi.fn(),
  buildSiwsMessage: vi.fn(),
  extractSiwsNonce: vi.fn(),
  verifyWalletSignature: vi.fn(),
  verifyEd25519Signature: verifyEd25519SignatureMock
}));

vi.mock("../../src/lib/redis.js", () => ({
  redis: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    publish: vi.fn(),
    quit: vi.fn()
  },
  redisPublisher: {
    publish: publishMock,
    quit: vi.fn()
  },
  redisSubscriber: {
    quit: vi.fn()
  },
  createRedisConnection: vi.fn(() => ({
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    on: vi.fn(),
    quit: vi.fn()
  })),
  getJson: vi.fn(),
  setJson: vi.fn(),
  incrementWithTtl: vi.fn()
}));

describe("POST /messages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveNameToWalletMock.mockResolvedValue("FakeWallet123");
    verifyEd25519SignatureMock.mockResolvedValue(true);
  });

  it("creates a verified message and increments action count", async () => {
    const app = await makeTestApp({
      job: {
        findUnique: async () => ({
          id: "job_1",
          status: "ACTIVE"
        })
      },
      agent: {
        findFirst: async ({ where }: { where: { solSubName: string } }) => {
          if (where.solSubName === "planner.alice.sol") {
            return { id: "agent_1", status: "ACTIVE" };
          }
          if (where.solSubName === "executor.alice.sol") {
            return { id: "agent_2" };
          }
          return null;
        }
      },
      agentMessage: {
        create: async ({ data }: { data: Record<string, unknown> }) => ({
          id: "msg_1",
          ...data,
          createdAt: new Date("2026-05-08T00:00:00.000Z")
        })
      },
      $transaction: async <T>(callback: (tx: Record<string, unknown>) => Promise<T>) =>
        callback({
          agentMessage: {
            create: async ({ data }: { data: Record<string, unknown> }) => ({
              id: "msg_1",
              ...data,
              createdAt: new Date("2026-05-08T00:00:00.000Z")
            })
          },
          agent: {
            update: async () => ({ id: "agent_1", actionCount: 1 })
          }
        })
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/messages",
      headers: { Authorization: authHeader(app) },
      payload: {
        jobId: "job_1",
        senderSolName: "planner.alice.sol",
        receiverSolName: "executor.alice.sol",
        action: "Rebalance the treasury allocation",
        txHash: "delegation-tx-1",
        signatureHex: "a".repeat(128)
      }
    });

    expect(response.statusCode).toBe(201);
    expect(JSON.parse(response.body)).toMatchObject({
      data: {
        id: "msg_1",
        verified: true
      }
    });
    expect(publishMock).toHaveBeenCalled();

    await app.close();
  });

  it("returns 422 for an invalid signature", async () => {
    verifyEd25519SignatureMock.mockResolvedValue(false);
    const app = await makeTestApp({
      job: {
        findUnique: async () => ({
          id: "job_1",
          status: "ACTIVE"
        })
      },
      agent: {
        findFirst: async () => ({ id: "agent_1", status: "ACTIVE" })
      }
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/messages",
      headers: { Authorization: authHeader(app) },
      payload: {
        jobId: "job_1",
        senderSolName: "planner.alice.sol",
        action: "Rebalance the treasury allocation",
        txHash: "delegation-tx-2",
        signatureHex: "b".repeat(128)
      }
    });

    expect(response.statusCode).toBe(422);
    expect(JSON.parse(response.body)).toEqual({
      error: "INVALID_SIGNATURE"
    });

    await app.close();
  });
});
