import { beforeEach, describe, expect, it, vi } from "vitest";
import { authHeader, makeTestApp, testUser } from "../helpers.js";

const { resolveNameToWalletMock, verifyRevocationTxMock, publishMock } = vi.hoisted(() => ({
  resolveNameToWalletMock: vi.fn(),
  verifyRevocationTxMock: vi.fn(),
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

vi.mock("../../src/services/anchor.js", () => ({
  verifyRevocationTx: verifyRevocationTxMock,
  verifyJobInit: vi.fn(),
  deriveJobPda: vi.fn(),
  getAgentAccountData: vi.fn(),
  anchorService: {
    verifyDelegationLog: vi.fn(),
    verifyRevocationTx: verifyRevocationTxMock,
    verifyJobInit: vi.fn(),
    getAgentAccountData: vi.fn(),
    deriveJobPda: vi.fn()
  }
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

describe("POST /agents/:id/revoke", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveNameToWalletMock.mockResolvedValue("FakeWallet123");
    verifyRevocationTxMock.mockResolvedValue(true);
  });

  it("revokes an agent and cascades to descendants", async () => {
    const app = await makeTestApp({
      agent: {
        findUnique: async () => ({
          id: "agent_root",
          jobId: "job_1",
          solSubName: "planner.alice.sol",
          status: "ACTIVE",
          job: {
            owner: {
              id: testUser.id,
              walletAddr: testUser.walletAddr
            }
          }
        }),
        findMany: async ({ where }: { where: { parentAgentId: string } }) => {
          if (where.parentAgentId === "agent_root") {
            return [{ id: "agent_child" }];
          }
          if (where.parentAgentId === "agent_child") {
            return [{ id: "agent_grandchild" }];
          }
          return [];
        },
        update: async () => ({ id: "agent_root" }),
        updateMany: async ({ where }: { where: { id: { in: string[] } } }) => ({ count: where.id.in.length })
      },
      $transaction: async <T>(callback: (tx: Record<string, unknown>) => Promise<T>) =>
        callback({
          agent: {
            findMany: async ({ where }: { where: { parentAgentId: string } }) => {
              if (where.parentAgentId === "agent_root") {
                return [{ id: "agent_child" }];
              }
              if (where.parentAgentId === "agent_child") {
                return [{ id: "agent_grandchild" }];
              }
              return [];
            },
            update: async () => ({ id: "agent_root" }),
            updateMany: async ({ where }: { where: { id: { in: string[] } } }) => ({ count: where.id.in.length })
          }
        })
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/agents/agent_root/revoke",
      headers: { Authorization: authHeader(app) },
      payload: { revokeTxHash: "revoke-tx-1" }
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      data: {
        revokedId: "agent_root",
        cascadeCount: 2
      }
    });
    expect(publishMock).toHaveBeenCalled();

    await app.close();
  });

  it("returns 403 for a non-owner", async () => {
    const app = await makeTestApp({
      agent: {
        findUnique: async () => ({
          id: "agent_root",
          jobId: "job_1",
          solSubName: "planner.alice.sol",
          status: "ACTIVE",
          job: {
            owner: {
              id: "user_2",
              walletAddr: "So11111111111111111111111111111111111111112"
            }
          }
        })
      }
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/agents/agent_root/revoke",
      headers: { Authorization: authHeader(app) },
      payload: { revokeTxHash: "revoke-tx-2" }
    });

    expect(response.statusCode).toBe(403);

    await app.close();
  });
});
