import { useEffect, useRef, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { WalletMultiButton, useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useWallet } from "@solana/wallet-adapter-react";
import { apiClient } from "../lib/axios";
import { cx, getJwtFromLocalStorage, truncateMiddle, unwrapEnvelope } from "../lib/utils";
import type { ApiEnvelope, AuthUser } from "../types";
import {
  AnalyticsIcon,
  DotIcon,
  LockIcon,
  NodeGraphIcon,
  RocketIcon,
  SearchIcon,
  SettingsIcon,
  SupportIcon,
  TerminalIcon
} from "./Icons";
import { SkeletonBlock } from "./Feedback";

const topLinks = [
  {
    label: "Explorer",
    to: "/explorer",
    active: (pathname: string) => pathname === "/explorer" || pathname.startsWith("/jobs/")
  },
  {
    label: "Deploy",
    to: "/deploy",
    active: (pathname: string) => pathname === "/deploy"
  },
  {
    label: "Docs",
    to: "/docs",
    active: (pathname: string) => pathname === "/docs"
  },
  {
    label: "About",
    to: "/about",
    active: (pathname: string) => pathname === "/about"
  }
] as const;

const railLinks = [
  {
    label: "Nodes",
    to: "/nodes",
    icon: NodeGraphIcon,
    active: (pathname: string) => pathname === "/nodes"
  },
  {
    label: "Active Jobs",
    to: "/explorer",
    icon: TerminalIcon,
    active: (pathname: string) => pathname === "/explorer" || pathname.startsWith("/jobs/")
  },
  {
    label: "Deployer",
    to: "/deploy",
    icon: RocketIcon,
    active: (pathname: string) => pathname === "/deploy"
  },
  {
    label: "Analytics",
    to: "/analytics",
    icon: AnalyticsIcon,
    active: (pathname: string) => pathname === "/analytics"
  }
] as const;

function LoginButton() {
  const { setVisible } = useWalletModal();
  return (
    <button
      className="tm-button-primary flex items-center gap-2"
      onClick={() => setVisible(true)}
    >
      <LockIcon className="h-4 w-4" />
      Connect Wallet
    </button>
  );
}

function SearchPill() {
  return (
    <div className="hidden items-center gap-3 rounded-full border border-white/70 bg-silk-bg/90 px-4 py-3 shadow-neoInset lg:flex">
      <SearchIcon className="h-4 w-4 text-silk-primary" />
      <input
        readOnly
        value="Search mesh..."
        className="w-56 bg-transparent text-sm text-silk-text-secondary outline-none"
        aria-label="Search TrustMesh"
      />
    </div>
  );
}

function WalletStatus() {
  const wallet = useWallet();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const userQuery = useQuery({
    queryKey: ["user"],
    enabled: wallet.connected && Boolean(getJwtFromLocalStorage()),
    queryFn: async () =>
      unwrapEnvelope((await apiClient.get<ApiEnvelope<AuthUser>>("/auth/me")).data)
  });

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, []);

  const displayName =
    userQuery.data?.solName ??
    (wallet.publicKey ? truncateMiddle(wallet.publicKey.toBase58(), 6, 4) : "Connected");

  if (!wallet.connected) {
    return <LoginButton />;
  }

  if (userQuery.isLoading) {
    return <SkeletonBlock className="h-12 w-32 rounded-full" />;
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        className="neo-button flex items-center gap-3 rounded-full px-4 py-3 text-silk-primary"
        onClick={() => setMenuOpen((open) => !open)}
      >
        <DotIcon className="h-2 w-2 text-emerald-500" />
        <span className="text-sm font-semibold">{displayName}</span>
      </button>

      {menuOpen ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="neo-raised absolute right-0 top-[calc(100%+12px)] w-52 p-3"
        >
          <button
            className="w-full rounded-2xl px-4 py-3 text-left text-sm text-silk-text-primary transition hover:shadow-neoInset"
            onClick={() => {
              if (wallet.publicKey) {
                window.open(
                  `https://explorer.solana.com/address/${wallet.publicKey.toBase58()}`,
                  "_blank",
                  "noopener,noreferrer"
                );
              }
              setMenuOpen(false);
            }}
          >
            View Profile
          </button>
          <button
            className="mt-2 w-full rounded-2xl px-4 py-3 text-left text-sm text-silk-text-primary transition hover:shadow-neoInset"
            onClick={async () => {
              setMenuOpen(false);
              await wallet.disconnect();
            }}
          >
            Disconnect
          </button>
        </motion.div>
      ) : null}
    </div>
  );
}

export function AppShell() {
  const location = useLocation();
  const { connected } = useWallet();

  return (
    <div className="min-h-screen bg-silk-bg text-silk-text-primary">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/50 bg-silk-bg/90 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-[1600px] items-center gap-4 px-4 md:px-6">
          <Link to={connected ? "/explorer" : "/"} className="flex items-center gap-3 text-silk-text-primary no-underline">
            <span className="neo-raised flex h-11 w-11 items-center justify-center rounded-2xl text-silk-primary">
              <NodeGraphIcon className="h-5 w-5" />
            </span>
            <span className="text-[20px] font-semibold tracking-tight">TrustMesh</span>
          </Link>

          <nav className="ml-6 hidden items-center gap-2 md:flex">
            {topLinks.map((link) => {
              const active = link.active(location.pathname);
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={cx(
                    "rounded-full px-4 py-2.5 text-sm font-medium transition",
                    active
                      ? "neo-pill-inset text-silk-primary"
                      : "text-silk-text-secondary hover:text-silk-text-primary hover:shadow-neo"
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <SearchPill />
            <WalletStatus />
          </div>
        </div>
      </header>

      <aside className="fixed inset-y-20 left-0 hidden w-[268px] border-r border-white/50 bg-silk-bg/95 px-5 py-6 lg:flex lg:flex-col">
        <div className="px-2">
          <div className="text-[18px] font-semibold text-silk-primary">TrustMesh Terminal</div>
          <p className="mt-1 text-sm text-silk-text-secondary">AI Coordination Node</p>
        </div>

        <nav className="mt-8 space-y-2">
          {railLinks.map((link) => {
            const active = link.active(location.pathname);
            const Icon = link.icon;
            return (
              <Link
                key={link.to}
                to={link.to}
                className={cx(
                  "flex items-center gap-3 rounded-[22px] px-4 py-4 text-sm font-medium transition",
                  active
                    ? "neo-inset text-silk-primary"
                    : "text-silk-text-secondary hover:text-silk-text-primary hover:shadow-neo"
                )}
              >
                <Icon className="h-5 w-5" />
                <span>{link.label}</span>
              </Link>
            );
          })}
        </nav>

        <Link
          to="/deploy"
          className="neo-button mt-auto flex items-center justify-center gap-2 rounded-[24px] px-5 py-4 text-sm font-semibold text-silk-primary"
        >
          <RocketIcon className="h-4 w-4" />
          <span>New Deployment</span>
        </Link>

        <div className="mt-6 border-t border-white/50 pt-5">
          <Link
            to="/settings"
            className={cx(
              "flex items-center gap-3 rounded-[18px] px-4 py-3 text-sm transition hover:text-silk-text-primary hover:shadow-neo",
              location.pathname === "/settings"
                ? "neo-inset text-silk-primary"
                : "text-silk-text-secondary"
            )}
          >
            <SettingsIcon className="h-5 w-5" />
            <span>Settings</span>
          </Link>
          <Link
            to="/support"
            className={cx(
              "mt-1 flex items-center gap-3 rounded-[18px] px-4 py-3 text-sm transition hover:text-silk-text-primary hover:shadow-neo",
              location.pathname === "/support"
                ? "neo-inset text-silk-primary"
                : "text-silk-text-secondary"
            )}
          >
            <SupportIcon className="h-5 w-5" />
            <span>Support</span>
          </Link>
        </div>
      </aside>

      <main className="pt-20 lg:pl-[268px]">
        <Outlet />
      </main>

      <nav className="fixed inset-x-3 bottom-3 z-40 grid grid-cols-4 gap-2 rounded-[28px] border border-white/60 bg-silk-bg/95 p-2 shadow-neo backdrop-blur md:hidden">
        {railLinks.map((link) => {
          const active = link.active(location.pathname);
          const Icon = link.icon;
          return (
            <Link
              key={link.to}
              to={link.to}
              className={cx(
                "flex flex-col items-center gap-1 rounded-[18px] px-2 py-3 text-[11px] font-medium transition",
                active ? "neo-inset text-silk-primary" : "text-silk-text-secondary"
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{link.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

type PlaceholderScreenProps = {
  eyebrow: string;
  title: string;
  description: string;
  ctaLabel?: string;
  ctaTo?: string;
};

export function PlaceholderScreen({
  eyebrow,
  title,
  description,
  ctaLabel,
  ctaTo = "/explorer"
}: PlaceholderScreenProps) {
  return (
    <div className="min-h-[calc(100vh-5rem)] p-4 pb-24 md:p-6 lg:p-8">
      <div className="tm-shell-card mx-auto flex min-h-[calc(100vh-9rem)] max-w-5xl flex-col items-center justify-center px-8 py-16 text-center">
        <div className="tm-kicker">{eyebrow}</div>
        <h1 className="mt-5 text-4xl font-semibold tracking-tight text-silk-text-primary md:text-5xl">
          {title}
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-8 text-silk-text-secondary">
          {description}
        </p>
        {ctaLabel ? (
          <Link to={ctaTo} className="tm-button-primary mt-8">
            {ctaLabel}
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export const shellPageMeta = {
  docs: {
    eyebrow: "Protocol notes",
    title: "Docs are ready for content",
    description:
      "This space can hold operator runbooks, protocol behavior, contract notes, and delegation patterns once you have the copy ready."
  },
  about: {
    eyebrow: "Foundation",
    title: "About TrustMesh",
    description:
      "TrustMesh gives agent swarms a human-readable identity layer, verifiable delegation paths, and an audit surface that makes autonomous systems legible."
  },
  analytics: {
    eyebrow: "Telemetry",
    title: "Analytics dashboard coming next",
    description:
      "The shell is wired for an analytics view, so we can plug in job throughput, validation rates, and latency charts without changing the app structure."
  },
  nodes: {
    eyebrow: "Mesh topology",
    title: "Node directory placeholder",
    description:
      "This route is reserved for a network-wide node browser, status registry, or agent catalog once you want to expand beyond the current job-centric flow."
  },
  settings: {
    eyebrow: "Configuration",
    title: "Settings placeholder",
    description:
      "Wallet preferences, RPC settings, polling controls, and developer toggles can live here when you are ready to expose them in the UI."
  },
  support: {
    eyebrow: "Support",
    title: "Support center placeholder",
    description:
      "This slot can host docs links, Discord, incident procedures, or a support form without needing another navigation refactor."
  }
} as const;
