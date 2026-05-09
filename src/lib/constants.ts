export const API_PREFIX = "/api/v1";

export const JOB_TEMPLATES = [
  "PORTFOLIO_REBALANCER",
  "DAO_VOTER",
  "DATA_FETCHER"
] as const;

export const AGENT_SYNC_QUEUE = "agent-sync";
export const SNS_REFRESH_QUEUE = "sns-refresh";

export const REDIS_KEYS = {
  statsGlobal: "stats:global",
  unauthorizedCounter: "stats:unauthorized-actions",
  siwsChallenge: (nonce: string) => `auth:siws:${nonce}`,
  snsName: (solName: string) => `sns:name:${solName.toLowerCase()}`,
  snsWallet: (wallet: string) => `sns:wallet:${wallet}`
};

export function jobChannel(jobId: string) {
  return `job:${jobId}`;
}
