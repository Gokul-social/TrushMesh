import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import * as d3 from "d3";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { apiClient } from "../lib/axios";
import { runtimeConfig } from "../lib/runtimeConfig";
import { useWebSocket } from "../lib/websocket";
import { downloadJson, formatStatusLabel, statusColor, unwrapEnvelope } from "../lib/utils";
import { useAgentStore } from "../stores/agentStore";
import type { Agent, AgentStatus, ApiEnvelope, GraphSnapshot, Job } from "../types";
import { MessageTimeline } from "../components/MessageTimeline";
import { ErrorCard, SkeletonBlock } from "../components/Feedback";
import { PersonIcon, RobotIcon } from "../components/Icons";

type TreeNodeDatum = {
  id: string;
  parentId: string | null;
  label: string;
  status: AgentStatus;
  human?: boolean;
};

type TreeBounds = {
  width: number;
  height: number;
};

function HierarchyTree({ jobId, ownerLabel }: { jobId: string; ownerLabel: string }) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [bounds, setBounds] = useState<TreeBounds>({ width: 900, height: 380 });
  const liveAgents = useAgentStore((state) =>
    Array.from(state.agents.values()).filter((agent) => agent.jobId === jobId)
  );

  const graphQuery = useQuery({
    queryKey: ["graph", jobId],
    queryFn: async () =>
      unwrapEnvelope(
        (
          await apiClient.get<ApiEnvelope<GraphSnapshot>>(`/graph/${jobId}`)
        ).data
      ),
    refetchInterval: runtimeConfig.enableRealtime ? false : runtimeConfig.pollingIntervalMs
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
        width: Math.max(400, entry.contentRect.width),
        height: Math.max(280, entry.contentRect.height)
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
      status: agent.status
    }))
  ];

  if (graphQuery.isLoading) {
    return <SkeletonBlock className="h-full rounded-[24px]" />;
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
  const layout = d3.tree<TreeNodeDatum>().size([bounds.width - 120, bounds.height - 100]);
  const root = layout(stratified);

  return (
    <div ref={wrapperRef} className="h-full w-full">
      <svg className="h-full w-full" viewBox={`0 0 ${bounds.width} ${bounds.height}`}>
        <g transform="translate(60,40)">
          {root.links().map((link) => (
            <g key={`${link.source.id}-${link.target.id}`}>
              <path
                d={`M ${link.source.x} ${link.source.y} C ${link.source.x} ${(link.source.y + link.target.y) / 2} ${link.target.x} ${(link.source.y + link.target.y) / 2} ${link.target.x} ${link.target.y}`}
                fill="none"
                stroke="#6366f1"
                strokeOpacity="0.25"
                strokeWidth="1.5"
              />
              <text
                x={(link.source.x + link.target.x) / 2}
                y={(link.source.y + link.target.y) / 2 - 8}
                textAnchor="middle"
                className="fill-silk-text-tertiary font-mono text-[10px]"
              >
                delegates
              </text>
            </g>
          ))}

          {root.descendants().map((node) => (
            <motion.g
              key={node.id}
              transform={`translate(${node.x}, ${node.y})`}
              whileHover={{ scale: 1.08 }}
            >
              <circle r="28" fill="#e8eaf0" filter="url(#treeShadow)" />
              <circle r="28" fill="none" stroke={statusColor(node.data.status)} strokeWidth="3" />
              <g transform="translate(-7,-7)">
                {node.data.human ? (
                  <PersonIcon className="h-[14px] w-[14px] text-silk-primary" />
                ) : (
                  <RobotIcon className="h-[14px] w-[14px] text-silk-primary" />
                )}
              </g>
              <text
                y="46"
                textAnchor="middle"
                className="fill-silk-text-secondary font-mono text-[10px]"
              >
                {node.data.label}
              </text>
            </motion.g>
          ))}
        </g>
        <defs>
          <filter id="treeShadow" x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="4" dy="4" stdDeviation="5" floodColor="rgba(0,0,0,0.12)" />
          </filter>
        </defs>
      </svg>
    </div>
  );
}

export function JobDetail() {
  const { id } = useParams();
  const jobId = id ?? "";
  useWebSocket({ jobId, enabled: Boolean(jobId) });

  const jobQuery = useQuery({
    queryKey: ["job", jobId],
    enabled: Boolean(jobId),
    queryFn: async () =>
      unwrapEnvelope((await apiClient.get<ApiEnvelope<Job>>(`/jobs/${jobId}`)).data),
    refetchInterval: runtimeConfig.enableRealtime ? false : runtimeConfig.pollingIntervalMs
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

  return (
    <div className="h-screen overflow-hidden bg-silk-bg px-5 pb-5 pt-20">
      <div className="grid h-[calc(100vh-5rem)] grid-rows-[auto_minmax(0,1fr)] gap-5">
        <header className="neo-raised flex flex-wrap items-center justify-between gap-4 px-6 py-5">
          {jobQuery.isLoading ? (
            <SkeletonBlock className="h-12 w-96 rounded-[20px]" />
          ) : jobQuery.data ? (
            <div>
              <div className="text-2xl font-semibold text-silk-text-primary">
                Job #{jobQuery.data.onchainId} | {jobQuery.data.ownerSolName ?? "owner.sol"} |{" "}
                <span style={{ color: statusColor(jobQuery.data.status) }}>
                  {formatStatusLabel(jobQuery.data.status)}
                </span>
              </div>
              <p className="mt-2 text-sm text-silk-text-secondary">{jobQuery.data.description}</p>
            </div>
          ) : null}

          <button className="neo-button px-4 py-3 text-sm font-semibold text-silk-primary" onClick={() => void exportAuditLog()}>
            Export Audit Log
          </button>
        </header>

        <div className="grid min-h-0 grid-rows-2 gap-5">
          <section className="neo-raised min-h-0 p-4">
            {jobQuery.isError ? (
              <ErrorCard
                message={(jobQuery.error as Error).message || "Job details could not be loaded."}
                onRetry={() => void jobQuery.refetch()}
              />
            ) : jobId ? (
              <HierarchyTree jobId={jobId} ownerLabel={jobQuery.data?.ownerSolName ?? "Human Owner"} />
            ) : null}
          </section>

          <section className="neo-raised min-h-0 p-4">
            {jobId ? <MessageTimeline jobId={jobId} /> : null}
          </section>
        </div>
      </div>
    </div>
  );
}
