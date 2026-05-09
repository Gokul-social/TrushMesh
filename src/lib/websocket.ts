import { useEffect, useRef, useState } from "react";
import { getJwtFromLocalStorage } from "./utils";
import { runtimeConfig } from "./runtimeConfig";
import { useAgentStore } from "../stores/agentStore";
import type { Agent, AgentMessage, AgentStatus, JobStatus, WsEvent } from "../types";

type UseWebSocketOptions = {
  jobId: string | null;
  enabled?: boolean;
};

type UseWebSocketResult = {
  connected: boolean;
  lastMessage: WsEvent | null;
  sendMessage: (message: string) => void;
};

function isAgentStatus(value: string): value is AgentStatus {
  return value === "ACTIVE" || value === "WARNING" || value === "REVOKED" || value === "COMPLETE";
}

function isJobStatus(value: string): value is JobStatus {
  return value === "PENDING" || value === "ACTIVE" || value === "COMPLETE" || value === "REVOKED";
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isAgent(value: unknown): value is Agent {
  return (
    isObject(value) &&
    typeof value.id === "string" &&
    typeof value.jobId === "string" &&
    typeof value.solSubName === "string" &&
    typeof value.label === "string" &&
    typeof value.parentAgentId !== "undefined" &&
    typeof value.actionCount === "number" &&
    typeof value.createdAt === "string" &&
    typeof value.type === "string" &&
    typeof value.status === "string"
  );
}

function isMessage(value: unknown): value is AgentMessage {
  return (
    isObject(value) &&
    typeof value.id === "string" &&
    typeof value.jobId === "string" &&
    typeof value.senderId === "string" &&
    typeof value.senderName === "string" &&
    typeof value.action === "string" &&
    typeof value.txHash === "string" &&
    typeof value.signatureHex === "string" &&
    typeof value.verified === "boolean" &&
    typeof value.createdAt === "string"
  );
}

function parseEvent(raw: string): WsEvent | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!isObject(parsed) || typeof parsed.type !== "string") {
    return null;
  }

  if (parsed.type === "SNAPSHOT") {
    if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges) || !parsed.nodes.every(isAgent)) {
      return null;
    }
    return { type: "SNAPSHOT", nodes: parsed.nodes, edges: parsed.edges as WsEvent extends infer _T ? never : never };
  }

  if (parsed.type === "AGENT_STATUS_CHANGE") {
    if (typeof parsed.agentId === "string" && typeof parsed.status === "string" && isAgentStatus(parsed.status)) {
      return { type: "AGENT_STATUS_CHANGE", agentId: parsed.agentId, status: parsed.status };
    }
    return null;
  }

  if (parsed.type === "NEW_MESSAGE" && isMessage(parsed.message)) {
    return { type: "NEW_MESSAGE", message: parsed.message };
  }

  if (parsed.type === "AGENT_SPAWNED" && isAgent(parsed.agent)) {
    return { type: "AGENT_SPAWNED", agent: parsed.agent };
  }

  if (parsed.type === "AGENT_REVOKED") {
    if (typeof parsed.agentId === "string" && Array.isArray(parsed.cascade) && parsed.cascade.every((item) => typeof item === "string")) {
      return { type: "AGENT_REVOKED", agentId: parsed.agentId, cascade: parsed.cascade };
    }
    return null;
  }

  if (parsed.type === "JOB_COMPLETE" && typeof parsed.jobId === "string") {
    return { type: "JOB_COMPLETE", jobId: parsed.jobId };
  }

  return null;
}

function parseSnapshotEdges(value: unknown): Array<{ id: string; source: string; target: string; type: "DELEGATION" }> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(
      (item): item is { id: string; source: string; target: string; type: "DELEGATION" } =>
        isObject(item) &&
        typeof item.id === "string" &&
        typeof item.source === "string" &&
        typeof item.target === "string" &&
        item.type === "DELEGATION"
    )
    .map((item) => ({ ...item }));
}

export function useWebSocket({ jobId, enabled = true }: UseWebSocketOptions): UseWebSocketResult {
  const [connected, setConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WsEvent | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const reconnectDelayRef = useRef(1000);
  const shouldReconnectRef = useRef(true);

  const setSnapshot = useAgentStore((state) => state.setSnapshot);
  const updateAgentStatus = useAgentStore((state) => state.updateAgentStatus);
  const addMessage = useAgentStore((state) => state.addMessage);
  const addAgent = useAgentStore((state) => state.addAgent);
  const revokeAgentCascade = useAgentStore((state) => state.revokeAgentCascade);
  const setJobStatus = useAgentStore((state) => state.setJobStatus);
  const clearJobState = useAgentStore((state) => state.clearJobState);

  useEffect(() => {
    if (!enabled || !jobId) {
      setConnected(false);
      clearJobState();
      return;
    }

    if (!runtimeConfig.enableRealtime) {
      setConnected(false);
      return;
    }

    const token = getJwtFromLocalStorage();
    if (!token) {
      setConnected(false);
      return;
    }

    shouldReconnectRef.current = true;
    const endpoint = new URL(runtimeConfig.webSocketUrl);
    endpoint.searchParams.set("jobId", jobId);
    endpoint.searchParams.set("token", token);

    const connect = () => {
      const socket = new WebSocket(endpoint);
      socketRef.current = socket;

      socket.onopen = () => {
        reconnectDelayRef.current = 1000;
        setConnected(true);
      };

      socket.onmessage = (event) => {
        const parsed = parseEvent(event.data);
        if (!parsed) {
          const snapshotFallback = JSON.parse(event.data) as { type?: string; nodes?: unknown; edges?: unknown };
          if (snapshotFallback.type === "SNAPSHOT" && Array.isArray(snapshotFallback.nodes)) {
            setSnapshot(snapshotFallback.nodes.filter(isAgent));
            parseSnapshotEdges(snapshotFallback.edges);
          }
          return;
        }

        setLastMessage(parsed);
        if (parsed.type === "SNAPSHOT") {
          setSnapshot(parsed.nodes);
        } else if (parsed.type === "AGENT_STATUS_CHANGE") {
          updateAgentStatus(parsed.agentId, parsed.status);
        } else if (parsed.type === "NEW_MESSAGE") {
          addMessage(parsed.message);
        } else if (parsed.type === "AGENT_SPAWNED") {
          addAgent(parsed.agent);
        } else if (parsed.type === "AGENT_REVOKED") {
          revokeAgentCascade(parsed.agentId, parsed.cascade);
        } else if (parsed.type === "JOB_COMPLETE") {
          setJobStatus("COMPLETE");
        }
      };

      socket.onclose = () => {
        setConnected(false);
        socketRef.current = null;

        if (!shouldReconnectRef.current) {
          return;
        }

        const nextDelay = reconnectDelayRef.current;
        reconnectTimerRef.current = window.setTimeout(() => {
          connect();
        }, nextDelay);
        reconnectDelayRef.current = Math.min(nextDelay * 2, 30000);
      };

      socket.onerror = () => {
        socket.close();
      };
    };

    connect();

    return () => {
      shouldReconnectRef.current = false;
      setConnected(false);
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
      }
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [
    addAgent,
    addMessage,
    clearJobState,
    enabled,
    jobId,
    revokeAgentCascade,
    setJobStatus,
    setSnapshot,
    updateAgentStatus
  ]);

  return {
    connected,
    lastMessage,
    sendMessage: (message) => {
      socketRef.current?.send(message);
    }
  };
}
