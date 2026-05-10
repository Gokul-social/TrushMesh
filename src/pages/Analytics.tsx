import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { apiClient } from "../lib/axios";
import { unwrapEnvelope } from "../lib/utils";
import type { ApiEnvelope, GlobalStats } from "../types";
import { AnalyticsIcon, CheckIcon, InfoIcon, ShieldIcon, TerminalIcon, WarningIcon } from "../components/Icons";
import { ErrorCard, SkeletonBlock } from "../components/Feedback";

function AnalyticsCard({
  title,
  value,
  caption,
  tone = "primary"
}: {
  title: string;
  value: string;
  caption: string;
  tone?: "primary" | "warning" | "success";
}) {
  const toneClass =
    tone === "warning"
      ? "text-amber-500"
      : tone === "success"
        ? "text-emerald-500"
        : "text-silk-primary";

  return (
    <div className="tm-control-surface rounded-[26px] px-5 py-5">
      <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-silk-text-tertiary">{title}</div>
      <div className={`mt-3 text-3xl font-semibold tracking-tight ${toneClass}`}>{value}</div>
      <p className="mt-3 text-sm leading-7 text-silk-text-secondary">{caption}</p>
    </div>
  );
}

function GuidanceCard({
  title,
  icon,
  children
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="tm-shell-card p-5">
      <div className="flex items-center gap-3">
        <span className="neo-pill flex h-11 w-11 items-center justify-center px-0 py-0 text-silk-primary">{icon}</span>
        <h2 className="text-lg font-semibold text-silk-text-primary">{title}</h2>
      </div>
      <div className="mt-4 text-sm leading-7 text-silk-text-secondary">{children}</div>
    </div>
  );
}

export function Analytics() {
  const statsQuery = useQuery({
    queryKey: ["global-stats"],
    queryFn: async () =>
      unwrapEnvelope((await apiClient.get<ApiEnvelope<GlobalStats>>("/stats/global")).data),
    refetchInterval: 30_000
  });

  const stats = statsQuery.data;

  return (
    <div className="min-h-[calc(100vh-5rem)] p-4 pb-24 md:p-6 lg:p-8">
      <div className="mx-auto max-w-[1500px] space-y-6">
        <section className="tm-shell-card tm-grid-bg overflow-hidden px-6 py-6 md:px-8">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-end">
            <div>
              <div className="tm-kicker">Telemetry</div>
              <h1 className="mt-5 text-4xl font-semibold tracking-tight text-silk-text-primary md:text-5xl">
                TrustMesh analytics
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-8 text-silk-text-secondary">
                Read system-wide coordination health through live counters, risk signals, and operator guidance that explains what each metric means.
              </p>
            </div>

            <div className="tm-control-surface rounded-[28px] p-5">
              <div className="flex items-center gap-3">
                <span className="neo-pill flex h-11 w-11 items-center justify-center px-0 py-0 text-silk-primary">
                  <AnalyticsIcon className="h-5 w-5" />
                </span>
                <div>
                  <div className="text-sm font-semibold text-silk-text-primary">Signal integrity</div>
                  <div className="text-sm text-silk-text-secondary">
                    Interpret live counts alongside graph state and message verification, not in isolation.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {statsQuery.isLoading ? (
          <div className="grid gap-4 md:grid-cols-3">
            <SkeletonBlock className="h-40 rounded-[28px]" />
            <SkeletonBlock className="h-40 rounded-[28px]" />
            <SkeletonBlock className="h-40 rounded-[28px]" />
          </div>
        ) : statsQuery.isError ? (
          <ErrorCard
            message={(statsQuery.error as Error).message || "Global analytics could not be loaded."}
            onRetry={() => void statsQuery.refetch()}
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            <AnalyticsCard
              title="Active Jobs"
              value={String(stats?.activeJobs ?? 0)}
              caption="Jobs currently executing or waiting on new coordination messages."
            />
            <AnalyticsCard
              title="Agents Deployed"
              value={String(stats?.totalAgents ?? 0)}
              caption="Total planner, executor, and supporting agents visible to the current operator."
              tone="success"
            />
            <AnalyticsCard
              title="Unauthorized Actions"
              value={String(stats?.unauthorizedActions ?? 0)}
              caption="Actions blocked or flagged as unsafe. This is the first number to inspect during an incident."
              tone="warning"
            />
          </div>
        )}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
          <div className="space-y-6">
            <GuidanceCard title="How to read the counters" icon={<InfoIcon className="h-5 w-5" />}>
              <ul className="space-y-3">
                <li className="rounded-[20px] bg-white/60 px-4 py-4">
                  <strong className="text-silk-text-primary">Active jobs</strong> tell you how much operator attention the mesh needs right now.
                </li>
                <li className="rounded-[20px] bg-white/60 px-4 py-4">
                  <strong className="text-silk-text-primary">Agent count</strong> reveals operational fan-out. Rising agent count with flat job count usually means jobs are becoming more complex.
                </li>
                <li className="rounded-[20px] bg-white/60 px-4 py-4">
                  <strong className="text-silk-text-primary">Unauthorized actions</strong> should always be reviewed together with message history and graph state before labeling the event benign.
                </li>
              </ul>
            </GuidanceCard>

            <GuidanceCard title="Metric catalog" icon={<TerminalIcon className="h-5 w-5" />}>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="neo-inset rounded-[22px] px-4 py-4">
                  <div className="text-sm font-semibold text-silk-text-primary">Throughput</div>
                  <p className="mt-2 text-sm leading-7 text-silk-text-secondary">
                    Pair active job count with message frequency to understand whether a quiet mesh is healthy or stalled.
                  </p>
                </div>
                <div className="neo-inset rounded-[22px] px-4 py-4">
                  <div className="text-sm font-semibold text-silk-text-primary">Verification health</div>
                  <p className="mt-2 text-sm leading-7 text-silk-text-secondary">
                    Signature verification failures should correlate with clear signer or SNS issues, not random runtime drift.
                  </p>
                </div>
                <div className="neo-inset rounded-[22px] px-4 py-4">
                  <div className="text-sm font-semibold text-silk-text-primary">Branch stability</div>
                  <p className="mt-2 text-sm leading-7 text-silk-text-secondary">
                    Repeated revocations in one subtree usually point to an authority or workflow design problem.
                  </p>
                </div>
                <div className="neo-inset rounded-[22px] px-4 py-4">
                  <div className="text-sm font-semibold text-silk-text-primary">Latency suspicion</div>
                  <p className="mt-2 text-sm leading-7 text-silk-text-secondary">
                    If counts feel stale, compare websocket behavior with polling cadence before assuming the job stopped.
                  </p>
                </div>
              </div>
            </GuidanceCard>
          </div>

          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.15 }}
              className="tm-shell-card p-5"
            >
              <div className="flex items-center gap-3">
                <span className="neo-pill flex h-11 w-11 items-center justify-center px-0 py-0 text-emerald-500">
                  <CheckIcon className="h-5 w-5" />
                </span>
                <div>
                  <div className="text-sm font-semibold text-silk-text-primary">Healthy operating pattern</div>
                  <div className="text-sm text-silk-text-secondary">
                    Active jobs rise, agents scale predictably, and unauthorized actions remain flat.
                  </div>
                </div>
              </div>
              <div className="mt-5 space-y-3">
                <div className="rounded-[22px] bg-white/60 px-4 py-4 text-sm leading-7 text-silk-text-secondary">
                  Use exports and graph snapshots at regular checkpoints so you can compare normal operation against incident behavior later.
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              viewport={{ once: true, amount: 0.15 }}
              className="tm-shell-card p-5"
            >
              <div className="flex items-center gap-3">
                <span className="neo-pill flex h-11 w-11 items-center justify-center px-0 py-0 text-amber-500">
                  <WarningIcon className="h-5 w-5" />
                </span>
                <div>
                  <div className="text-sm font-semibold text-silk-text-primary">Escalation pattern</div>
                  <div className="text-sm text-silk-text-secondary">
                    Unauthorized actions rise while the graph shows a planner branch widening or stalling.
                  </div>
                </div>
              </div>
              <div className="mt-5 space-y-3">
                <div className="rounded-[22px] bg-white/60 px-4 py-4 text-sm leading-7 text-silk-text-secondary">
                  Review the coordination log immediately, then decide whether a branch-level revocation is safer than continuing execution.
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              viewport={{ once: true, amount: 0.15 }}
              className="tm-shell-card p-5"
            >
              <div className="flex items-center gap-3">
                <span className="neo-pill flex h-11 w-11 items-center justify-center px-0 py-0 text-silk-primary">
                  <ShieldIcon className="h-5 w-5" />
                </span>
                <div>
                  <div className="text-sm font-semibold text-silk-text-primary">Review cadence</div>
                  <div className="text-sm text-silk-text-secondary">
                    Operators should review these metrics alongside support runbooks, not as a separate dashboard ritual.
                  </div>
                </div>
              </div>
              <div className="mt-5 rounded-[22px] bg-white/60 px-4 py-4 text-sm leading-7 text-silk-text-secondary">
                Daily: global counts. Per incident: graph snapshot plus message export. Per release: compare auth failures, revocations, and deployment completion time.
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
