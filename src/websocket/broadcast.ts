import { jobChannel } from "../lib/constants.js";
import { redisPublisher } from "../lib/redis.js";

export type TrustMeshWsEvent =
  | { type: "SNAPSHOT"; nodes: unknown[]; edges: unknown[] }
  | { type: "AGENT_STATUS_CHANGE"; agentId: string; status: string }
  | { type: "NEW_MESSAGE"; message: unknown }
  | { type: "AGENT_SPAWNED"; agent: unknown }
  | { type: "AGENT_REVOKED"; agentId: string; cascade: string[] }
  | { type: "JOB_COMPLETE"; jobId: string };

export async function publishJobEvent(
  jobId: string,
  event: Exclude<TrustMeshWsEvent, { type: "SNAPSHOT" }>
) {
  await redisPublisher.publish(jobChannel(jobId), JSON.stringify(event));
}
