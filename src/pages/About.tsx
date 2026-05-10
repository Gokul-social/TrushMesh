import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
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

        {/* What is TrustMesh */}
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.1 }}
          className="tm-shell-card p-6"
        >
          <h2 className="text-2xl font-semibold tracking-tight text-silk-text-primary">What is TrustMesh?</h2>
          <p className="mt-4 text-sm leading-8 text-silk-text-secondary">
            TrustMesh is the first on-chain identity and audit platform for multi-agent AI systems on Solana. When AI agents coordinate to execute complex tasks — rebalancing a DeFi portfolio, voting in a DAO, or running automated workflows — there is currently no way to verify which agent made which decision. If something goes wrong, protocols have no audit trail.
          </p>
          <p className="mt-3 text-sm leading-8 text-silk-text-secondary">TrustMesh solves this with three core primitives:</p>
          <div className="mt-5 space-y-3">
            {[
              { n: "1", title: "Verified .sol identities", body: "Every agent gets a unique sub-name anchored to Solana Name Service, making authority paths human-readable." },
              { n: "2", title: "On-chain delegation logs", body: "Every inter-agent message is signed with Ed25519 and permanently logged on Solana — tamper-proof and auditable." },
              { n: "3", title: "Cascade revocation", body: "Humans can halt any agent in one transaction; the system automatically revokes all descendants in the tree." }
            ].map(({ n, title, body }) => (
              <div key={n} className="neo-inset flex gap-4 rounded-[22px] px-5 py-4">
                <span className="neo-pill flex h-7 w-7 shrink-0 items-center justify-center px-0 py-0 text-[11px] font-bold text-silk-primary">{n}</span>
                <div>
                  <div className="text-sm font-semibold text-silk-text-primary">{title}</div>
                  <p className="mt-1 text-sm leading-7 text-silk-text-secondary">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.section>

        {/* Built For */}
        <section>
          <h2 className="mb-4 text-xl font-semibold tracking-tight text-silk-text-primary">Built For</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              { icon: "💰", title: "DeFi Protocols", body: "Track your trading agent swarms with full audit trails and instant revocation for any rogue executor." },
              { icon: "🏛️", title: "DAOs", body: "Audit governance bot decisions and ensure compliance with on-chain verification of every delegation." },
              { icon: "🔧", title: "Builders", body: "Integrate agent accountability into your protocol with our REST API, WebSocket events, and agent runtime." }
            ].map(({ icon, title, body }) => (
              <div key={title} className="tm-control-surface rounded-[26px] px-5 py-5">
                <div className="text-3xl">{icon}</div>
                <div className="mt-3 text-base font-semibold text-silk-text-primary">{title}</div>
                <p className="mt-3 text-sm leading-7 text-silk-text-secondary">{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Architecture */}
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.1 }}
          className="tm-shell-card p-6"
        >
          <div className="flex items-center gap-3">
            <span className="neo-pill flex h-11 w-11 items-center justify-center px-0 py-0 text-silk-primary">
              <NodeGraphIcon className="h-5 w-5" />
            </span>
            <h2 className="text-2xl font-semibold tracking-tight text-silk-text-primary">How It Works</h2>
          </div>
          <div className="mt-5 neo-inset rounded-[22px] p-5">
            <pre className="overflow-x-auto font-mono text-[12px] leading-6 text-silk-text-secondary whitespace-pre">{`┌─────────────────────────────────┐
│   Frontend  (React + Vite + TS) │  D3 Force Graph · WebSocket updates
└──────────────┬──────────────────┘
               │ HTTPS + WSS
┌──────────────▼──────────────────┐
│     Backend  (Fastify + TS)     │  REST API · Ed25519 verification
│  PostgreSQL · Redis · BullMQ    │  SNS resolution · WebSocket events
└──────────────┬──────────────────┘
               │ Solana RPC
┌──────────────▼──────────────────┐
│   Solana Devnet                 │  On-chain program state
│   Anchor Program + SNS Program  │  Delegation records · Event logs
└─────────────────────────────────┘`}</pre>
          </div>
        </motion.section>

        {/* Tech stack */}
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.1 }}
          className="tm-shell-card overflow-hidden"
        >
          <div className="border-b border-white/20 px-6 py-5">
            <h2 className="text-2xl font-semibold tracking-tight text-silk-text-primary">Tech Stack</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-[11px] font-bold uppercase tracking-[0.18em] text-silk-text-tertiary">
                <th className="px-6 py-3 text-left font-bold">Layer</th>
                <th className="px-6 py-3 text-left font-bold">Technology</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Smart Contract", "Rust + Anchor 0.30"],
                ["Blockchain", "Solana Devnet + SNS"],
                ["Backend", "Fastify + TypeScript"],
                ["Database", "PostgreSQL 16 + Prisma ORM"],
                ["Cache / Queue", "Redis 7 + BullMQ"],
                ["Frontend", "React 18 + Vite + Tailwind"],
                ["Visualization", "D3.js v7 (force graph + tree)"],
                ["Real-time", "WebSocket + Zustand"],
                ["Wallet", "@solana/wallet-adapter"],
                ["Design System", "Silk (Neomorphic UI)"]
              ].map(([layer, tech], i) => (
                <tr key={layer} className={`border-b border-white/10 last:border-0 ${i % 2 === 0 ? "bg-white/40" : "bg-white/60"}`}>
                  <td className="px-6 py-3.5 font-medium text-silk-text-primary">{layer}</td>
                  <td className="px-6 py-3.5 font-mono text-silk-text-secondary">{tech}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </motion.section>

        {/* What Makes This Novel */}
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.1 }}
          className="tm-shell-card p-6"
        >
          <h2 className="text-2xl font-semibold tracking-tight text-silk-text-primary">What Makes This Novel</h2>
          <p className="mt-3 text-sm text-silk-text-secondary">No one on Solana has built:</p>
          <div className="mt-4 space-y-3">
            {[
              "Hierarchical agent identity using SNS sub-domains — .sol names aren't just for humans anymore.",
              "On-chain delegation logs with Ed25519 verification — provably signed inter-agent messages.",
              "Real-time graph visualization of multi-agent coordination — D3 force graph + WebSocket updates.",
              "One-click cascade revocation — revoking a parent agent instantly halts all descendants."
            ].map((item) => (
              <div key={item} className="neo-inset flex gap-3 rounded-[22px] px-5 py-4">
                <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                <span className="text-sm leading-7 text-silk-text-secondary">{item}</span>
              </div>
            ))}
          </div>
          <p className="mt-5 text-sm leading-7 text-silk-text-secondary">
            Existing projects focus on human identity or simple agent wallets. TrustMesh is the first <strong className="text-silk-text-primary">agent lineage and accountability layer</strong> native to Solana.
          </p>
        </motion.section>

        {/* Team */}
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.1 }}
          className="tm-shell-card p-6"
        >
          <div className="flex items-center gap-3">
            <span className="neo-pill flex h-11 w-11 items-center justify-center px-0 py-0 text-silk-primary">
              <ShieldIcon className="h-5 w-5" />
            </span>
            <h2 className="text-2xl font-semibold tracking-tight text-silk-text-primary">Team</h2>
          </div>
          <div className="mt-5 neo-inset rounded-[22px] px-5 py-5">
            <div className="text-base font-semibold text-silk-text-primary">Built by Gokul</div>
            <p className="mt-2 text-sm leading-7 text-silk-text-secondary">
              For the SNS Identity Track — Frontier Hackathon, May 2026.
            </p>
          </div>
        </motion.section>

        {/* Links */}
        <section>
          <h2 className="mb-4 text-xl font-semibold tracking-tight text-silk-text-primary">Links</h2>
          <div className="flex flex-wrap gap-4">
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="neo-button flex items-center gap-2 px-5 py-3 text-sm font-semibold text-silk-primary"
            >
              GitHub
            </a>
            <Link to="/docs" className="neo-button flex items-center gap-2 px-5 py-3 text-sm font-semibold text-silk-primary">
              Documentation
            </Link>
            <a
              href="https://solana.com"
              target="_blank"
              rel="noopener noreferrer"
              className="neo-button flex items-center gap-2 px-5 py-3 text-sm font-semibold text-silk-primary"
            >
              SNS Hackathon
            </a>
            <Link to="/support" className="neo-button flex items-center gap-2 px-5 py-3 text-sm font-semibold text-silk-primary">
              Support
            </Link>
          </div>
        </section>

        {/* License */}
        <div className="py-4 text-center">
          <p className="text-xs text-silk-text-tertiary">Open source under the MIT License</p>
          <p className="mt-1 text-xs text-silk-text-tertiary">Built with ❤️ for the Solana ecosystem</p>
        </div>
      </div>
    </div>
  );
}
