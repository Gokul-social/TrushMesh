import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Link, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useWallet } from "@solana/wallet-adapter-react";
import { apiClient } from "../lib/axios";
import { truncateMiddle, unwrapEnvelope, cx, getJwtFromLocalStorage } from "../lib/utils";
import type { ApiEnvelope, AuthUser } from "../types";
import { CloseIcon, DotIcon, NodeGraphIcon } from "./Icons";
import { SkeletonBlock } from "./Feedback";

const navLinks = [
  { label: "Explorer", to: "/" },
  { label: "Deploy", to: "/deploy" },
  { label: "Docs", to: "/docs" }
] as const;

export function NavBar() {
  const location = useLocation();
  const wallet = useWallet();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const userQuery = useQuery({
    queryKey: ["user"],
    enabled: wallet.connected && Boolean(getJwtFromLocalStorage()),
    queryFn: async () =>
      unwrapEnvelope(
        (
          await apiClient.get<ApiEnvelope<AuthUser>>("/auth/me")
        ).data
      )
  });

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    window.addEventListener("mousedown", handleClick);
    return () => {
      window.removeEventListener("mousedown", handleClick);
    };
  }, []);

  const displayName =
    userQuery.data?.solName ??
    (wallet.publicKey ? truncateMiddle(wallet.publicKey.toBase58(), 6, 4) : "Connected");

  return (
    <header className="fixed inset-x-0 top-0 z-50 h-16 bg-silk-bg px-4 md:px-8">
      <div className="neo-raised mx-auto flex h-full max-w-[1600px] items-center justify-between rounded-none px-4 md:rounded-[20px] md:px-6">
        <Link to="/" className="flex items-center gap-3 text-silk-text-primary no-underline">
          <span className="neo-raised flex h-10 w-10 items-center justify-center rounded-2xl text-silk-primary">
            <NodeGraphIcon className="h-5 w-5" />
          </span>
          <span className="text-[18px] font-semibold tracking-tight">TrustMesh</span>
        </Link>

        <nav className="hidden items-center gap-3 md:flex">
          {navLinks.map((link) => {
            const active = location.pathname === link.to;
            return (
              <Link
                key={link.to}
                to={link.to}
                className={cx(
                  "rounded-full px-4 py-2 text-sm font-medium text-silk-text-secondary transition",
                  active ? "neo-pill-inset text-silk-primary" : "hover:shadow-neo hover:text-silk-text-primary"
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="relative flex items-center" ref={menuRef}>
          {!wallet.connected ? (
            <WalletMultiButton className="wallet-adapter-button-trigger" />
          ) : userQuery.isLoading ? (
            <SkeletonBlock className="h-11 w-40 rounded-full" />
          ) : (
            <>
              <button
                className="neo-button flex items-center gap-3 rounded-full px-4 py-2 text-silk-primary"
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
                    className="mt-2 flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm text-silk-text-primary transition hover:shadow-neoInset"
                    onClick={async () => {
                      setMenuOpen(false);
                      await wallet.disconnect();
                    }}
                  >
                    Disconnect
                    <CloseIcon className="h-4 w-4 text-silk-text-secondary" />
                  </button>
                </motion.div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </header>
  );
}
