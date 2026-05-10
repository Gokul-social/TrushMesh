import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { apiClient } from "../lib/axios";
import { unwrapEnvelope } from "../lib/utils";
import type { ApiEnvelope, GlobalStats } from "../types";
import { FingerprintIcon, NodeGraphIcon, PersonIcon, RobotIcon, ShieldIcon, TerminalIcon } from "../components/Icons";
import { ErrorCard, SkeletonBlock } from "../components/Feedback";

function RoleCard({
  title,
  eyebrow,
  description
}: {
  title: string;
  eyebrow: string;
  description: string;
}) {
  return (
    <div className="tm-control-surface rounded-[26px] px-5 py-5">
      <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-silk-text-tertiary">{eyebrow}</div>
      <div className="mt-3 text-lg font-semibold text-silk-text-primary">{title}</div>
      <p className="mt-3 text-sm leading-7 text-silk-text-secondary">{description}</p>
    </div>
  );
}

export function Nodes() {
  const statsQuery = useQuery({
    queryKey: ["global-stats"],
    queryFn: async () =>
      unwrapEnvelope((await apiClient.get<ApiEnvelope<GlobalStats>>("/stats/global")).data),
    refetchInterval: 30_000
  });

  return (
    <div className="min-h-[calc(100vh-5rem)] p-4 pb-24 md:p-6 lg:p-8">
      <div className="mx-auto max-w-[1500px] space-y-6">
        <section className="tm-shell-card overflow-hidden px-6 py-6 md:px-8">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-end">
            <div>
              <div className="tm-kicker">Mesh Topology</div>
              <h1 className="mt-5 text-4xl font-semibold tracking-tight text-silk-text-primary md:text-5xl">
                Nodes & identity model
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-8 text-silk-text-secondary">
                TrustMesh nodes are named, signed actors with explicit parentage. This page explains their roles, lifecycle, and the operating model behind the graph.
              </p>
            </div>

            <div className="tm-control-surface rounded-[28px] p-5">
              {statsQuery.isLoading ? (
                <SkeletonBlock className="h-32 rounded-[22px]" />
              ) : statsQuery.isError ? (
                <ErrorCard
                  message={(statsQuery.error as Error).message || "Node overview could not be loaded."}
                  onRetry={() => void statsQuery.refetch()}
                />
              ) : (
                <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                  <div className="rounded-[22px] bg-white/60 px-4 py-4">
                    <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-silk-text-tertiary">Live agents</div>
                    <div className="mt-2 text-2xl font-semibold text-silk-primary">{statsQuery.data?.totalAgents ?? 0}</div>
                  </div>
                  <div className="rounded-[22px] bg-white/60 px-4 py-4">
                    <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-silk-text-tertiary">Active jobs</div>
                    <div className="mt-2 text-2xl font-semibold text-silk-text-primary">{statsQuery.data?.activeJobs ?? 0}</div>
                  </div>
                  <div className="rounded-[22px] bg-white/60 px-4 py-4">
                    <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-silk-text-tertiary">Unsafe actions</div>
                    <div className="mt-2 text-2xl font-semibold text-amber-500">{statsQuery.data?.unauthorizedActions ?? 0}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-5">
          <RoleCard
            eyebrow="Planner"
            title="Strategy root"
            description="Plans the next step, assigns work, and maintains the highest operational context inside a job."
          />
          <RoleCard
            eyebrow="Executor"
            title="Action worker"
            description="Performs delegated work such as protocol calls, transaction assembly, or bounded execution."
          />
          <RoleCard
            eyebrow="Analyzer"
            title="Research layer"
            description="Studies protocol state, balances, and risk signals without necessarily submitting transactions."
          />
          <RoleCard
            eyebrow="Trader"
            title="Market specialist"
            description="Handles DeFi-specific logic such as swap preparation, quote selection, and execution posture."
          />
          <RoleCard
            eyebrow="Confirmer"
            title="Result validator"
            description="Checks whether the delegated action completed as intended and records the verification result."
          />
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <motion.section
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.15 }}
            className="tm-shell-card p-6"
          >
            <div className="flex items-center gap-3">
              <span className="neo-pill flex h-11 w-11 items-center justify-center px-0 py-0 text-silk-primary">
                <NodeGraphIcon className="h-5 w-5" />
              </span>
              <h2 className="text-2xl font-semibold tracking-tight text-silk-text-primary">Hierarchy rules</h2>
            </div>
            <div className="mt-5 space-y-3 text-sm leading-7 text-silk-text-secondary">
              <div className="rounded-[22px] bg-white/60 px-4 py-4">
                The human owner is always the root authority. Every agent below that root inherits context through delegation, not through hidden global state.
              </div>
              <div className="rounded-[22px] bg-white/60 px-4 py-4">
                Parent-child links matter operationally: they determine who can delegate to whom and which nodes are affected by cascade revocation.
              </div>
              <div className="rounded-[22px] bg-white/60 px-4 py-4">
                The graph is intentionally tree-shaped, not a generic mesh. That keeps authority understandable even when execution becomes complex.
              </div>
            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            viewport={{ once: true, amount: 0.15 }}
            className="tm-shell-card p-6"
          >
            <div className="flex items-center gap-3">
              <span className="neo-pill flex h-11 w-11 items-center justify-center px-0 py-0 text-silk-primary">
                <FingerprintIcon className="h-5 w-5" />
              </span>
              <h2 className="text-2xl font-semibold tracking-tight text-silk-text-primary">Identity guarantees</h2>
            </div>
            <div className="mt-5 space-y-3 text-sm leading-7 text-silk-text-secondary">
              <div className="rounded-[22px] bg-white/60 px-4 py-4">
                Every node resolves to a unique signer wallet and a readable <span className="font-mono text-silk-primary">.sol</span> namespace.
              </div>
              <div className="rounded-[22px] bg-white/60 px-4 py-4">
                Backend verification ensures that the signer behind a delegation message matches the expected SNS identity.
              </div>
              <div className="rounded-[22px] bg-white/60 px-4 py-4">
                When identity drift appears, treat it as an operational or security issue before assuming the runtime is simply stale.
              </div>
            </div>
          </motion.section>
        </div>

        <div className="grid gap-6 xl:grid-cols-3">
          <div className="tm-shell-card p-5">
            <div className="flex items-center gap-3">
              <span className="neo-pill flex h-10 w-10 items-center justify-center px-0 py-0 text-silk-primary">
                <PersonIcon className="h-4 w-4" />
              </span>
              <div className="text-lg font-semibold text-silk-text-primary">Root ownership</div>
            </div>
            <p className="mt-4 text-sm leading-7 text-silk-text-secondary">
              Human ownership never disappears from the model. The system is designed so operators can always understand who authorized a branch.
            </p>
          </div>
          <div className="tm-shell-card p-5">
            <div className="flex items-center gap-3">
              <span className="neo-pill flex h-10 w-10 items-center justify-center px-0 py-0 text-silk-primary">
                <RobotIcon className="h-4 w-4" />
              </span>
              <div className="text-lg font-semibold text-silk-text-primary">Scoped autonomy</div>
            </div>
            <p className="mt-4 text-sm leading-7 text-silk-text-secondary">
              Agents operate with a bounded role, a readable name, and a parent relationship that keeps delegation auditable.
            </p>
          </div>
          <div className="tm-shell-card p-5">
            <div className="flex items-center gap-3">
              <span className="neo-pill flex h-10 w-10 items-center justify-center px-0 py-0 text-silk-primary">
                <ShieldIcon className="h-4 w-4" />
              </span>
              <div className="text-lg font-semibold text-silk-text-primary">Branch shutdown</div>
            </div>
            <p className="mt-4 text-sm leading-7 text-silk-text-secondary">
              Revocation is branch-aware. Disabling a parent disables its descendants so unsafe authority cannot linger in the subtree.
            </p>
          </div>
        </div>

        <section className="tm-shell-card p-6">
          <div className="flex items-center gap-3">
            <span className="neo-pill flex h-11 w-11 items-center justify-center px-0 py-0 text-silk-primary">
              <TerminalIcon className="h-5 w-5" />
            </span>
            <h2 className="text-2xl font-semibold tracking-tight text-silk-text-primary">Operational checklist</h2>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              "Verify owner identity before creating child names.",
              "Use explicit planner and executor naming conventions.",
              "Export logs before revoking or redeploying a branch.",
              "Keep RPC, wallet, and websocket on the same cluster."
            ].map((item) => (
              <div key={item} className="neo-inset rounded-[22px] px-4 py-4 text-sm leading-7 text-silk-text-secondary">
                {item}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
