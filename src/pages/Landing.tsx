import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { apiClient } from "../lib/axios";
import { unwrapEnvelope } from "../lib/utils";
import type { ApiEnvelope, GlobalStats } from "../types";
import {
  AnalyticsIcon,
  BookIcon,
  NodeGraphIcon,
  RocketIcon,
  SearchIcon,
  ShieldIcon,
  TerminalIcon
} from "../components/Icons";
import { SkeletonBlock } from "../components/Feedback";

function StatCard({
  label,
  value,
  tone = "primary"
}: {
  label: string;
  value: string;
  tone?: "primary" | "secondary" | "neutral";
}) {
  const toneClass =
    tone === "secondary"
      ? "text-silk-secondary"
      : tone === "neutral"
        ? "text-silk-text-primary"
        : "text-silk-primary";

  return (
    <div className="flex min-w-[120px] flex-col items-center gap-2 px-4 py-2 text-center">
      <span className={`text-3xl font-semibold ${toneClass}`}>{value}</span>
      <span className="text-[11px] font-bold uppercase tracking-[0.24em] text-silk-text-secondary">
        {label}
      </span>
    </div>
  );
}

export function Landing() {
  const statsQuery = useQuery({
    queryKey: ["global-stats"],
    queryFn: async () =>
      unwrapEnvelope((await apiClient.get<ApiEnvelope<GlobalStats>>("/stats/global")).data),
    refetchInterval: 30_000
  });

  const stats = statsQuery.data;

  return (
    <div className="relative min-h-screen overflow-hidden bg-silk-bg text-silk-text-primary">
      <div className="tm-grid-bg absolute inset-0 opacity-70" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.12),transparent_40%),radial-gradient(circle_at_bottom_right,rgba(124,58,237,0.08),transparent_35%)]" />

      <header className="relative z-20 px-4 pt-4 md:px-8 md:pt-6">
        <div className="tm-shell-card mx-auto flex max-w-[1280px] items-center gap-4 px-5 py-4 md:px-7">
          <Link to="/" className="flex items-center gap-3 text-silk-text-primary no-underline">
            <span className="text-silk-primary">
              <NodeGraphIcon className="h-7 w-7" />
            </span>
            <span className="text-2xl font-semibold tracking-tight">TrustMesh</span>
          </Link>

          <nav className="ml-auto hidden items-center gap-8 text-sm font-medium text-silk-text-secondary md:flex">
            <Link to="/explorer" className="transition hover:text-silk-primary">
              Explorer
            </Link>
            <Link to="/deploy" className="transition hover:text-silk-primary">
              Deploy
            </Link>
            <Link to="/docs" className="transition hover:text-silk-primary">
              Docs
            </Link>
            <Link to="/about" className="transition hover:text-silk-primary">
              About
            </Link>
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <div className="hidden items-center gap-3 rounded-full border border-white/70 bg-silk-bg/90 px-4 py-3 shadow-neoInset md:flex">
              <SearchIcon className="h-4 w-4 text-silk-primary" />
              <input
                readOnly
                value="Search network..."
                className="w-44 bg-transparent text-sm text-silk-text-secondary outline-none"
                aria-label="Search network"
              />
            </div>
            <WalletMultiButton className="tm-wallet-primary" />
          </div>
        </div>
      </header>

      <main className="relative z-10 px-4 pb-16 pt-10 md:px-8 md:pb-24 md:pt-16">
        <section className="mx-auto flex max-w-6xl flex-col items-center text-center">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            className="tm-kicker"
          >
            Mainnet live on Solana
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="mt-8 max-w-5xl text-5xl font-semibold tracking-[-0.06em] text-silk-text-primary md:text-7xl lg:text-[6.5rem]"
          >
            Every Agent.
            <br />
            <span className="bg-gradient-to-r from-silk-primary via-[#6f75ff] to-silk-secondary bg-clip-text italic text-transparent">
              Every Decision.
            </span>
            <br />
            On Chain.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
            className="mt-8 max-w-3xl text-lg leading-9 text-silk-text-secondary md:text-xl"
          >
            TrustMesh gives AI agent swarms a verified identity, auditable delegation, and a clean operator surface for Solana-native coordination.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18 }}
            className="mt-10 flex w-full flex-col items-center justify-center gap-4 sm:flex-row"
          >
            <Link to="/explorer" className="tm-button-ghost min-w-[220px] gap-3">
              <RocketIcon className="h-4 w-4" />
              <span>Explore Demo</span>
            </Link>
            <WalletMultiButton className="tm-wallet-primary min-w-[220px]" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="tm-shell-card mt-16 flex w-full max-w-4xl flex-wrap items-center justify-center gap-4 px-6 py-5 md:justify-around"
          >
            {statsQuery.isLoading ? (
              <>
                <SkeletonBlock className="h-16 w-28 rounded-2xl" />
                <SkeletonBlock className="h-16 w-28 rounded-2xl" />
                <SkeletonBlock className="h-16 w-28 rounded-2xl" />
              </>
            ) : (
              <>
                <StatCard label="Active Jobs" value={String(stats?.activeJobs ?? 0)} />
                <div className="hidden h-10 w-px bg-white/70 md:block" />
                <StatCard
                  label="Agents Deployed"
                  value={String(stats?.totalAgents ?? 0)}
                  tone="secondary"
                />
                <div className="hidden h-10 w-px bg-white/70 md:block" />
                <StatCard
                  label="Unauthorized Actions"
                  value={String(stats?.unauthorizedActions ?? 0)}
                  tone="neutral"
                />
              </>
            )}
          </motion.div>
        </section>

        <section className="mx-auto mt-24 grid max-w-6xl grid-cols-1 gap-6 md:grid-cols-12">
          <motion.article
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            className="tm-shell-card md:col-span-8 p-8"
          >
            <ShieldIcon className="h-10 w-10 text-silk-primary" />
            <h2 className="mt-8 text-3xl font-semibold tracking-tight">Immutable Agent Sovereignty</h2>
            <p className="mt-4 max-w-xl text-base leading-8 text-silk-text-secondary">
              Every agent gets a cryptographic identity anchored to a Solana PDA, with actions signed, verified, and retained for a full operational audit trail.
            </p>
            <div className="tm-hero-illustration mt-10 h-52 rounded-[26px]" />
          </motion.article>

          <motion.article
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            viewport={{ once: true, amount: 0.2 }}
            className="tm-shell-card md:col-span-4 p-8 text-center"
          >
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-white/60 bg-silk-bg shadow-neoInset text-silk-secondary">
              <TerminalIcon className="h-8 w-8" />
            </div>
            <h3 className="mt-8 text-3xl font-semibold tracking-tight">mesh.sol</h3>
            <p className="mt-4 text-base leading-8 text-silk-text-secondary">
              Human-readable delegation means your swarm can route work to identities like <span className="font-mono text-silk-primary">exec.mesh.sol</span> instead of raw keys.
            </p>
            <div className="mt-8 rounded-[22px] border border-white/60 bg-silk-bg/80 p-4 text-left shadow-neoInset">
              <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-silk-text-tertiary">
                Transaction preview
              </div>
              <div className="mt-3 flex items-center gap-2 text-sm font-mono text-silk-secondary">
                <span className="h-2 w-2 rounded-full bg-silk-secondary" />
                delegate(tx_hash, mesh.sol)
              </div>
            </div>
          </motion.article>

          <motion.article
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            className="tm-shell-card md:col-span-4 p-8"
          >
            <AnalyticsIcon className="h-9 w-9 text-silk-text-secondary" />
            <h3 className="mt-8 text-2xl font-semibold tracking-tight">Live Telemetry</h3>
            <p className="mt-4 text-base leading-8 text-silk-text-secondary">
              Watch agent swarms collaborate in near real time, with status updates, message verification, and active-job visibility in one place.
            </p>
          </motion.article>

          <motion.article
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            viewport={{ once: true, amount: 0.2 }}
            className="tm-shell-card md:col-span-8 flex flex-col gap-8 overflow-hidden p-8 md:flex-row md:items-center"
          >
            <div className="flex-1">
              <h3 className="text-3xl font-semibold tracking-tight">Decentralized Coordination</h3>
              <p className="mt-4 max-w-2xl text-base leading-8 text-silk-text-secondary">
                Remove the operator bottleneck. TrustMesh keeps negotiation, execution, and settlement aligned across wallets, agents, and on-chain verification.
              </p>
            </div>
            <div className="flex h-40 w-40 items-center justify-center self-center rounded-full border border-white/60 bg-[radial-gradient(circle_at_30%_30%,rgba(124,58,237,0.18),transparent_35%),radial-gradient(circle_at_70%_70%,rgba(99,102,241,0.14),transparent_35%),#e8eaf0)] shadow-neoInset text-silk-primary">
              <BookIcon className="h-16 w-16 opacity-40" />
            </div>
          </motion.article>
        </section>
      </main>

      <footer className="relative z-10 px-4 pb-8 md:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 border-t border-white/60 pt-6 text-sm text-silk-text-secondary md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3 text-silk-primary">
            <NodeGraphIcon className="h-4 w-4" />
            <span className="font-semibold">TrustMesh</span>
          </div>
          <div className="flex flex-wrap items-center gap-5">
            <Link to="/explorer" className="transition hover:text-silk-primary">
              Explorer
            </Link>
            <Link to="/docs" className="transition hover:text-silk-primary">
              Docs
            </Link>
            <Link to="/about" className="transition hover:text-silk-primary">
              About
            </Link>
          </div>
          <div>© 2026 TrustMesh Foundation. Secured by Solana.</div>
        </div>
      </footer>
    </div>
  );
}
