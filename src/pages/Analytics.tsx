import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import {
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { apiClient } from "../lib/axios";
import { formatRelativeTime, truncateMiddle, unwrapEnvelope } from "../lib/utils";
import type { ApiEnvelope, GlobalStats, Job, JobStatus } from "../types";
import { AnalyticsIcon, InfoIcon, WarningIcon } from "../components/Icons";
import { ErrorCard, SkeletonBlock } from "../components/Feedback";

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

function StatCard({
  title,
  value,
  caption,
  tone = "primary",
  pulse = false
}: {
  title: string;
  value: string;
  caption: string;
  tone?: "primary" | "warning" | "success" | "default";
  pulse?: boolean;
}) {
  const toneClass =
    tone === "warning"
      ? "text-amber-500"
      : tone === "success"
        ? "text-emerald-500"
        : tone === "default"
          ? "text-silk-text-primary"
          : "text-silk-primary";

  return (
    <div className="tm-control-surface rounded-[26px] px-5 py-5">
      <div className="flex items-center gap-2">
        <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-silk-text-tertiary">{title}</div>
        {pulse && (
          <span className="inline-flex h-2 w-2 rounded-full bg-silk-primary opacity-80" />
        )}
      </div>
      <div className={`mt-3 text-3xl font-semibold tracking-tight ${toneClass}`}>{value}</div>
      <p className="mt-3 text-sm leading-7 text-silk-text-secondary">{caption}</p>
    </div>
  );
}

const STATUS_COLORS: Record<JobStatus, string> = {
  ACTIVE: "#6366f1",
  COMPLETE: "#10b981",
  REVOKED: "#ef4444",
  PENDING: "#f59e0b"
};

function StatusBadge({ status }: { status: JobStatus }) {
  const cls: Record<JobStatus, string> = {
    ACTIVE: "bg-indigo-100 text-indigo-700",
    COMPLETE: "bg-emerald-100 text-emerald-700",
    REVOKED: "bg-red-100 text-red-600",
    PENDING: "bg-amber-100 text-amber-700"
  };
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${cls[status]}`}>
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

export function Analytics() {
  const navigate = useNavigate();

  const statsQuery = useQuery({
    queryKey: ["global-stats"],
    queryFn: async () =>
      unwrapEnvelope((await apiClient.get<ApiEnvelope<GlobalStats>>("/stats/global")).data),
    refetchInterval: 30_000
  });

  const jobsQuery = useQuery({
    queryKey: ["jobs-all"],
    queryFn: async () =>
      unwrapEnvelope(
        (await apiClient.get<ApiEnvelope<Job[]>>("/jobs", { params: { limit: 200 } })).data
      ),
    refetchInterval: 30_000
  });

  const stats = statsQuery.data;
  const jobs = jobsQuery.data ?? [];

  const pieData = (["ACTIVE", "COMPLETE", "REVOKED", "PENDING"] as JobStatus[])
    .map((s) => ({ name: s.charAt(0) + s.slice(1).toLowerCase(), value: jobs.filter((j) => j.status === s).length, color: STATUS_COLORS[s] }))
    .filter((d) => d.value > 0);

  const topJobs = [...jobs].sort((a, b) => (b.agentCount ?? 0) - (a.agentCount ?? 0)).slice(0, 10);

  const lastUpdated = statsQuery.dataUpdatedAt
    ? formatRelativeTime(new Date(statsQuery.dataUpdatedAt).toISOString())
    : null;

  const isLoading = statsQuery.isLoading || jobsQuery.isLoading;

  return (
    <div className="min-h-[calc(100vh-5rem)] p-4 pb-24 md:p-6 lg:p-8">
      <div className="mx-auto max-w-[1500px] space-y-6">
        {/* Hero */}
        <section className="tm-shell-card tm-grid-bg overflow-hidden px-6 py-6 md:px-8">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-end">
            <div>
              <div className="tm-kicker">Telemetry</div>
              <h1 className="mt-5 text-4xl font-semibold tracking-tight text-silk-text-primary md:text-5xl">
                TrustMesh analytics
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-8 text-silk-text-secondary">
                Real-time metrics across all jobs, agents, and coordination messages on the platform.
              </p>
            </div>
            <div className="flex items-center justify-between xl:justify-end">
              <div className="tm-control-surface rounded-[20px] px-4 py-3">
                <div className="flex items-center gap-2">
                  <AnalyticsIcon className="h-4 w-4 text-silk-primary" />
                  <div className="text-sm font-semibold text-silk-text-primary">Live dashboard</div>
                </div>
                {lastUpdated && (
                  <p className="mt-1 text-xs text-silk-text-tertiary">Updated {lastUpdated}</p>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Stat cards */}
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonBlock key={i} className="h-36 rounded-[28px]" />
            ))}
          </div>
        ) : statsQuery.isError ? (
          <ErrorCard
            message={(statsQuery.error as Error).message || "Analytics could not be loaded."}
            onRetry={() => void statsQuery.refetch()}
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title="Total Jobs"
              value={String(jobs.length)}
              caption="All jobs across all statuses."
              tone="default"
            />
            <StatCard
              title="Active Agents"
              value={String(stats?.totalAgents ?? 0)}
              caption="Currently deployed across all running jobs."
              tone="primary"
              pulse
            />
            <StatCard
              title="Messages Logged"
              value={String(stats?.totalMessages ?? 0)}
              caption="Total signed delegation events recorded."
              tone="success"
            />
            <StatCard
              title="Unauthorized Actions"
              value={String(stats?.unauthorizedActions ?? 0)}
              caption="Flagged actions that failed verification."
              tone="warning"
            />
          </div>
        )}

        {/* Charts row */}
        <div className="grid gap-6 xl:grid-cols-2">
          {/* Pie chart */}
          <div className="tm-shell-card p-6">
            <h2 className="text-base font-semibold text-silk-text-primary">Job Status Distribution</h2>
            <p className="mt-1 text-sm text-silk-text-secondary">Breakdown of all jobs by current status.</p>

            {jobsQuery.isLoading ? (
              <SkeletonBlock className="mt-6 h-64 rounded-[20px]" />
            ) : jobsQuery.isError ? (
              <ErrorCard
                message="Job distribution could not be loaded."
                onRetry={() => void jobsQuery.refetch()}
              />
            ) : pieData.length === 0 ? (
              <div className="mt-8 flex flex-col items-center py-8 text-center">
                <AnalyticsIcon className="h-12 w-12 text-silk-text-tertiary" />
                <p className="mt-3 text-sm text-silk-text-secondary">No jobs yet. Deploy your first job to see the chart.</p>
                <Link to="/deploy" className="neo-button mt-4 text-sm">Go to Deployer</Link>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {pieData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "rgb(var(--tm-color-bg))",
                      border: "none",
                      borderRadius: "14px",
                      boxShadow: "var(--tm-shadow-neo)",
                      fontSize: "13px"
                    }}
                  />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    formatter={(value) => <span className="text-sm text-silk-text-secondary">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Line chart placeholder */}
          <div className="tm-shell-card p-6">
            <h2 className="text-base font-semibold text-silk-text-primary">Agent Activity Timeline</h2>
            <p className="mt-1 text-sm text-silk-text-secondary">Message events over the last 24 hours.</p>

            {jobs.length > 0 ? (
              <ActivityChart jobId={jobs.find((j) => j.status === "ACTIVE")?.id ?? jobs[0].id} />
            ) : (
              <div className="mt-8 flex flex-col items-center py-8 text-center">
                <InfoIcon className="h-12 w-12 text-silk-text-tertiary" />
                <p className="mt-3 text-sm text-silk-text-secondary">
                  Open a job in the Explorer to view its message activity timeline.
                </p>
                <Link to="/explorer" className="neo-button mt-4 text-sm">Go to Explorer</Link>
              </div>
            )}
          </div>
        </div>

        {/* Top jobs table */}
        <section className="tm-shell-card overflow-hidden">
          <div className="border-b border-white/20 px-6 py-4">
            <h2 className="text-base font-semibold text-silk-text-primary">Top Active Jobs</h2>
            <p className="mt-0.5 text-sm text-silk-text-secondary">Sorted by agent count, showing top 10.</p>
          </div>

          {jobsQuery.isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <SkeletonBlock key={i} className="h-14 rounded-[16px]" />
              ))}
            </div>
          ) : topJobs.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-12 text-center">
              <AnalyticsIcon className="h-12 w-12 text-silk-text-tertiary" />
              <h3 className="mt-4 text-base font-semibold text-silk-text-primary">No jobs yet</h3>
              <p className="mt-2 text-sm text-silk-text-secondary">Deploy your first job to see analytics.</p>
              <Link to="/deploy" className="neo-button mt-5 text-sm">Go to Deployer</Link>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-4 border-b border-white/10 px-6 py-2.5 text-[11px] font-bold uppercase tracking-[0.18em] text-silk-text-tertiary">
                <span>Job ID / Owner</span>
                <span className="hidden sm:block">Agents</span>
                <span className="hidden md:block">Status</span>
                <span className="hidden lg:block">Created</span>
                <span>Actions</span>
              </div>
              {topJobs.map((job) => (
                <button
                  key={job.id}
                  type="button"
                  onClick={() => navigate(`/jobs/${job.id}`)}
                  className="grid w-full grid-cols-[1fr_auto_auto_auto_auto] items-center gap-x-4 border-b border-white/10 px-6 py-3.5 text-left transition-all last:border-0 hover:bg-white/30"
                >
                  <div className="min-w-0">
                    <div className="font-mono text-[13px] font-medium text-silk-text-primary">
                      {truncateMiddle(job.onchainId, 8, 6)}
                    </div>
                    <div className="mt-0.5 text-xs text-silk-text-tertiary">
                      {job.ownerSolName ?? truncateMiddle(job.ownerId, 6, 4)}
                    </div>
                  </div>
                  <span className="hidden sm:block">
                    <span className="neo-pill flex h-7 min-w-[28px] items-center justify-center px-2.5 text-[12px] font-semibold text-silk-primary">
                      {job.agentCount ?? 0}
                    </span>
                  </span>
                  <span className="hidden md:block">
                    <StatusBadge status={job.status} />
                  </span>
                  <span className="hidden text-xs text-silk-text-tertiary lg:block">
                    {formatRelativeTime(job.createdAt)}
                  </span>
                  <Link
                    to={`/jobs/${job.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="neo-button px-3 py-1.5 text-xs"
                  >
                    View
                  </Link>
                </button>
              ))}
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function ActivityChart({ jobId }: { jobId: string }) {
  const messagesQuery = useQuery({
    queryKey: ["messages-activity", jobId],
    queryFn: async () =>
      unwrapEnvelope(
        (
          await apiClient.get<ApiEnvelope<{ items: Array<{ createdAt: string }> }>>(
            "/messages",
            { params: { jobId, limit: 200 } }
          )
        ).data
      ),
    refetchInterval: 30_000
  });

  const hourlyData = Array.from({ length: 24 }, (_, i) => {
    const hour = new Date();
    hour.setMinutes(0, 0, 0);
    hour.setHours(hour.getHours() - (23 - i));
    const next = new Date(hour);
    next.setHours(next.getHours() + 1);
    const count =
      messagesQuery.data?.items.filter((m) => {
        const t = new Date(m.createdAt).getTime();
        return t >= hour.getTime() && t < next.getTime();
      }).length ?? 0;
    return {
      time: hour.toLocaleTimeString("en-US", { hour: "2-digit", hour12: false }),
      messages: count
    };
  });

  if (messagesQuery.isLoading) {
    return <SkeletonBlock className="mt-6 h-64 rounded-[20px]" />;
  }
  if (messagesQuery.isError) {
    return (
      <div className="mt-6 flex flex-col items-center py-8 text-center">
        <WarningIcon className="h-10 w-10 text-amber-400" />
        <p className="mt-3 text-sm text-silk-text-secondary">Activity data unavailable for this job.</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={248} className="mt-4">
      <LineChart data={hourlyData}>
        <defs>
          <linearGradient id="activityGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="time"
          tick={{ fontSize: 11, fill: "rgb(var(--tm-color-text-tertiary))" }}
          tickLine={false}
          axisLine={false}
          interval={3}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "rgb(var(--tm-color-text-tertiary))" }}
          tickLine={false}
          axisLine={false}
          width={28}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{
            background: "rgb(var(--tm-color-bg))",
            border: "none",
            borderRadius: "14px",
            boxShadow: "var(--tm-shadow-neo)",
            fontSize: "13px"
          }}
          formatter={(v) => [v, "Messages"]}
        />
        <Line
          type="monotone"
          dataKey="messages"
          stroke="#6366f1"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: "#6366f1" }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
