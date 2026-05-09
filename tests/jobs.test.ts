import { describe, expect, it } from "vitest";
import { authHeader, makeTestApp, testUser } from "./helpers.js";

describe("job creation", () => {
  it("creates a job with ordered agent hierarchy after onchain verification", async () => {
    const createdAgents: unknown[] = [];
    const app = await makeTestApp({
      prisma: {
        job: {
          findFirst: async () => ({ id: "job_1", onchainId: "A7F3C2", ownerId: testUser.id, status: "ACTIVE" }),
          count: async () => 1
        },
        agent: { count: async () => 2 },
        agentMessage: { count: async () => 0 },
        $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
          callback({
            job: {
              create: async () => ({
                id: "job_new",
                onchainId: "A7F3C2",
                description: "Fetch data",
                template: "DATA_FETCHER",
                budgetSol: "0.1",
                status: "ACTIVE",
                createdAt: new Date("2026-05-08T00:00:00.000Z"),
                updatedAt: new Date("2026-05-08T00:00:00.000Z")
              })
            },
            agent: {
              create: async ({ data }: { data: { solSubName: string; parentAgentId?: string | null } }) => {
                const agent = {
                  id: `agent_${createdAgents.length + 1}`,
                  jobId: "job_new",
                  solSubName: data.solSubName,
                  type: "PLANNER",
                  status: "ACTIVE",
                  parentAgentId: data.parentAgentId ?? null,
                  actionCount: 0,
                  createdAt: new Date("2026-05-08T00:00:00.000Z")
                };
                createdAgents.push(agent);
                return agent;
              }
            }
          })
      }
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/jobs",
      headers: {
        Authorization: authHeader(app)
      },
      payload: {
        onchainId: "A7F3C2",
        deployTxHash: "deploy-tx-a7f3c2",
        description: "Fetch data",
        template: "DATA_FETCHER",
        budgetSol: "0.1",
        agents: [
          { solSubName: "planner.alice.sol", type: "PLANNER", spawnTxHash: "spawn-planner" },
          {
            solSubName: "worker.alice.sol",
            type: "EXECUTOR",
            parentSolSubName: "planner.alice.sol",
            spawnTxHash: "spawn-worker"
          }
        ]
      }
    });

    expect(response.statusCode).toBe(201);
    const responseBody = JSON.parse(response.body) as {
      data: { id: string; agents: Array<{ parentAgentId: string | null }> };
    };
    expect(responseBody.data.id).toBe("job_new");
    expect(responseBody.data.agents).toHaveLength(2);
    expect(responseBody.data.agents[1].parentAgentId).toBe("agent_1");

    await app.close();
  });
});
