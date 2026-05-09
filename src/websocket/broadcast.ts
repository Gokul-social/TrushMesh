import { jobChannel } from "../lib/constants.js";
import type { AppServices } from "../server.js";

export type TrustMeshWsEvent =
  | { type: "GRAPH_SNAPSHOT"; jobId: string; graph: unknown }
  | { type: "AGENT_STATUS_CHANGE"; agentId: string; status: string }
  | { type: "NEW_MESSAGE"; message: unknown }
  | { type: "AGENT_SPAWNED"; agent: unknown }
  | { type: "AGENT_REVOKED"; agentId: string; cascade: string[] }
  | { type: "JOB_COMPLETE"; jobId: string };

export async function publishJobEvent(
  services: AppServices,
  jobId: string,
  event: Exclude<TrustMeshWsEvent, { type: "GRAPH_SNAPSHOT" }>
) {
  await services.redisPub.publish(jobChannel(jobId), JSON.stringify(event));
}
