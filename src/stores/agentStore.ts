import { create } from "zustand";
import type { Agent, AgentMessage, AgentStatus, JobStatus } from "../types";

type AgentStoreState = {
  agents: Map<string, Agent>;
  messages: AgentMessage[];
  jobStatus: JobStatus | null;
  lastMessage: AgentMessage | null;
  lastRevokedAgentId: string | null;
  setSnapshot: (agents: Agent[]) => void;
  setMessages: (messages: AgentMessage[]) => void;
  clearJobState: () => void;
  updateAgentStatus: (agentId: string, status: AgentStatus) => void;
  addMessage: (message: AgentMessage) => void;
  addAgent: (agent: Agent) => void;
  revokeAgentCascade: (agentId: string, cascade: string[]) => void;
  setJobStatus: (status: JobStatus) => void;
};

export const useAgentStore = create<AgentStoreState>((set) => ({
  agents: new Map<string, Agent>(),
  messages: [],
  jobStatus: null,
  lastMessage: null,
  lastRevokedAgentId: null,
  setSnapshot: (agents) =>
    set(() => ({
      agents: new Map(agents.map((agent) => [agent.id, agent])),
      lastRevokedAgentId: null
    })),
  setMessages: (messages) =>
    set(() => ({
      messages
    })),
  clearJobState: () =>
    set(() => ({
      agents: new Map<string, Agent>(),
      messages: [],
      jobStatus: null,
      lastMessage: null,
      lastRevokedAgentId: null
    })),
  updateAgentStatus: (agentId, status) =>
    set((state) => {
      const current = state.agents.get(agentId);
      if (!current) {
        return state;
      }
      const next = new Map(state.agents);
      next.set(agentId, { ...current, status });
      return { agents: next };
    }),
  addMessage: (message) =>
    set((state) => {
      const nextMessages = [message, ...state.messages.filter((entry) => entry.id !== message.id)];
      const nextAgents = new Map(state.agents);
      const sender = nextAgents.get(message.senderId);
      if (sender) {
        nextAgents.set(message.senderId, {
          ...sender,
          actionCount: sender.actionCount + 1,
          lastActionAt: message.createdAt
        });
      }
      return {
        agents: nextAgents,
        messages: nextMessages,
        lastMessage: message
      };
    }),
  addAgent: (agent) =>
    set((state) => {
      const next = new Map(state.agents);
      next.set(agent.id, agent);
      return { agents: next };
    }),
  revokeAgentCascade: (agentId, cascade) =>
    set((state) => {
      const next = new Map(state.agents);
      const ids = [agentId, ...cascade];
      for (const id of ids) {
        const agent = next.get(id);
        if (agent) {
          next.set(id, { ...agent, status: "REVOKED" });
        }
      }
      return {
        agents: next,
        lastRevokedAgentId: agentId
      };
    }),
  setJobStatus: (status) =>
    set(() => ({
      jobStatus: status
    }))
}));
