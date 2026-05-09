import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../lib/axios";
import { runtimeConfig } from "../lib/runtimeConfig";
import { useWebSocket } from "../lib/websocket";
import {
  formatStatusLabel,
  statusColor,
  truncateMiddle,
  unwrapEnvelope
} from "../lib/utils";
import type { ApiEnvelope, GlobalStats, Job } from "../types";
import { ForceGraph } from "../components/ForceGraph";
import { NodeDetailPanel } from "../components/NodeDetailPanel";
import { ErrorCard, SkeletonBlock } from "../components/Feedback";
import { useSettingsStore } from "../stores/settingsStore";

type JobFilter = "ALL" | "ACTIVE" | "REVOKED";

const filters: JobFilter[] = ["ALL", "ACTIVE", "REVOKED"];

export function Explorer() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<JobFilter>("ALL");
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const pollingIntervalMs = useSettingsStore((state) => state.pollingIntervalMs);

  const jobsQuery = useQuery({
    queryKey: ["jobs", filter],
    queryFn: async () =>
      unwrapEnvelope(
        (
          await apiClient.get<ApiEnvelope<Job[]>>("/jobs", {
            params: {
              status: filter === "ALL" ? undefined : filter
            }
          })
        ).data
      ),
    refetchInterval: runtimeConfig.enableRealtime ? false : pollingIntervalMs
  });

  const statsQuery = useQuery({
    queryKey: ["global-stats"],
    queryFn: async () =>
      unwrapEnvelope((await apiClient.get<ApiEnvelope<GlobalStats>>("/stats/global")).data),
    refetchInterval: 30_000
  });

  useEffect(() => {
    if (!selectedJobId && jobsQuery.data && jobsQuery.data.length > 0) {
      setSelectedJobId(jobsQuery.data[0].id);
    }
  }, [jobsQuery.data, selectedJobId]);

  useWebSocket({ jobId: selectedJobId, enabled: Boolean(selectedJobId) });

  return (
    <div className="min-h-[calc(100vh-5rem)] overflow-hidden p-4 pb-24 md:p-6 lg:p-8">
      <div className="flex h-[calc(100vh-9rem)] min-h-[680px] gap-5">
        <aside className="tm-shell-card flex w-[260px] flex-col p-4">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-silk-text-primary">Jobs</h2>
            <div className="mt-4 flex gap-2">
              {filters.map((value) => (
                <button
                  key={value}
                  className={
                    value === filter
                      ? "neo-pill-inset px-3 py-2 text-xs font-semibold text-silk-primary"
                      : "neo-pill px-3 py-2 text-xs font-semibold text-silk-text-secondary"
                  }
                  onClick={() => setFilter(value)}
                >
                  {value === "ALL" ? "All" : formatStatusLabel(value)}
                </button>
              ))}
            </div>
          </div>

          <div className="silk-scrollbar flex-1 space-y-3 overflow-y-auto pr-1">
            {jobsQuery.isLoading ? (
              <>
                <SkeletonBlock className="h-24 rounded-[20px]" />
                <SkeletonBlock className="h-24 rounded-[20px]" />
                <SkeletonBlock className="h-24 rounded-[20px]" />
              </>
            ) : jobsQuery.isError ? (
              <ErrorCard
                message={(jobsQuery.error as Error).message || "Job list could not be loaded."}
                onRetry={() => void jobsQuery.refetch()}
              />
            ) : (
              jobsQuery.data?.map((job) => {
                const selected = job.id === selectedJobId;
                return (
                  <button
                    key={job.id}
                    className={
                      selected
                        ? "neo-inset relative w-full rounded-[22px] p-4 text-left"
                        : "neo-raised relative w-full rounded-[22px] p-4 text-left"
                    }
                    onClick={() => {
                      setSelectedJobId(job.id);
                      setSelectedNodeId(null);
                    }}
                  >
                    {selected ? (
                      <span
                        className="absolute left-0 top-4 h-12 w-1 rounded-r-full"
                        style={{ backgroundColor: "rgb(var(--tm-color-primary))" }}
                      />
                    ) : null}
                    <div className="font-mono text-[11px] text-silk-text-tertiary">
                      {truncateMiddle(job.onchainId, 6, 4)}
                    </div>
                    <div className="mt-2 text-sm font-semibold text-silk-text-primary">
                      {job.ownerSolName ?? "Unknown owner"}
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs">
                      <span style={{ color: statusColor(job.status) }}>{formatStatusLabel(job.status)}</span>
                      <Link
                        to={`/jobs/${job.id}`}
                        className="font-medium text-silk-primary"
                        onClick={(event) => event.stopPropagation()}
                      >
                        Open
                      </Link>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <button
            className="neo-button mt-4 px-4 py-3 text-sm font-semibold text-silk-primary"
            onClick={() => navigate("/deploy")}
          >
            New Job
          </button>
        </aside>

        <main className="tm-shell-card relative flex-1 overflow-hidden">
          <div className="absolute right-5 top-5 z-10 flex gap-3">
            {statsQuery.isLoading ? (
              <>
                <SkeletonBlock className="h-11 w-36 rounded-full" />
                <SkeletonBlock className="h-11 w-36 rounded-full" />
              </>
            ) : statsQuery.data ? (
              <>
                <div className="neo-pill text-sm font-semibold text-silk-text-primary">
                  {statsQuery.data.activeJobs} active
                </div>
                <div className="neo-pill text-sm font-semibold text-silk-text-primary">
                  {statsQuery.data.totalAgents} agents
                </div>
                <div className="neo-pill text-sm font-semibold text-silk-text-primary">
                  {statsQuery.data.unauthorizedActions} breaches
                </div>
              </>
            ) : null}
          </div>

          {selectedJobId ? (
            <ForceGraph jobId={selectedJobId} onNodeClick={(agentId) => setSelectedNodeId(agentId)} />
          ) : (
            <div className="flex h-full items-center justify-center p-8">
              <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                className="neo-raised max-w-md p-8 text-center"
              >
                <h3 className="text-xl font-semibold text-silk-text-primary">No job selected</h3>
                <p className="mt-3 text-sm leading-7 text-silk-text-secondary">
                  Choose an active audit job from the left rail or create a new deployment.
                </p>
              </motion.div>
            </div>
          )}
        </main>
      </div>

      <NodeDetailPanel agentId={selectedNodeId} onClose={() => setSelectedNodeId(null)} />
    </div>
  );
}
