import { describe, expect, it } from "vitest";
import { authHeader, makeTestApp, testUser } from "./helpers.js";

describe("agent revocation", () => {
  it("recursively marks child agents as revoked", async () => {
    let updatedCascade: string[] = [];
    const app = await makeTestApp({
      prisma: {
        agent: {
          findFirst: async ({ where }: { where: { id?: string } }) => {
            if (where.id === "root") {
              return {
                id: "root",
                jobId: "job_1",
                ownerId: testUser.id,
                solSubName: "planner.alice.sol",
                status: "ACTIVE",
                parentAgentId: null
              };
            }
            return { id: where.id, jobId: "job_1" };
          },
          findMany: async ({ where }: { where: { parentAgentId: { in: string[] } } }) => {
            if (where.parentAgentId.in.includes("root")) {
              return [{ id: "child" }];
            }
            if (where.parentAgentId.in.includes("child")) {
              return [{ id: "grandchild" }];
            }
            return [];
          },
          updateMany: async ({ where }: { where: { id: { in: string[] } } }) => {
            updatedCascade = where.id.in;
            return { count: updatedCascade.length };
          },
          count: async () => 3
        }
      }
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/agents/root/revoke",
      headers: {
        Authorization: authHeader(app)
      },
      payload: { txHash: "revoke-root-tx" }
    });

    expect(response.statusCode).toBe(200);
    const responseBody = JSON.parse(response.body) as { data: { cascade: string[] } };
    expect(responseBody.data.cascade).toEqual(["root", "child", "grandchild"]);
    expect(updatedCascade).toEqual(["root", "child", "grandchild"]);

    await app.close();
  });
});
