import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useConnection, useWallet, type WalletContextState } from "@solana/wallet-adapter-react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AnchorProvider, BN, Program, type Idl, type Wallet as AnchorWallet } from "@coral-xyz/anchor";
import { Keypair, PublicKey, SystemProgram, Transaction, VersionedTransaction } from "@solana/web3.js";
import confetti from "canvas-confetti";
import * as d3 from "d3";
import { z } from "zod";
import { Buffer } from "buffer";
import { apiClient } from "../lib/axios";
import {
  randomHex,
  safeNumber,
  sha256Hex,
  truncateMiddle,
  unwrapEnvelope
} from "../lib/utils";
import type { ApiEnvelope, AuthUser, Job } from "../types";
import { ChevronRightIcon, CheckIcon } from "../components/Icons";
import { ErrorCard, SkeletonBlock } from "../components/Feedback";
import { trustmeshIdl } from "../idl/trustmesh";

const deploySchema = z.object({
  description: z.string().trim().min(8, "Describe the job with a little more detail."),
  template: z.enum(["PORTFOLIO_REBALANCER", "DAO_VOTER", "DATA_FETCHER"]),
  budgetSol: z.coerce.number().min(0.01).max(100),
  plannerSubName: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]{1,32}$/u, "Use lowercase letters, digits, and dashes."),
  executorSubNames: z
    .array(
      z.object({
        value: z
          .string()
          .trim()
          .toLowerCase()
          .regex(/^[a-z0-9-]{1,32}$/u, "Use lowercase letters, digits, and dashes.")
      })
    )
    .min(1)
});

type DeployFormValues = z.infer<typeof deploySchema>;

function useDebouncedValue<T>(value: T, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timeout = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timeout);
  }, [delay, value]);
  return debounced;
}

function toAnchorWallet(wallet: WalletContextState): AnchorWallet | null {
  if (!wallet.publicKey || !wallet.signTransaction) {
    return null;
  }

  return {
    payer: Keypair.generate(),
    publicKey: wallet.publicKey,
    signTransaction: wallet.signTransaction,
    signAllTransactions:
      wallet.signAllTransactions ??
      (async <T extends Transaction | VersionedTransaction>(transactions: T[]) => {
        const signed = await Promise.all(
          transactions.map(async (transaction) => {
            if (transaction instanceof Transaction) {
              return wallet.signTransaction!(transaction);
            }
            throw new Error("This wallet does not support signing versioned transactions.");
          })
        );
        return signed as T[];
      })
  };
}

function buildPreviewTree(owner: string, planner: string, executors: string[]) {
  const data = [
    { id: "owner", parentId: null, label: owner || "owner.sol", human: true },
    { id: "planner", parentId: "owner", label: planner || "planner.owner.sol", human: false },
    ...executors.map((executor, index) => ({
      id: `executor-${index}`,
      parentId: "planner",
      label: executor || `executor-${index + 1}.owner.sol`,
      human: false
    }))
  ];

  return d3
    .tree<{ id: string; parentId: string | null; label: string; human: boolean }>()
    .size([240, 170])(
      d3
        .stratify<{ id: string; parentId: string | null; label: string; human: boolean }>()
        .id((node) => node.id)
        .parentId((node) => node.parentId)(data)
    );
}

export function Deploy() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const wallet = useWallet();
  const { connection } = useConnection();
  const [step, setStep] = useState(1);
  const [deploying, setDeploying] = useState(false);
  const [deployError, setDeployError] = useState<string | null>(null);

  const form = useForm<DeployFormValues>({
    resolver: zodResolver(deploySchema),
    defaultValues: {
      description: "",
      template: "PORTFOLIO_REBALANCER",
      budgetSol: 0.25,
      plannerSubName: "",
      executorSubNames: [{ value: "" }]
    },
    mode: "onChange"
  });

  const fields = useFieldArray({
    control: form.control,
    name: "executorSubNames"
  });

  const ownerQuery = useQuery({
    queryKey: ["user"],
    enabled: wallet.connected,
    queryFn: async () =>
      unwrapEnvelope((await apiClient.get<ApiEnvelope<AuthUser>>("/auth/me")).data)
  });

  const gasEstimateQuery = useQuery({
    queryKey: ["deploy-gas-estimate"],
    queryFn: async () => {
      await connection.getLatestBlockhash("confirmed");
      return "0.002";
    }
  });

  const plannerName = form.watch("plannerSubName");
  const debouncedPlannerName = useDebouncedValue(plannerName, 400);
  const ownerName = ownerQuery.data?.solName ?? (wallet.publicKey ? "connected.sol" : "owner.sol");

  const plannerValidationQuery = useQuery({
    queryKey: ["validate-planner", debouncedPlannerName, ownerName],
    enabled: step >= 2 && debouncedPlannerName.trim().length > 0,
    queryFn: async () =>
      unwrapEnvelope(
        (
          await apiClient.get<ApiEnvelope<{ valid: boolean; fullName: string }>>("/jobs/validate-sub-name", {
            params: {
              subName: debouncedPlannerName
            }
          })
        ).data
      )
  });

  const previewTree = buildPreviewTree(
    ownerName,
    plannerName ? `${plannerName}.${ownerName}` : `planner.${ownerName}`,
    form.watch("executorSubNames").map(({ value }) =>
      value ? `${value}.${ownerName}` : `executor.${ownerName}`
    )
  );

  const stepComplete = [
    step > 1,
    step > 2,
    false
  ];

  const moveNext = async () => {
    const fieldsByStep: Record<number, Array<keyof DeployFormValues>> = {
      1: ["description", "template", "budgetSol"],
      2: ["plannerSubName", "executorSubNames"],
      3: []
    };
    const valid = await form.trigger(fieldsByStep[step] ?? []);
    if (valid) {
      setStep((current) => Math.min(3, current + 1));
    }
  };

  const deployJob = form.handleSubmit(async (values) => {
    setDeploying(true);
    setDeployError(null);

    try {
      const anchorWallet = toAnchorWallet(wallet);
      if (!anchorWallet) {
        throw new Error("Connect a wallet with transaction signing enabled.");
      }

      const onchainId = randomHex(32);
      const descriptionHash = await sha256Hex(values.description);
      const programId = new PublicKey("66DXeSqBccWxWWw9S21vxe2Mvvqqkmw5KsK5jqA42quz");
      const provider = new AnchorProvider(connection, anchorWallet, { commitment: "confirmed" });
      const program = new Program(
        { ...trustmeshIdl, address: programId.toBase58() } as Idl,
        provider
      );

      const [jobPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("job"),
          anchorWallet.publicKey.toBuffer(),
          Buffer.from(onchainId, "hex")
        ],
        programId
      );

      const templateIndexMap = {
        PORTFOLIO_REBALANCER: 0,
        DAO_VOTER: 1,
        DATA_FETCHER: 2
      } as const;

      const initTxHash = await program.methods
        .initializeJob(
          Array.from(Buffer.from(onchainId, "hex")),
          Array.from(Buffer.from(descriptionHash, "hex")),
          templateIndexMap[values.template],
          new BN(Math.round(values.budgetSol * 1_000_000_000))
        )
        .accounts({
          owner: anchorWallet.publicKey,
          job: jobPda,
          systemProgram: SystemProgram.programId
        })
        .rpc();

      const createdJob = unwrapEnvelope(
        (
          await apiClient.post<ApiEnvelope<Job>>("/jobs", {
            onchainId,
            description: values.description,
            template: values.template,
            budgetSol: values.budgetSol,
            plannerSubName: values.plannerSubName,
            executorSubNames: values.executorSubNames.map((entry) => entry.value)
          })
        ).data
      );

      await apiClient.patch(`/jobs/${createdJob.id}/activate`, { initTxHash });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["jobs"] }),
        queryClient.invalidateQueries({ queryKey: ["global-stats"] })
      ]);

      void confetti({
        particleCount: 140,
        spread: 72,
        origin: { y: 0.62 }
      });

      navigate(`/jobs/${createdJob.id}`);
    } catch (error) {
      setDeployError(error instanceof Error ? error.message : "Deployment failed.");
    } finally {
      setDeploying(false);
    }
  });

  return (
    <div className="min-h-screen bg-silk-bg px-5 pb-8 pt-20">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-semibold text-silk-text-primary">Deploy Wizard</h1>
          <p className="mt-3 text-sm text-silk-text-secondary">
            Initialize a new multi-agent TrustMesh job on Solana.
          </p>
        </div>

        <div className="mx-auto mb-10 flex max-w-2xl items-center justify-between gap-4">
          {[1, 2, 3].map((value) => (
            <div key={value} className="flex flex-1 items-center gap-3">
              <div
                className={value === step ? "neo-pill-inset flex h-12 w-12 items-center justify-center font-semibold text-silk-primary" : stepComplete[value - 1] ? "neo-pill flex h-12 w-12 items-center justify-center bg-silk-primary text-white shadow-neo" : "neo-pill flex h-12 w-12 items-center justify-center font-semibold text-silk-text-secondary"}
              >
                {stepComplete[value - 1] ? <CheckIcon className="h-5 w-5" /> : value}
              </div>
              {value < 3 ? <div className="h-1 flex-1 rounded-full bg-silk-bg shadow-neoInset" /> : null}
            </div>
          ))}
        </div>

        <form className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]" onSubmit={deployJob}>
          <div className="space-y-6">
            {step === 1 ? (
              <section className="neo-raised p-6">
                <h2 className="text-xl font-semibold text-silk-text-primary">Configure Job</h2>
                <div className="mt-5 space-y-5">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-silk-text-secondary">
                      Describe the job
                    </label>
                    <textarea
                      rows={6}
                      className="neo-input resize-none"
                      placeholder="Describe the audit, coordination goal, or execution plan..."
                      {...form.register("description")}
                    />
                    <p className="mt-2 text-xs text-red-500">{form.formState.errors.description?.message}</p>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-silk-text-secondary">
                      Template
                    </label>
                    <select className="neo-raised w-full bg-silk-bg px-4 py-3 text-sm text-silk-text-primary outline-none" {...form.register("template")}>
                      <option value="PORTFOLIO_REBALANCER">Portfolio Rebalancer</option>
                      <option value="DAO_VOTER">DAO Voter</option>
                      <option value="DATA_FETCHER">Data Fetcher</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-silk-text-secondary">
                      Budget in SOL
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      max="100"
                      className="neo-input"
                      {...form.register("budgetSol")}
                    />
                    <p className="mt-2 text-xs text-red-500">{form.formState.errors.budgetSol?.message}</p>
                  </div>
                </div>
              </section>
            ) : null}

            {step === 2 ? (
              <section className="neo-raised p-6">
                <h2 className="text-xl font-semibold text-silk-text-primary">Assign .sol Identities</h2>
                <div className="mt-5 space-y-5">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-silk-text-secondary">Owner</label>
                    <div className="neo-inset px-4 py-3 text-sm text-silk-primary">
                      {ownerQuery.isLoading ? "Resolving owner..." : ownerName}
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-silk-text-secondary">
                      Planner agent name
                    </label>
                    <div className="relative">
                      <input className="neo-input pr-12" {...form.register("plannerSubName")} placeholder="planner-alpha" />
                      {plannerValidationQuery.data?.valid ? (
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-500">
                          <CheckIcon className="h-5 w-5" />
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 font-mono text-xs text-silk-text-secondary">
                      Preview: {plannerName || "planner"}.{ownerName}
                    </p>
                    <p className="mt-2 text-xs text-red-500">{form.formState.errors.plannerSubName?.message}</p>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-silk-text-secondary">
                      Executor agent names
                    </label>
                    <div className="space-y-3">
                      {fields.fields.map((field, index) => (
                        <div key={field.id} className="flex items-center gap-3">
                          <input
                            className="neo-input"
                            placeholder={`executor-${index + 1}`}
                            {...form.register(`executorSubNames.${index}.value`)}
                          />
                          <button
                            type="button"
                            className="neo-button h-12 px-4 text-silk-text-secondary"
                            onClick={() => {
                              if (fields.fields.length > 1) {
                                fields.remove(index);
                              }
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      className="neo-button mt-4 px-4 py-3 text-sm font-semibold text-silk-primary"
                      onClick={() => fields.append({ value: "" })}
                    >
                      + Add Executor
                    </button>
                  </div>
                </div>
              </section>
            ) : null}

            {step === 3 ? (
              <section className="neo-raised p-6">
                <h2 className="text-xl font-semibold text-silk-text-primary">Review & Deploy</h2>
                <div className="mt-5 space-y-4">
                  <div className="neo-raised p-5">
                    <div className="text-sm font-semibold text-silk-text-primary">Job summary</div>
                    <p className="mt-3 text-sm leading-7 text-silk-text-secondary">
                      {form.getValues("description")}
                    </p>
                    <div className="mt-4 grid gap-3 text-sm text-silk-text-secondary">
                      <div>Template: {form.getValues("template").replaceAll("_", " ")}</div>
                      <div>Budget: {safeNumber(form.getValues("budgetSol"))} SOL</div>
                      <div>
                        Planner: {form.getValues("plannerSubName")}.{ownerName}
                      </div>
                      <div>
                        Executors:{" "}
                        {form
                          .getValues("executorSubNames")
                          .map((entry) => `${entry.value}.${ownerName}`)
                          .join(", ")}
                      </div>
                    </div>
                  </div>

                  <div className="neo-pill inline-flex items-center gap-3 text-sm font-semibold text-silk-text-primary">
                    Gas estimate: {gasEstimateQuery.isLoading ? "..." : `${gasEstimateQuery.data ?? "0.002"} SOL`}
                  </div>
                </div>

                {deployError ? (
                  <div className="mt-4">
                    <ErrorCard title="Deployment failed" message={deployError} />
                  </div>
                ) : null}
              </section>
            ) : null}

            <div className="flex items-center justify-between gap-4">
              <button
                type="button"
                className="neo-button px-5 py-3 text-sm font-semibold text-silk-text-secondary"
                onClick={() => setStep((current) => Math.max(1, current - 1))}
                disabled={step === 1}
              >
                ← Back
              </button>

              {step < 3 ? (
                <button
                  type="button"
                  className="neo-button inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold text-silk-primary"
                  onClick={() => void moveNext()}
                >
                  Next <ChevronRightIcon className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="submit"
                  className="neo-button w-full max-w-xs px-5 py-4 text-sm font-semibold text-silk-primary"
                  disabled={deploying}
                >
                  {deploying ? "Deploying..." : "Deploy to Solana"}
                </button>
              )}
            </div>
          </div>

          <aside className="space-y-6">
            <div className="neo-raised p-6">
              <div className="text-sm font-semibold text-silk-text-primary">Live preview</div>
              <div className="mt-5">
                <svg className="h-[260px] w-full" viewBox="0 0 300 220">
                  <g transform="translate(30,25)">
                    {previewTree.links().map((link) => (
                      <path
                        key={`${link.source.id}-${link.target.id}`}
                        d={`M ${link.source.x} ${link.source.y} C ${link.source.x} ${(link.source.y + link.target.y) / 2} ${link.target.x} ${(link.source.y + link.target.y) / 2} ${link.target.x} ${link.target.y}`}
                        fill="none"
                        stroke="#6366f1"
                        strokeOpacity="0.28"
                        strokeWidth="1.5"
                      />
                    ))}
                    {previewTree.descendants().map((node) => (
                      <g key={node.id} transform={`translate(${node.x}, ${node.y})`}>
                        <circle r="24" fill="#e8eaf0" filter="url(#previewShadow)" />
                        <circle r="24" fill="none" stroke="#6366f1" strokeWidth="2.5" />
                        <text
                          y="40"
                          textAnchor="middle"
                          className="fill-silk-text-secondary font-mono text-[9px]"
                        >
                          {truncateMiddle(node.data.label, 12, 4)}
                        </text>
                      </g>
                    ))}
                  </g>
                  <defs>
                    <filter id="previewShadow" x="-40%" y="-40%" width="180%" height="180%">
                      <feDropShadow dx="4" dy="4" stdDeviation="5" floodColor="rgba(0,0,0,0.12)" />
                    </filter>
                  </defs>
                </svg>
              </div>
            </div>

            <div className="neo-raised p-6">
              <div className="text-sm font-semibold text-silk-text-primary">Connected owner</div>
              {ownerQuery.isLoading ? (
                <SkeletonBlock className="mt-4 h-12 rounded-[18px]" />
              ) : (
                <div className="neo-inset mt-4 px-4 py-3 text-sm text-silk-primary">
                  {ownerName}
                </div>
              )}
            </div>
          </aside>
        </form>
      </div>
    </div>
  );
}
