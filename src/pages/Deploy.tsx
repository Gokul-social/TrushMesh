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
import { z } from "zod";
import { Buffer } from "buffer";
import { apiClient } from "../lib/axios";
import { randomHex, safeNumber, sha256Hex, unwrapEnvelope } from "../lib/utils";
import type { ApiEnvelope, AuthUser, Job, JobTemplate } from "../types";
import {
  ArrowLeftIcon,
  CheckIcon,
  ChevronRightIcon,
  FingerprintIcon,
  LockIcon,
  PlusIcon,
  RocketIcon
} from "../components/Icons";
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

const templateOptions: Array<{
  value: JobTemplate;
  label: string;
  description: string;
}> = [
  {
    value: "PORTFOLIO_REBALANCER",
    label: "Portfolio Rebalancer",
    description: "Coordinate trading agents against target allocations."
  },
  {
    value: "DAO_VOTER",
    label: "DAO Voter",
    description: "Run governance review, verification, and execution flows."
  },
  {
    value: "DATA_FETCHER",
    label: "Data Fetcher",
    description: "Ingest, sanitize, and route external data to executors."
  }
];

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

function formatTemplateLabel(template: JobTemplate) {
  return template.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

function StepMarker({
  step,
  currentStep,
  label
}: {
  step: number;
  currentStep: number;
  label: string;
}) {
  const complete = currentStep > step;
  const active = currentStep === step;

  return (
    <div className="relative flex flex-1 flex-col items-center">
      <div
        className={
          active
            ? "flex h-12 w-12 items-center justify-center rounded-full bg-silk-primary text-sm font-bold text-white shadow-[0_14px_24px_rgba(99,102,241,0.24)]"
            : complete
              ? "flex h-12 w-12 items-center justify-center rounded-full bg-silk-primary/85 text-sm font-bold text-white shadow-neo"
              : "neo-raised flex h-12 w-12 items-center justify-center rounded-full text-sm font-bold text-silk-text-secondary"
        }
      >
        {complete ? <CheckIcon className="h-5 w-5" /> : step}
      </div>
      <span
        className={
          active
            ? "mt-3 text-xs font-semibold text-silk-primary"
            : complete
              ? "mt-3 text-xs font-semibold text-silk-text-primary"
              : "mt-3 text-xs font-medium text-silk-text-secondary"
        }
      >
        {label}
      </span>
    </div>
  );
}

function PreviewNode({
  eyebrow,
  label,
  caption,
  accent = "primary"
}: {
  eyebrow: string;
  label: string;
  caption: string;
  accent?: "primary" | "secondary" | "neutral";
}) {
  const accentClasses =
    accent === "secondary"
      ? "border-silk-secondary/20"
      : accent === "neutral"
        ? "border-white/60"
        : "border-silk-primary/20";

  return (
    <div className={`tm-shell-card w-full max-w-[220px] border-2 ${accentClasses} px-4 py-4 text-center`}>
      <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-silk-text-tertiary">
        {eyebrow}
      </div>
      <div className="mt-2 truncate text-sm font-semibold text-silk-text-primary">{label}</div>
      <div className="mt-1 text-[11px] text-silk-text-secondary">{caption}</div>
    </div>
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
  const selectedTemplate = form.watch("template");
  const executorEntries = form.watch("executorSubNames");
  const debouncedPlannerName = useDebouncedValue(plannerName, 400);
  const ownerName = ownerQuery.data?.solName ?? (wallet.publicKey ? "connected.sol" : "owner.sol");
  const fullPlannerName = plannerName ? `${plannerName}.${ownerName}` : `planner.${ownerName}`;
  const executorNames = executorEntries.map(({ value }, index) =>
    value ? `${value}.${ownerName}` : `executor-${index + 1}.${ownerName}`
  );

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
        [Buffer.from("job"), anchorWallet.publicKey.toBuffer(), Buffer.from(onchainId, "hex")],
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
    <div className="min-h-[calc(100vh-5rem)] p-4 pb-24 md:p-6 lg:p-8">
      <div className="mx-auto max-w-[1340px]">
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-semibold tracking-tight text-silk-text-primary md:text-5xl">
            Deploy Agent
          </h1>
          <p className="mt-3 text-base text-silk-text-secondary">
            Initialize a new autonomous coordination mesh on Solana
          </p>
        </div>

        <div className="relative mx-auto mb-10 hidden max-w-4xl md:block">
          <div className="absolute left-[10%] right-[10%] top-6 h-1 rounded-full bg-white/70 shadow-neoInset" />
          <div className="absolute left-[10%] right-[10%] top-6">
            <div
              className="h-1 rounded-full bg-gradient-to-r from-silk-primary to-silk-secondary transition-all duration-300"
              style={{ width: `${((step - 1) / 2) * 100}%` }}
            />
          </div>
          <div className="relative flex items-start justify-between gap-4">
            <StepMarker step={1} currentStep={step} label="Configure" />
            <StepMarker step={2} currentStep={step} label="Identities" />
            <StepMarker step={3} currentStep={step} label="Review" />
          </div>
        </div>

        <form className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_380px]" onSubmit={deployJob}>
          <div className="space-y-8">
            {step === 1 ? (
              <motion.section
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                className="tm-shell-card p-8"
              >
                <div className="flex items-center gap-3">
                  <RocketIcon className="h-5 w-5 text-silk-primary" />
                  <h2 className="text-2xl font-semibold text-silk-text-primary">Configure deployment</h2>
                </div>

                <div className="mt-8 space-y-6">
                  <div>
                    <label className="mb-3 block text-sm font-medium text-silk-text-secondary">
                      Job description
                    </label>
                    <textarea
                      rows={6}
                      className="neo-input resize-none rounded-[22px]"
                      placeholder="Describe the coordination objective, required agents, and expected output..."
                      {...form.register("description")}
                    />
                    <p className="mt-2 text-xs text-red-500">{form.formState.errors.description?.message}</p>
                  </div>

                  <div>
                    <label className="mb-3 block text-sm font-medium text-silk-text-secondary">
                      Mesh template
                    </label>
                    <div className="grid gap-4 lg:grid-cols-3">
                      {templateOptions.map((option) => {
                        const active = selectedTemplate === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            className={
                              active
                                ? "rounded-[24px] border border-silk-primary/30 bg-silk-bg px-5 py-5 text-left shadow-neoInset"
                                : "rounded-[24px] border border-white/70 bg-silk-bg px-5 py-5 text-left shadow-neo"
                            }
                            onClick={() => form.setValue("template", option.value, { shouldValidate: true })}
                          >
                            <div className="text-sm font-semibold text-silk-text-primary">{option.label}</div>
                            <div className="mt-2 text-sm leading-7 text-silk-text-secondary">
                              {option.description}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="mb-3 block text-sm font-medium text-silk-text-secondary">
                      Budget in SOL
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      max="100"
                      className="neo-input rounded-[22px]"
                      {...form.register("budgetSol")}
                    />
                    <p className="mt-2 text-xs text-red-500">{form.formState.errors.budgetSol?.message}</p>
                  </div>
                </div>
              </motion.section>
            ) : null}

            {step === 2 ? (
              <motion.section
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                className="tm-shell-card p-8"
              >
                <div className="flex items-center gap-3">
                  <FingerprintIcon className="h-5 w-5 text-silk-secondary" />
                  <h2 className="text-2xl font-semibold text-silk-text-primary">Assign .sol identities</h2>
                </div>

                <div className="mt-8 space-y-6">
                  <div>
                    <label className="mb-3 block text-sm font-medium text-silk-text-secondary">Mesh Owner</label>
                    <div className="neo-inset flex items-center justify-between rounded-[22px] px-5 py-4">
                      <span className="font-mono text-base text-silk-primary">
                        {ownerQuery.isLoading ? "Resolving..." : ownerName}
                      </span>
                      <LockIcon className="h-4 w-4 text-silk-text-secondary" />
                    </div>
                  </div>

                  <div>
                    <label className="mb-3 block text-sm font-medium text-silk-text-secondary">
                      Planner Node sub-name
                    </label>
                    <div className="flex items-center gap-3">
                      <div className="relative flex-1">
                        <input
                          className="neo-input rounded-[22px] pr-12"
                          placeholder="alpha-planner"
                          {...form.register("plannerSubName")}
                        />
                        {plannerValidationQuery.data?.valid ? (
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-500">
                            <CheckIcon className="h-5 w-5" />
                          </span>
                        ) : null}
                      </div>
                      <span className="font-mono text-lg text-silk-text-secondary">.{ownerName}</span>
                    </div>
                    <p className="mt-2 text-xs italic text-silk-text-secondary">
                      This identity coordinates sub-tasks and assigns workloads.
                    </p>
                    <p className="mt-2 text-xs text-red-500">{form.formState.errors.plannerSubName?.message}</p>
                  </div>

                  <div>
                    <label className="mb-3 block text-sm font-medium text-silk-text-secondary">
                      Executor Node sub-name(s)
                    </label>
                    <div className="space-y-3">
                      {fields.fields.map((field, index) => (
                        <div key={field.id} className="flex items-center gap-3">
                          <input
                            className="neo-input rounded-[22px]"
                            placeholder={`exec-bot-${index + 1}`}
                            {...form.register(`executorSubNames.${index}.value`)}
                          />
                          <span className="hidden font-mono text-silk-text-secondary md:block">.{ownerName}</span>
                          <button
                            type="button"
                            className="neo-button rounded-[18px] px-4 py-3 text-sm text-silk-text-secondary"
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
                      className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-silk-primary"
                      onClick={() => fields.append({ value: "" })}
                    >
                      <PlusIcon className="h-4 w-4" />
                      <span>Add Another Executor</span>
                    </button>
                  </div>
                </div>
              </motion.section>
            ) : null}

            {step === 3 ? (
              <motion.section
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                className="tm-shell-card p-8"
              >
                <div className="flex items-center gap-3">
                  <CheckIcon className="h-5 w-5 text-emerald-500" />
                  <h2 className="text-2xl font-semibold text-silk-text-primary">Review & deploy</h2>
                </div>

                <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_220px]">
                  <div className="rounded-[26px] border border-white/70 bg-silk-bg p-6 shadow-neoInset">
                    <div className="text-sm font-semibold text-silk-text-primary">Deployment summary</div>
                    <p className="mt-4 text-sm leading-8 text-silk-text-secondary">
                      {form.getValues("description")}
                    </p>
                    <div className="mt-6 grid gap-3 text-sm text-silk-text-secondary">
                      <div>Template: {formatTemplateLabel(form.getValues("template"))}</div>
                      <div>Budget: {safeNumber(form.getValues("budgetSol"))} SOL</div>
                      <div>Planner: {fullPlannerName}</div>
                      <div>Executors: {executorNames.join(", ")}</div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="tm-shell-card p-5">
                      <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-silk-text-tertiary">
                        Gas estimate
                      </div>
                      <div className="mt-3 text-2xl font-semibold text-silk-primary">
                        {gasEstimateQuery.isLoading ? "..." : `${gasEstimateQuery.data ?? "0.002"} SOL`}
                      </div>
                    </div>
                    <div className="tm-shell-card p-5">
                      <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-silk-text-tertiary">
                        Ownership
                      </div>
                      <div className="mt-3 font-mono text-sm text-silk-text-primary">{ownerName}</div>
                    </div>
                  </div>
                </div>

                {deployError ? (
                  <div className="mt-6">
                    <ErrorCard title="Deployment failed" message={deployError} />
                  </div>
                ) : null}
              </motion.section>
            ) : null}

            <div className="flex flex-col justify-between gap-4 sm:flex-row">
              <button
                type="button"
                className="tm-button-ghost gap-2 self-start"
                onClick={() => setStep((current) => Math.max(1, current - 1))}
                disabled={step === 1}
              >
                <ArrowLeftIcon className="h-4 w-4" />
                <span>Back</span>
              </button>

              {step < 3 ? (
                <button type="button" className="tm-button-primary gap-2" onClick={() => void moveNext()}>
                  <span>Next Step</span>
                  <ChevronRightIcon className="h-4 w-4" />
                </button>
              ) : (
                <button type="submit" className="tm-button-primary gap-2" disabled={deploying}>
                  <span>{deploying ? "Deploying..." : "Deploy to Solana"}</span>
                  <RocketIcon className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          <aside className="space-y-6">
            <div className="tm-shell-card sticky top-28 p-6">
              <div className="flex items-center justify-between">
                <h3 className="text-[11px] font-bold uppercase tracking-[0.22em] text-silk-text-tertiary">
                  Agent tree preview
                </h3>
                <span className="rounded-full bg-silk-primary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-silk-primary">
                  Live
                </span>
              </div>

              <div className="mt-8 flex flex-col items-center">
                <PreviewNode eyebrow="Owner" label={ownerName} caption="Mesh owner" />
                <div className="h-8 w-px bg-silk-primary/20" />
                <PreviewNode
                  eyebrow="Planner Node"
                  label={fullPlannerName}
                  caption="Coordinates workload"
                  accent="secondary"
                />
                <div className="mt-8 h-px w-full max-w-[240px] bg-silk-primary/20" />
                <div className="mt-4 grid w-full gap-4 sm:grid-cols-2 xl:grid-cols-1">
                  {executorNames.map((name, index) => (
                    <PreviewNode
                      key={`${name}-${index}`}
                      eyebrow={`Executor ${String.fromCharCode(65 + index)}`}
                      label={name}
                      caption="Ready for delegation"
                      accent="neutral"
                    />
                  ))}
                  <div className="flex min-h-[112px] items-center justify-center rounded-[24px] border border-dashed border-silk-text-tertiary/40 bg-silk-bg/60 px-4 text-center text-xs font-semibold uppercase tracking-[0.22em] text-silk-text-tertiary shadow-neoInset">
                    Pending slot
                  </div>
                </div>
              </div>

              <div className="mt-8 border-t border-white/60 pt-6">
                <div className="flex items-center justify-between text-sm text-silk-text-secondary">
                  <span>Estimated Rent (SOL)</span>
                  <span className="font-mono font-semibold text-silk-text-primary">~0.0125</span>
                </div>
                <div className="mt-3 flex items-center justify-between text-sm text-silk-text-secondary">
                  <span>Identity Registration</span>
                  <span className="font-mono font-semibold text-silk-text-primary">~0.0050</span>
                </div>
              </div>
            </div>

            <div className="tm-shell-card p-6">
              <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-silk-text-tertiary">
                Connected owner
              </div>
              {ownerQuery.isLoading ? (
                <SkeletonBlock className="mt-4 h-12 rounded-[18px]" />
              ) : (
                <div className="neo-inset mt-4 rounded-[20px] px-4 py-3 text-sm font-mono text-silk-primary">
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
