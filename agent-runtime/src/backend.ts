import axios, { type AxiosInstance } from "axios";

export type ApiEnvelope<T> = {
  data: T | null;
  meta?: Record<string, unknown>;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export type AuthUser = {
  id: string;
  walletAddr: string;
  solName: string | null;
  createdAt: string;
};

export type JobRecord = {
  id: string;
  onchainId: string;
  ownerId: string;
  ownerSolName: string | null;
  description: string;
  template: string;
  budgetSol: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type GraphNode = {
  id: string;
  jobId: string;
  label: string;
  solSubName: string;
  type: string;
  status: string;
  parentAgentId: string | null;
  actionCount: number;
  createdAt: string;
};

export type GraphSnapshot = {
  nodes: GraphNode[];
  edges: Array<{
    id: string;
    source: string;
    target: string;
    type: "DELEGATION";
  }>;
};

function createClient(): AxiosInstance {
  return axios.create({
    baseURL: process.env.BACKEND_URL,
    headers: { Authorization: `Bearer ${process.env.BACKEND_JWT}` }
  });
}

function unwrapEnvelope<T>(envelope: ApiEnvelope<T>): T {
  if (envelope.data === null) {
    throw new Error(envelope.error?.message ?? "Backend returned no data");
  }

  return envelope.data;
}

export const backend = {
  async getMe() {
    const client = createClient();
    const response = await client.get<ApiEnvelope<AuthUser>>("/auth/me");
    return unwrapEnvelope(response.data);
  },

  async createJob(data: {
    onchainId: string;
    description: string;
    template: string;
    budgetSol: number;
    plannerSubName: string;
    executorSubNames: string[];
  }) {
    const client = createClient();
    const response = await client.post<ApiEnvelope<JobRecord>>("/jobs", data);
    return unwrapEnvelope(response.data);
  },

  async activateJob(jobId: string, initTxHash: string) {
    const client = createClient();
    const response = await client.patch<ApiEnvelope<JobRecord>>(`/jobs/${jobId}/activate`, {
      initTxHash
    });
    return unwrapEnvelope(response.data);
  },

  async getGraph(jobId: string) {
    const client = createClient();
    const response = await client.get<ApiEnvelope<GraphSnapshot>>(`/graph/${jobId}`);
    return unwrapEnvelope(response.data);
  },

  async registerAgent(data: {
    jobId: string;
    solSubName: string;
    type: string;
    wallet: string;
    parentAgentId?: string;
    spawnTxHash: string;
  }) {
    const graph = await this.getGraph(data.jobId);
    const agent = graph.nodes.find(
      (node) =>
        node.solSubName === data.solSubName &&
        node.type === data.type &&
        node.parentAgentId === (data.parentAgentId ?? null)
    );

    if (!agent) {
      throw new Error(
        `Backend agent row not found for ${data.solSubName}. This backend currently pre-creates agents during POST /jobs.`
      );
    }

    return agent;
  },

  async postMessage(data: {
    jobId: string;
    senderSolName: string;
    receiverSolName?: string;
    action: string;
    txHash: string;
    signatureHex: string;
  }) {
    const client = createClient();
    const response = await client.post<ApiEnvelope<{
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
    }>>("/messages", data);

    return unwrapEnvelope(response.data);
  },

  async completeJob(jobId: string) {
    const client = createClient();
    const response = await client.patch<ApiEnvelope<JobRecord>>(`/jobs/${jobId}/status`, {
      status: "COMPLETE"
    });
    return unwrapEnvelope(response.data);
  }
};
