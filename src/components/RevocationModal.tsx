import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { apiClient } from "../lib/axios";
import type { Agent } from "../types";
import { WarningIcon } from "./Icons";

type RevocationModalProps = {
  agent: Agent;
  onConfirm: (txHash: string) => void;
  onCancel: () => void;
};

export function RevocationModal({ agent, onConfirm, onCancel }: RevocationModalProps) {
  const [txHash, setTxHash] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      await apiClient.post(`/agents/${agent.id}/revoke`, { revokeTxHash: txHash.trim() });
      return txHash.trim();
    },
    onSuccess: (hash) => {
      onConfirm(hash);
    }
  });

  return (
    <motion.div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/30 px-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 24 }}
        className="neo-raised w-full max-w-[480px] rounded-[20px] p-6"
      >
        <div className="flex items-start gap-4">
          <div className="neo-raised flex h-14 w-14 items-center justify-center rounded-2xl text-amber-500">
            <WarningIcon className="h-8 w-8" />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-silk-text-primary">
              Revoke {agent.solSubName}?
            </h3>
            <p className="mt-2 text-sm leading-6 text-silk-text-secondary">
              This will immediately halt this agent and all child agents. The action is recorded
              permanently on Solana and cannot be undone.
            </p>
            {typeof agent.childCount === "number" && agent.childCount > 0 ? (
              <p className="mt-3 text-sm text-amber-600">
                This will cascade to {agent.childCount} child agent
                {agent.childCount === 1 ? "" : "s"}.
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-6">
          <label className="mb-2 block text-sm font-medium text-silk-text-secondary">
            Paste revocation tx hash
          </label>
          <input
            value={txHash}
            onChange={(event) => setTxHash(event.target.value)}
            className="neo-input"
            placeholder="5fNR...revocation"
          />
        </div>

        {mutation.isError ? (
          <p className="mt-3 text-sm text-red-500">
            {(mutation.error as Error).message || "Revocation failed."}
          </p>
        ) : null}

        <div className="mt-6 grid grid-cols-2 gap-4">
          <button className="neo-button px-4 py-3 text-silk-text-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="neo-button px-4 py-3 text-red-500 disabled:opacity-50"
            onClick={() => mutation.mutate()}
            disabled={txHash.trim().length === 0 || mutation.isPending}
          >
            {mutation.isPending ? "Revoking..." : "Confirm Revoke"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
