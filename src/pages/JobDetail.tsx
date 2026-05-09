import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import * as d3 from "d3";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { apiClient } from "../lib/axios";
import { runtimeConfig } from "../lib/runtimeConfig";
import { useWebSocket } from "../lib/websocket";
import {
  downloadJson,
  formatStatusLabel,
  statusColor,
  truncateMiddle,
  unwrapEnvelope
} from "../lib/utils";
import { useAgentStore } from "../stores/agentStore";
import { useSettingsStore } from "../stores/settingsStore";
import type { Agent, AgentMessage, AgentStatus, ApiEnvelope, GraphSnapshot, Job, MessagePage } from "../types";
import { DownloadIcon, ListIcon, ShareIcon, VerifiedIcon } from "../components/Icons";
import { ErrorCard, SkeletonBlock } from "../components/Feedback";

type TreeNodeDatum = {
  id: string;
  parentId: string | null;
  label: string;
  status: AgentStatus;
  type?: Agent["type"];
  human?: boolean;
};

type TreeBounds = {
  width: number;
  height: number;
};

function formatDurationSince(value: string) {
  const diffSeconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  const minutes = Math.floor(diffSeconds / 60);
  const seconds = diffSeconds % 60;
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }

  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

function formatLogTimestamp(value: string) {
  const date = new Date(value);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function dedupeMessages(messages: AgentMessage[]) {
  const seen = new Set<string>();
  return messages.filter((message) => {
    if (seen.has(message.id)) {
      return false;
    }
    seen.add(message.id);
    return true;
  });
}

function nodeCardSize(node: TreeNodeDatum) {
  if (node.human) {
    return { width: 190, height: 78 };
  }

  if (node.type === "PLANNER") {
    return { width: 260, height: 118 };
  }

  return { width: 168, height: 88 };
}

function nodeEyebrow(node: TreeNodeDatum) {
  if (node.human) {
    return "Human Intent";
  }

  if (node.type === "PLANNER") {
    return "Lead Planner";
  }

  return node.type ? node.type : "Executor";
}

function HierarchyTree({ jobId, ownerLabel }: { jobId: string; ownerLabel: string }) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [bounds, setBounds] = useState<TreeBounds>({ width: 920, height: 560 });
  const pollingIntervalMs = useSettingsStore((state) => state.pollingIntervalMs);
  const agentMap = useAgentStore((state) => state.agents);
  const liveAgents = useMemo(
    () => Array.from(agentMap.values()).filter((agent) => agent.jobId === jobId),
    [agentMap, jobId]
  );

  const graphQuery = useQuery({
    queryKey: ["graph", jobId],
    queryFn: async () =>
      unwrapEnvelope((await apiClient.get<ApiEnvelope<GraphSnapshot>>(`/graph/${jobId}`)).data),
    refetchInterval: runtimeConfig.enableRealtime ? false : pollingIntervalMs
  });

  useEffect(() => {
    const element = wrapperRef.current;
    if (!element) {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }

      setBounds({
        width: Math.max(560, entry.contentRect.width),
        height: Math.max(420, entry.contentRect.height)
      });
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const agents = liveAgents.length > 0 ? liveAgents : graphQuery.data?.nodes ?? [];
  const nodes: TreeNodeDatum[] = [
    {
      id: "human-root",
      parentId: null,
      label: ownerLabel,
      status: "ACTIVE",
      human: true
    },
    ...agents.map((agent) => ({
      id: agent.id,
      parentId: agent.parentAgentId ?? "human-root",
      label: agent.solSubName,
      status: agent.status,
      type: agent.type
    }))
  ];

  if (graphQuery.isLoading) {
    return <SkeletonBlock className="h-full rounded-[28px]" />;
  }

  if (graphQuery.isError) {
    return (
      <ErrorCard
        message={(graphQuery.error as Error).message || "Tree layout could not be loaded."}
        onRetry={() => void graphQuery.refetch()}
      />
    );
  }

  const stratified = d3
    .stratify<TreeNodeDatum>()
    .id((node) => node.id)
    .parentId((node) => node.parentId)(nodes);

  const layout = d3.tree<TreeNodeDatum>().nodeSize([220, 180]);
  const root = layout(stratified);
  const descendants = root.descendants();
  const xValues = descendants.map((node) => node.x);
  const minX = Math.min(...xValues);
  const maxX = Math.max(...xValues);
  const offsetX = bounds.width / 2 - (minX + maxX) / 2;
  const offsetY = 96;

  return (
    <div
      ref={wrapperRef}
      className="h-full w-full overflow-hidden rounded-[24px]"
      style={{
        background:
          "radial-gradient(circle at top, rgb(var(--tm-color-primary) / 0.06), transparent 45%), rgb(var(--tm-color-bg))"
      }}
    >
      <svg className="h-full w-full" viewBox={`0 0 ${bounds.width} ${bounds.height}`}>
        <defs>
          <filter id="treeShadow" x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="6" dy="6" stdDeviation="8" floodColor="rgba(15, 23, 42, 0.12)" />
          </filter>
        </defs>

        <g transform={`translate(${offsetX},${offsetY})`}>
          {root.links().map((link) => (
            <path
              key={`${link.source.id}-${link.target.id}`}
              d={`M ${link.source.x} ${link.source.y + nodeCardSize(link.source.data).height / 2} C ${link.source.x} ${(link.source.y + link.target.y) / 2} ${link.target.x} ${(link.source.y + link.target.y) / 2} ${link.target.x} ${link.target.y - nodeCardSize(link.target.data).height / 2}`}
              fill="none"
              stroke="rgb(var(--tm-color-primary) / 0.28)"
              strokeWidth="2"
              strokeOpacity="0.8"
            />
          ))}

          {descendants.map((node) => {
            const { width, height } = nodeCardSize(node.data);
            const borderColor =
              node.data.type === "PLANNER"
                ? "rgb(var(--tm-color-secondary))"
                : node.data.human
                  ? "rgb(var(--tm-color-primary) / 0.45)"
                  : statusColor(node.data.status);

            const accentText = node.data.type === "PLANNER" ? "text-silk-secondary" : "text-silk-primary";

            return (
              <motion.g
                key={node.id}
                transform={`translate(${node.x}, ${node.y})`}
                whileHover={{ scale: 1.03 }}
                style={{ transformOrigin: `${node.x}px ${node.y}px` }}
              >
                <rect
                  x={-width / 2}
                  y={-height / 2}
                  width={width}
                  height={height}
                  rx="22"
                  fill="rgb(var(--tm-color-surface))"
                  filter="url(#treeShadow)"
                />
                <rect
                  x={-width / 2}
                  y={-height / 2}
                  width={width}
                  height={height}
                  rx="22"
                  fill="none"
                  stroke={borderColor}
                  strokeOpacity={node.data.type === "PLANNER" ? 0.9 : 0.35}
                  strokeWidth={node.data.type === "PLANNER" ? 2.4 : 1.8}
                />
                <text
                  x="0"
                  y={-height / 2 + 24}
                  textAnchor="middle"
                  className={`fill-current text-[10px] font-bold uppercase tracking-[0.22em] ${accentText}`}
                >
                  {nodeEyebrow(node.data)}
                </text>
                <text
                  x="0"
                  y={node.data.type === "PLANNER" ? 6 : 2}
                  textAnchor="middle"
                  className="fill-silk-text-primary text-[15px] font-semibold"
                >
                  {truncateMiddle(node.data.label, node.data.type === "PLANNER" ? 18 : 14, 6)}
                </text>
                {!node.data.human ? (
                  <text
                    x="0"
                    y={node.data.type === "PLANNER" ? 34 : 26}
                    textAnchor="middle"
                    className="fill-silk-text-secondary text-[10px]"
                  >
                    {node.data.type === "PLANNER"
                      ? "Allocating resources for task sequence..."
                      : node.data.status === "ACTIVE"
                        ? "Running"
                        : formatStatusLabel(node.data.status)}
                  </text>
                ) : null}
              </motion.g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}

function CoordinationLog({
  jobId,
  onExport
}: {
  jobId: string;
  onExport: () => Promise<void>;
}) {
  const storedMessages = useAgentStore((state) => state.messages);
  const realtimeMessages = useMemo(
    () => storedMessages.filter((message) => message.jobId === jobId),
    [storedMessages, jobId]
  );
  const pollingIntervalMs = useSettingsStore((state) => state.pollingIntervalMs);

  const messagesQuery = useQuery({
    queryKey: ["messages-preview", jobId],
    enabled: Boolean(jobId),
    queryFn: async () =>
      unwrapEnvelope(
        (
          await apiClient.get<ApiEnvelope<MessagePage>>("/messages", {
            params: {
              jobId,
              limit: 12
            }
          })
        ).data
      ),
    refetchInterval: runtimeConfig.enableRealtime ? false : pollingIntervalMs
  });

  const messages = dedupeMessages([...(messagesQuery.data?.items ?? []), ...realtimeMessages])
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, 10);

  return (
    <div className="tm-shell-card flex h-full flex-col overflow-hidden">
      <div className="border-b border-white/60 px-6 py-5">
        <h3 className="flex items-center gap-3 text-2xl font-semibold tracking-tight text-silk-text-primary">
          <ListIcon className="h-5 w-5 text-silk-primary" />
          <span>Coordination Log</span>
        </h3>
      </div>

      <div className="silk-scrollbar flex-1 space-y-6 overflow-y-auto px-6 py-6">
        {messagesQuery.isLoading ? (
          <>
            <SkeletonBlock className="h-28 rounded-[24px]" />
            <SkeletonBlock className="h-28 rounded-[24px]" />
            <SkeletonBlock className="h-28 rounded-[24px]" />
          </>
        ) : messagesQuery.isError ? (
          <ErrorCard
            message={(messagesQuery.error as Error).message || "Message history could not be loaded."}
            onRetry={() => void messagesQuery.refetch()}
          />
        ) : messages.length > 0 ? (
          messages.map((message, index) => (
            <div key={message.id} className="relative pl-6">
              <div className="absolute left-0 top-1 h-full w-px bg-silk-primary/20" />
              <div
                className={
                  index === 0
                    ? "absolute -left-[7px] top-1 h-4 w-4 rounded-full border-4 border-silk-bg bg-silk-primary shadow-[0_0_0_6px_rgba(99,102,241,0.12)]"
                    : "absolute -left-[7px] top-1 h-4 w-4 rounded-full border-4 border-silk-bg bg-silk-primary/70"
                }
              />
              <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-silk-text-tertiary">
                {formatLogTimestamp(message.createdAt)} • {message.verified ? "Verification Success" : "Pending Review"}
              </div>
              <div
                className={
                  index === 0
                    ? "mt-3 rounded-[22px] border border-silk-primary/20 bg-silk-bg px-4 py-4 shadow-neoInset"
                    : "mt-3 rounded-[22px] border border-white/70 bg-silk-bg px-4 py-4 shadow-neoInset"
                }
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="text-sm font-semibold text-silk-text-primary">
                    {message.senderName} → {message.receiverName ?? "broadcast"}
                  </div>
                  {message.verified ? (
                    <VerifiedIcon className="h-4 w-4 shrink-0 text-emerald-500" />
                  ) : null}
                </div>
                <div className="mt-2 text-sm leading-7 text-silk-text-secondary">
                  {message.action}
                </div>
                <button
                  className="mt-3 font-mono text-[11px] text-silk-primary"
                  onClick={() =>
                    window.open(
                      `https://explorer.solana.com/tx/${message.txHash}`,
                      "_blank",
                      "noopener,noreferrer"
                    )
                  }
                >
                  tx: {truncateMiddle(message.txHash, 8, 4)}
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-[24px] border border-white/70 bg-silk-bg px-5 py-6 text-sm text-silk-text-secondary shadow-neoInset">
            No coordination events have been recorded for this job yet.
          </div>
        )}
      </div>

      <div className="border-t border-white/60 px-6 py-4 text-center">
        <button className="text-xs font-bold uppercase tracking-[0.18em] text-silk-primary" onClick={() => void onExport()}>
          View full historical ledger
        </button>
      </div>
    </div>
  );
}

export function JobDetail() {
  const { id } = useParams();
  const jobId = id ?? "";
  const [copied, setCopied] = useState(false);
  const pollingIntervalMs = useSettingsStore((state) => state.pollingIntervalMs);
  useWebSocket({ jobId, enabled: Boolean(jobId) });

  const jobQuery = useQuery({
    queryKey: ["job", jobId],
    enabled: Boolean(jobId),
    queryFn: async () =>
      unwrapEnvelope((await apiClient.get<ApiEnvelope<Job>>(`/jobs/${jobId}`)).data),
    refetchInterval: runtimeConfig.enableRealtime ? false : pollingIntervalMs
  });

  const exportAuditLog = async () => {
    const payload = unwrapEnvelope(
      (
        await apiClient.get<ApiEnvelope<{ items: unknown[]; nextCursor: string | null }>>("/messages", {
          params: { jobId, limit: 200 }
        })
      ).data
    );
    downloadJson(`trustmesh-job-${jobId}.json`, payload.items);
  };

  const shareJob = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const job = jobQuery.data;
  const activeCount = job?.activeAgentCount ?? 0;
  const totalCount = job?.agentCount ?? 0;

  return (
    <div className="min-h-[calc(100vh-5rem)] p-4 pb-24 md:p-6 lg:p-8">
      <div className="mx-auto max-w-[1400px] space-y-6">
        <section className="tm-shell-card px-6 py-6 md:px-8">
          {jobQuery.isLoading ? (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
              <SkeletonBlock className="h-24 rounded-[26px]" />
              <div className="grid grid-cols-2 gap-4">
                <SkeletonBlock className="h-24 rounded-[26px]" />
                <SkeletonBlock className="h-24 rounded-[26px]" />
              </div>
            </div>
          ) : job ? (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
              <div>
                <div className="text-base font-medium text-silk-text-secondary">Job ID</div>
                <h1 className="mt-2 text-4xl font-semibold tracking-tight text-silk-text-primary">
                  #{job.onchainId}
                </h1>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <span className="rounded-full border border-white/70 bg-silk-bg px-4 py-2 text-sm font-semibold text-silk-primary shadow-neoInset">
                    {job.ownerSolName ?? "mesh.sol"}
                  </span>
                  <span
                    className="rounded-full border border-white/70 bg-silk-bg px-4 py-2 text-sm font-semibold shadow-neoInset"
                    style={{ color: statusColor(job.status) }}
                  >
                    {formatStatusLabel(job.status)}
                  </span>
                </div>
                <p className="mt-4 max-w-2xl text-sm leading-8 text-silk-text-secondary">
                  {job.description}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="tm-shell-card px-5 py-4">
                  <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-silk-text-tertiary">
                    Duration
                  </div>
                  <div className="mt-3 text-3xl font-semibold tracking-tight text-silk-text-primary">
                    {formatDurationSince(job.createdAt)}
                  </div>
                </div>
                <div className="tm-shell-card px-5 py-4">
                  <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-silk-text-tertiary">
                    Nodes Active
                  </div>
                  <div className="mt-3 text-3xl font-semibold tracking-tight text-silk-primary">
                    {activeCount} / {totalCount}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="tm-shell-card p-6 md:p-8">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-silk-text-primary">
                  Decision Tree Visualization
                </h2>
                <p className="mt-2 text-sm text-silk-text-secondary">
                  Live view of delegated planners and executors for this active job.
                </p>
              </div>
            </div>

            <div className="mt-6 h-[560px]">
              {jobQuery.isError ? (
                <ErrorCard
                  message={(jobQuery.error as Error).message || "Job details could not be loaded."}
                  onRetry={() => void jobQuery.refetch()}
                />
              ) : jobId ? (
                <HierarchyTree jobId={jobId} ownerLabel={job?.ownerSolName ?? "mesh.sol"} />
              ) : null}
            </div>
          </div>

          {jobId ? <CoordinationLog jobId={jobId} onExport={exportAuditLog} /> : null}
        </section>

        <footer className="tm-shell-card flex flex-col items-start justify-between gap-4 px-6 py-4 md:flex-row md:items-center">
          <button
            disabled
            className="rounded-full border border-red-200 bg-red-50 px-5 py-3 text-sm font-semibold text-red-400 opacity-80"
            title="Bulk revoke is not wired in the API yet."
          >
            Revoke All Agents
          </button>

          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <button className="tm-button-ghost gap-2" onClick={() => void exportAuditLog()}>
              <DownloadIcon className="h-4 w-4" />
              <span>Export Audit Log as JSON</span>
            </button>
            <button className="tm-button-ghost gap-2" onClick={() => void shareJob()}>
              <ShareIcon className="h-4 w-4" />
              <span>{copied ? "Link Copied" : "Share Link"}</span>
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
