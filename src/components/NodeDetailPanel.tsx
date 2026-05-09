import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../lib/axios";
import {
  cx,
  formatRelativeTime,
  formatStatusLabel,
  statusColor,
  truncateMiddle,
  unwrapEnvelope
} from "../lib/utils";
import type { Agent, ApiEnvelope } from "../types";
import { CheckIcon, CloseIcon, PersonIcon, RobotIcon, WarningIcon } from "./Icons";
import { ErrorCard, SkeletonBlock } from "./Feedback";
import { RevocationModal } from "./RevocationModal";

type NodeDetailPanelProps = {
  agentId: string | null;
  onClose: () => void;
};

export function NodeDetailPanel({ agentId, onClose }: NodeDetailPanelProps) {
  const [showModal, setShowModal] = useState(false);
  const queryClient = useQueryClient();

  const agentQuery = useQuery({
    queryKey: ["agent", agentId],
    enabled: Boolean(agentId),
    queryFn: async () =>
      unwrapEnvelope(
        (
          await apiClient.get<ApiEnvelope<Agent>>(`/agents/${agentId}`)
        ).data
      )
  });

  const agent = agentQuery.data;

  return (
    <AnimatePresence>
      {agentId ? (
        <>
          <motion.aside
            initial={{ x: 320 }}
            animate={{ x: 0 }}
            exit={{ x: 320 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="fixed right-0 top-0 z-40 h-screen w-[320px] bg-silk-bg px-4 pb-4 pt-20"
          >
            <div className="neo-raised flex h-full flex-col rounded-[22px] p-4">
              {agentQuery.isLoading ? (
                <div className="space-y-4">
                  <SkeletonBlock className="h-10 rounded-2xl" />
                  <SkeletonBlock className="h-24 rounded-[20px]" />
                  <SkeletonBlock className="h-24 rounded-[20px]" />
                  <SkeletonBlock className="h-56 rounded-[20px]" />
                </div>
              ) : agentQuery.isError ? (
                <ErrorCard
                  message={(agentQuery.error as Error).message || "Agent details could not be loaded."}
                  onRetry={() => void agentQuery.refetch()}
                />
              ) : agent ? (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-mono text-[13px] text-silk-text-primary">
                        {agent.solSubName}
                      </div>
                      <div
                        className="neo-pill mt-3 inline-flex items-center gap-2 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em]"
                        style={{ color: statusColor(agent.status) }}
                      >
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: statusColor(agent.status) }}
                        />
                        {formatStatusLabel(agent.status)}
                      </div>
                    </div>
                    <button className="neo-button rounded-2xl p-3 text-silk-text-secondary" onClick={onClose}>
                      <CloseIcon className="h-4 w-4" />
                    </button>
                  </div>

                  <section className="mt-5">
                    <div className="mb-3 text-xs uppercase tracking-[0.18em] text-silk-text-tertiary">
                      Identity
                    </div>
                    <div className="neo-raised space-y-4 p-4">
                      <div className="flex items-center gap-3 text-sm text-silk-text-primary">
                        {agent.parentAgentId ? (
                          <RobotIcon className="h-4 w-4 text-silk-primary" />
                        ) : (
                          <PersonIcon className="h-4 w-4 text-silk-primary" />
                        )}
                        <span>{agent.parentSolSubName ?? "Human Owner"}</span>
                      </div>
                      <button
                        className="block text-left font-mono text-[12px] text-silk-primary"
                        onClick={() => {
                          if (agent.spawnTxHash) {
                            window.open(
                              `https://explorer.solana.com/tx/${agent.spawnTxHash}`,
                              "_blank",
                              "noopener,noreferrer"
                            );
                          }
                        }}
                      >
                        Spawned by: {agent.spawnTxHash ? truncateMiddle(agent.spawnTxHash) : "Pending"}
                      </button>
                      <div className="font-mono text-[12px] text-silk-text-secondary">
                        Wallet: {agent.walletAddr ? truncateMiddle(agent.walletAddr, 8, 4) : "Resolving..."}
                      </div>
                    </div>
                  </section>

                  <section className="mt-5">
                    <div className="mb-3 text-xs uppercase tracking-[0.18em] text-silk-text-tertiary">
                      Activity
                    </div>
                    <div className="neo-raised p-4">
                      <div className="text-[28px] font-semibold text-silk-text-primary">
                        {agent.actionCount}
                      </div>
                      <div className="text-sm text-silk-text-secondary">actions taken</div>
                      <div className="mt-4 text-sm text-silk-text-secondary">
                        Last action: {formatRelativeTime(agent.lastActionAt)}
                      </div>
                    </div>
                  </section>

                  <section className="mt-5 flex min-h-0 flex-1 flex-col">
                    <div className="mb-3 text-xs uppercase tracking-[0.18em] text-silk-text-tertiary">
                      Action Log
                    </div>
                    <div className="silk-scrollbar flex max-h-[240px] flex-col gap-3 overflow-y-auto pr-1">
                      {(agent.actions ?? []).length > 0 ? (
                        agent.actions?.map((entry) => (
                          <div key={entry.id} className="neo-inset p-3">
                            <div className="flex items-center justify-between gap-3">
                              <span className="font-mono text-[10px] uppercase text-silk-text-tertiary">
                                {new Date(entry.createdAt).toLocaleTimeString()}
                              </span>
                              <span
                                className={cx(
                                  "rounded-full p-1",
                                  entry.verified ? "text-emerald-500" : "text-amber-500"
                                )}
                              >
                                {entry.verified ? (
                                  <CheckIcon className="h-4 w-4" />
                                ) : (
                                  <WarningIcon className="h-4 w-4" />
                                )}
                              </span>
                            </div>
                            <p className="mt-2 text-sm leading-6 text-silk-text-primary">
                              {entry.description}
                            </p>
                          </div>
                        ))
                      ) : (
                        <div className="neo-inset p-4 text-sm text-silk-text-secondary">
                          No verified action log entries yet.
                        </div>
                      )}
                    </div>
                  </section>

                  <button
                    className="neo-inset mt-5 px-4 py-3 text-sm font-semibold text-red-500"
                    onClick={() => setShowModal(true)}
                  >
                    Revoke Agent
                  </button>
                </>
              ) : null}
            </div>
          </motion.aside>

          {agent && showModal ? (
            <RevocationModal
              agent={agent}
              onCancel={() => setShowModal(false)}
              onConfirm={() => {
                setShowModal(false);
                void queryClient.invalidateQueries({ queryKey: ["graph", agent.jobId] });
                void queryClient.invalidateQueries({ queryKey: ["agent", agent.id] });
                void queryClient.invalidateQueries({ queryKey: ["jobs"] });
              }}
            />
          ) : null}
        </>
      ) : null}
    </AnimatePresence>
  );
}
