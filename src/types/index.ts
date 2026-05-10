export type JobStatus = "PENDING" | "ACTIVE" | "COMPLETE" | "REVOKED";
export type AgentStatus = "ACTIVE" | "WARNING" | "REVOKED" | "COMPLETE";
export type AgentType = "PLANNER" | "EXECUTOR" | "ANALYZER" | "TRADER" | "CONFIRMER";
export type JobTemplate = "PORTFOLIO_REBALANCER" | "DAO_VOTER" | "DATA_FETCHER";

export type ApiEnvelope<T> = {
  data: T | null;
  meta?: Record<string, string | number | boolean | null>;
  error?: {
    code: string;
    message: string;
    details?: Record<string, string | number | boolean | null> | string | null;
  };
};

export type AuthUser = {
  id: string;
  walletAddr: string;
  solName: string | null;
  createdAt: string;
};

export type Job = {
  id: string;
  onchainId: string;
  ownerId: string;
  ownerSolName: string | null;
  description: string;
  template: JobTemplate;
  budgetSol: string;
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
  agentCount?: number;
  activeAgentCount?: number;
  breachCount?: number;
};

export type AgentAction = {
  id: string;
  createdAt: string;
  description: string;
  verified: boolean;
  txHash: string;
};

export type Agent = {
  id: string;
  jobId: string;
  label: string;
  solSubName: string;
  type: AgentType;
  status: AgentStatus;
  parentAgentId: string | null;
  parentSolSubName?: string | null;
  actionCount: number;
  createdAt: string;
  walletAddr?: string | null;
  spawnTxHash?: string | null;
  revokedAt?: string | null;
  revokeTxHash?: string | null;
  lastActionAt?: string | null;
  childCount?: number;
  actions?: AgentAction[];
  isHumanRoot?: boolean;
};

export type Delegation = {
  id: string;
  source: string;
  target: string;
  type: "DELEGATION";
  status?: AgentStatus;
  label?: string;
};

export type GraphSnapshot = {
  nodes: Agent[];
  edges: Delegation[];
};

export type AgentMessage = {
  id: string;
  jobId: string;
  senderId: string;
  senderName: string;
  receiverId: string | null;
  receiverName: string | null;
  action: string;
  txHash: string;
  signatureHex: string;
  verified: boolean;
  createdAt: string;
};

export type MessagePage = {
  items: AgentMessage[];
  nextCursor: string | null;
};

export type GlobalStats = {
  activeJobs: number;
  totalAgents: number;
  totalMessages: number;
  unauthorizedActions: number;
};

export type WsEvent =
  | { type: "SNAPSHOT"; nodes: Agent[]; edges: Delegation[] }
  | { type: "AGENT_STATUS_CHANGE"; agentId: string; status: AgentStatus }
  | { type: "NEW_MESSAGE"; message: AgentMessage }
  | { type: "AGENT_SPAWNED"; agent: Agent }
  | { type: "AGENT_REVOKED"; agentId: string; cascade: string[] }
  | { type: "JOB_COMPLETE"; jobId: string };
