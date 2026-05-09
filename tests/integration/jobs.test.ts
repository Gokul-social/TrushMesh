import { beforeEach, describe, expect, it, vi } from "vitest";
import { authHeader, makeTestApp, testUser } from "../helpers.js";

const {
  validateSubNameMock,
  resolveWalletToNameMock,
  resolveNameToWalletMock,
  verifyJobInitMock,
  scheduleAgentSyncMock,
  publishMock
} = vi.hoisted(() => ({
  validateSubNameMock: vi.fn(),
  resolveWalletToNameMock: vi.fn(),
  resolveNameToWalletMock: vi.fn(),
  verifyJobInitMock: vi.fn(),
  scheduleAgentSyncMock: vi.fn(),
  publishMock: vi.fn()
}));

vi.mock("../../src/services/sns.js", () => ({
  resolveNameToWallet: resolveNameToWalletMock,
  resolveWalletToName: resolveWalletToNameMock,
  validateSubName: validateSubNameMock,
  createSnsResolver: () => ({
    resolveNameToWallet: resolveNameToWalletMock,
    resolveWalletToName: resolveWalletToNameMock,
    validateSubName: validateSubNameMock
  })
}));

vi.mock("../../src/services/anchor.js", () => ({
  deriveJobPda: () => ({ toBase58: () => "JobPubkey1111111111111111111111111111111" }),
  verifyJobInit: verifyJobInitMock,
  anchorService: {
    verifyDelegationLog: vi.fn(),
    verifyRevocationTx: vi.fn(),
    verifyJobInit: verifyJobInitMock,
    getAgentAccountData: vi.fn(),
    deriveJobPda: vi.fn()
  }
}));

vi.mock("../../src/queues/agentSync.js", () => ({
  scheduleAgentSync: scheduleAgentSyncMock,
  cancelAgentSync: vi.fn(),
  createAgentSyncWorker: vi.fn(),
  scheduleActiveJobSyncs: vi.fn()
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

describe("POST /jobs and PATCH /jobs/:id/activate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveWalletToNameMock.mockResolvedValue("alice.sol");
    resolveNameToWalletMock.mockResolvedValue("FakeWallet123");
    validateSubNameMock.mockResolvedValue(true);
    verifyJobInitMock.mockResolvedValue(true);
    scheduleAgentSyncMock.mockResolvedValue(undefined);
  });

  it("creates a job with status PENDING", async () => {
    const app = await makeTestApp({
      job: {
        create: async ({ data }: { data: Record<string, unknown> }) => ({
          id: "job_1",
          ...data,
          createdAt: new Date("2026-05-08T00:00:00.000Z"),
          updatedAt: new Date("2026-05-08T00:00:00.000Z")
        })
      }
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/jobs",
      headers: { Authorization: authHeader(app) },
      payload: {
        onchainId: "a".repeat(64),
        description: "Create a portfolio rebalancing job",
        template: "PORTFOLIO_REBALANCER",
        budgetSol: 1.5,
        plannerSubName: "planner",
        executorSubNames: ["executor"]
      }
    });

    expect(response.statusCode).toBe(201);
    expect(JSON.parse(response.body)).toMatchObject({
      data: {
        id: "job_1",
        status: "PENDING"
      }
    });

    await app.close();
  });

  it("returns 400 for an invalid planner sub-name", async () => {
    validateSubNameMock.mockResolvedValue(false);
    const app = await makeTestApp();

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/jobs",
      headers: { Authorization: authHeader(app) },
      payload: {
        onchainId: "b".repeat(64),
        description: "Create a DAO voter job",
        template: "DAO_VOTER",
        budgetSol: 0.5,
        plannerSubName: "planner",
        executorSubNames: ["executor"]
      }
    });

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toEqual({
      error: "INVALID_SUB_NAME",
      field: "plannerSubName"
    });

    await app.close();
  });

  it("activates a pending job and schedules sync", async () => {
    const app = await makeTestApp({
      job: {
        findUnique: async ({ where }: { where: { id: string } }) => {
          if (where.id === "job_1") {
            return {
              id: "job_1",
              ownerId: testUser.id,
              onchainId: "c".repeat(64),
              status: "PENDING",
              agents: [{ id: "agent_1", solSubName: "planner.alice.sol" }]
            };
          }
          return null;
        },
        update: async () => ({
          id: "job_1",
          ownerId: testUser.id,
          onchainId: "c".repeat(64),
          description: "Create a portfolio rebalancing job",
          template: "PORTFOLIO_REBALANCER",
          budgetSol: 1.5,
          status: "ACTIVE",
          createdAt: new Date("2026-05-08T00:00:00.000Z"),
          updatedAt: new Date("2026-05-08T00:00:00.000Z")
        })
      }
    });

    const response = await app.inject({
      method: "PATCH",
      url: "/api/v1/jobs/job_1/activate",
      headers: { Authorization: authHeader(app) },
      payload: { initTxHash: "init-tx-1" }
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toMatchObject({
      data: {
        id: "job_1",
        status: "ACTIVE"
      }
    });
    expect(scheduleAgentSyncMock).toHaveBeenCalledWith("job_1", [
      {
        agentId: "agent_1",
        wallet: "FakeWallet123",
        jobPubkey: "JobPubkey1111111111111111111111111111111"
      }
    ]);

    await app.close();
  });

  it("returns 422 when the init tx does not match the job", async () => {
    verifyJobInitMock.mockResolvedValue(false);
    const app = await makeTestApp({
      job: {
        findUnique: async () => ({
          id: "job_1",
          ownerId: testUser.id,
          onchainId: "d".repeat(64),
          status: "PENDING",
          agents: []
        })
      }
    });

    const response = await app.inject({
      method: "PATCH",
      url: "/api/v1/jobs/job_1/activate",
      headers: { Authorization: authHeader(app) },
      payload: { initTxHash: "bad-init-tx" }
    });

    expect(response.statusCode).toBe(422);
    expect(JSON.parse(response.body)).toEqual({
      error: "ONCHAIN_MISMATCH",
      txHash: "bad-init-tx"
    });

    await app.close();
  });
});
