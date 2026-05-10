import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { apiClient } from "../lib/axios";
import { unwrapEnvelope } from "../lib/utils";
import type { ApiEnvelope, GlobalStats } from "../types";
import { BookIcon, CheckIcon, NodeGraphIcon, ShieldIcon, TerminalIcon } from "../components/Icons";
import { ErrorCard, SkeletonBlock } from "../components/Feedback";

function PrincipleCard({
  title,
  description
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="tm-control-surface rounded-[26px] px-5 py-5">
      <div className="text-lg font-semibold text-silk-text-primary">{title}</div>
      <p className="mt-3 text-sm leading-7 text-silk-text-secondary">{description}</p>
    </div>
  );
}

export function About() {
  const statsQuery = useQuery({
    queryKey: ["global-stats"],
    queryFn: async () =>
      unwrapEnvelope((await apiClient.get<ApiEnvelope<GlobalStats>>("/stats/global")).data),
    refetchInterval: 30_000
  });

  return (
    <div className="min-h-[calc(100vh-5rem)] p-4 pb-24 md:p-6 lg:p-8">
      <div className="mx-auto max-w-[1480px] space-y-6">
        <section className="tm-shell-card tm-grid-bg overflow-hidden px-6 py-6 md:px-8">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-center">
            <div>
              <div className="tm-kicker">Foundation</div>
              <h1 className="mt-5 text-4xl font-semibold tracking-tight text-silk-text-primary md:text-5xl">
                About TrustMesh
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-8 text-silk-text-secondary">
                TrustMesh makes autonomous systems legible. It gives every agent a readable identity, every delegation a signed audit trail, and every operator a reliable way to intervene.
              </p>
            </div>

            <div className="tm-control-surface rounded-[28px] p-5">
              {statsQuery.isLoading ? (
                <SkeletonBlock className="h-32 rounded-[22px]" />
              ) : statsQuery.isError ? (
                <ErrorCard
                  message={(statsQuery.error as Error).message || "About metrics could not be loaded."}
                  onRetry={() => void statsQuery.refetch()}
                />
              ) : (
                <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                  <div className="rounded-[22px] bg-white/60 px-4 py-4">
                    <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-silk-text-tertiary">Live jobs</div>
                    <div className="mt-2 text-2xl font-semibold text-silk-primary">{statsQuery.data?.activeJobs ?? 0}</div>
                  </div>
                  <div className="rounded-[22px] bg-white/60 px-4 py-4">
                    <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-silk-text-tertiary">Tracked agents</div>
                    <div className="mt-2 text-2xl font-semibold text-silk-text-primary">{statsQuery.data?.totalAgents ?? 0}</div>
                  </div>
                  <div className="rounded-[22px] bg-white/60 px-4 py-4">
                    <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-silk-text-tertiary">Risk events</div>
                    <div className="mt-2 text-2xl font-semibold text-amber-500">{statsQuery.data?.unauthorizedActions ?? 0}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <PrincipleCard
            title="Readable identity"
            description="Operators should not need to memorize public keys to understand who is acting. Human-readable namespaces keep the authority path visible."
          />
          <PrincipleCard
            title="Signed coordination"
            description="Delegation is only useful when it is attributable. TrustMesh records the signed message layer that explains how work moved across the tree."
          />
          <PrincipleCard
            title="Human override"
            description="Autonomy without intervention is unsafe. TrustMesh keeps revocation simple and branch-aware so operators can stop unsafe behavior fast."
          />
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
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
              <h2 className="text-2xl font-semibold tracking-tight text-silk-text-primary">How the system fits together</h2>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {[
                "Wallet identity anchors the human owner at the root.",
                "SNS sub-names create readable planner and executor namespaces.",
                "Signed messages become the coordination log visible in the UI.",
                "Realtime updates keep the graph and side panels current during execution.",
                "Revocation can stop a branch before unsafe work continues.",
                "Exports preserve a permanent incident and audit record."
              ].map((item) => (
                <div key={item} className="neo-inset rounded-[22px] px-4 py-4 text-sm leading-7 text-silk-text-secondary">
                  {item}
                </div>
              ))}
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
                <ShieldIcon className="h-5 w-5" />
              </span>
              <h2 className="text-2xl font-semibold tracking-tight text-silk-text-primary">Why Solana</h2>
            </div>
            <div className="mt-5 space-y-3 text-sm leading-7 text-silk-text-secondary">
              <div className="rounded-[22px] bg-white/60 px-4 py-4">
                Low-cost transactions make signed coordination logs economically realistic.
              </div>
              <div className="rounded-[22px] bg-white/60 px-4 py-4">
                SNS gives operators and agents readable naming that fits the governance story of the product.
              </div>
              <div className="rounded-[22px] bg-white/60 px-4 py-4">
                Fast confirmation keeps the operator experience close to realtime during deployment and revocation.
              </div>
            </div>
          </motion.section>
        </div>

        <section className="grid gap-6 xl:grid-cols-3">
          <div className="tm-shell-card p-5">
            <div className="flex items-center gap-3">
              <span className="neo-pill flex h-10 w-10 items-center justify-center px-0 py-0 text-silk-primary">
                <TerminalIcon className="h-4 w-4" />
              </span>
              <div className="text-lg font-semibold text-silk-text-primary">Operator surface</div>
            </div>
            <p className="mt-4 text-sm leading-7 text-silk-text-secondary">
              Explorer, deployer, support, settings, and telemetry are all designed to keep the operator in the loop instead of hiding autonomous behavior.
            </p>
          </div>
          <div className="tm-shell-card p-5">
            <div className="flex items-center gap-3">
              <span className="neo-pill flex h-10 w-10 items-center justify-center px-0 py-0 text-emerald-500">
                <CheckIcon className="h-4 w-4" />
              </span>
              <div className="text-lg font-semibold text-silk-text-primary">Verifiable execution</div>
            </div>
            <p className="mt-4 text-sm leading-7 text-silk-text-secondary">
              Every meaningful action should leave evidence behind. TrustMesh is strongest when operators can replay the decision path after the fact.
            </p>
          </div>
          <div className="tm-shell-card p-5">
            <div className="flex items-center gap-3">
              <span className="neo-pill flex h-10 w-10 items-center justify-center px-0 py-0 text-silk-primary">
                <BookIcon className="h-4 w-4" />
              </span>
              <div className="text-lg font-semibold text-silk-text-primary">Documentation-first</div>
            </div>
            <p className="mt-4 text-sm leading-7 text-silk-text-secondary">
              The product works best when the runtime, API, and operator playbooks all tell the same story. That is why docs and support live close to the core workflows.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
