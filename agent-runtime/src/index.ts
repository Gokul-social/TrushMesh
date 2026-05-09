import "dotenv/config";
import { readFileSync } from "node:fs";
import process from "node:process";
import * as anchor from "@coral-xyz/anchor";
import axios from "axios";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  type Commitment
} from "@solana/web3.js";
import { initializeJobTx, spawnAgentTx, logDelegationTx, completeJobTx } from "./anchor.js";
import { backend } from "./backend.js";
import { getSolUsdcPrice } from "./jupiter.js";
import { signActionHash, signUtf8Message, sha256Buffer } from "./sign.js";
import { sleep } from "./sleep.js";

const COMMITMENT: Commitment = "confirmed";
const AIRDROP_LAMPORTS = Math.round(0.1 * LAMPORTS_PER_SOL);
const JOB_BUDGET_LAMPORTS = Math.round(0.05 * LAMPORTS_PER_SOL);
const TEMPLATE_PORTFOLIO_REBALANCER = 0;
const AGENT_TYPE_PLANNER = 0;
const AGENT_TYPE_EXECUTOR = 1;
const DEMO_DESCRIPTION = "Rebalance SOL/USDC to 60/40";
const { BN } = anchor;

type StepError = Error & {
  cause?: unknown;
};

function requireEnv(name: "BACKEND_URL" | "BACKEND_JWT" | "ANCHOR_PROGRAM_ID" | "HUMAN_WALLET_KEYPAIR_PATH" | "SOLANA_RPC_URL") {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function loadKeypairFromFile(filePath: string): Keypair {
  const secretKey = JSON.parse(readFileSync(filePath, "utf8")) as number[];
  return Keypair.fromSecretKey(Uint8Array.from(secretKey));
}

function explorerTxUrl(signature: string) {
  return `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
}

function formatErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const payload = error.response?.data;
    if (isRecord(payload)) {
      const mismatch = payload.error === "ONCHAIN_MISMATCH";
      const txHash = typeof payload.txHash === "string" ? payload.txHash : null;
      if (mismatch) {
        return txHash ? `ONCHAIN_MISMATCH (txHash=${txHash})` : "ONCHAIN_MISMATCH";
      }

      if (typeof payload.error === "string") {
        return payload.error;
      }

      if (
        "error" in payload &&
        isRecord(payload.error) &&
        typeof payload.error.message === "string"
      ) {
        return payload.error.message;
      }
    }

    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isAirdropRateLimit(error: unknown) {
  const message = formatErrorMessage(error).toLowerCase();
  return message.includes("429") || message.includes("rate limit") || message.includes("too many requests");
}

async function confirmSignature(connection: Connection, signature: string) {
  await connection.confirmTransaction(signature, COMMITMENT);
}

async function withRpcRetry<T>(action: () => Promise<T>): Promise<T> {
  try {
    return await action();
  } catch (error) {
    await sleep(2);
    return await action().catch((retryError: unknown) => {
      const wrapped = new Error(formatErrorMessage(retryError)) as StepError;
      wrapped.cause = retryError;
      throw wrapped;
    });
  }
}

async function airdropWithRetry(connection: Connection, keypair: Keypair, label: string) {
  const request = async () => {
    const signature = await connection.requestAirdrop(keypair.publicKey, AIRDROP_LAMPORTS);
    await confirmSignature(connection, signature);
    return signature;
  };

  try {
    return await request();
  } catch (error) {
    if (!isAirdropRateLimit(error)) {
      throw error;
    }

    console.log(`   ${label}: airdrop rate limited, retrying in 10s...`);
    await sleep(10);
    return await request();
  }
}

async function postMessageWithFallback(input: {
  jobId: string;
  senderSolName: string;
  receiverSolName?: string;
  action: string;
  txHash: string;
  preferredSigner: Keypair;
  fallbackSigner: Keypair;
}) {
  const preferredSignature = await signUtf8Message(input.action, input.preferredSigner);

  try {
    return await backend.postMessage({
      jobId: input.jobId,
      senderSolName: input.senderSolName,
      receiverSolName: input.receiverSolName,
      action: input.action,
      txHash: input.txHash,
      signatureHex: preferredSignature.toString("hex")
    });
  } catch (error) {
    if (!axios.isAxiosError(error) || error.response?.status !== 422) {
      throw error;
    }

    const payload = error.response.data;
    const backendCode = isRecord(payload) && typeof payload.error === "string" ? payload.error : null;
    if (backendCode !== "INVALID_SIGNATURE") {
      throw error;
    }

    const fallbackSignature = await signUtf8Message(input.action, input.fallbackSigner);
    return await backend.postMessage({
      jobId: input.jobId,
      senderSolName: input.senderSolName,
      receiverSolName: input.receiverSolName,
      action: input.action,
      txHash: input.txHash,
      signatureHex: fallbackSignature.toString("hex")
    });
  }
}

async function runStep<T>(stepNumber: number, action: () => Promise<T>) {
  try {
    return await action();
  } catch (error) {
    throw new Error(`Step ${stepNumber} failed: ${formatErrorMessage(error)}`);
  }
}

async function main() {
  requireEnv("BACKEND_URL");
  requireEnv("BACKEND_JWT");
  requireEnv("ANCHOR_PROGRAM_ID");
  const walletPath = requireEnv("HUMAN_WALLET_KEYPAIR_PATH");
  const rpcUrl = requireEnv("SOLANA_RPC_URL");

  const connection = new Connection(rpcUrl, COMMITMENT);

  const {
    humanWallet,
    plannerKeypair,
    executorKeypair,
    humanSolName
  } = await runStep(0, async () => {
    const humanWalletKeypair = loadKeypairFromFile(walletPath);
    const plannerWallet = Keypair.generate();
    const executorWallet = Keypair.generate();

    await airdropWithRetry(connection, humanWalletKeypair, "Human");
    await airdropWithRetry(connection, plannerWallet, "Planner");
    await airdropWithRetry(connection, executorWallet, "Executor");

    const authUser = await backend.getMe();
    if (!authUser.solName) {
      throw new Error("Authenticated wallet has no favorite .sol name. /auth/me returned null solName.");
    }

    console.log("🚀 TrustMesh Agent Runtime");
    console.log(`   Human: ${authUser.solName}`);
    console.log(`   Planner: ${plannerWallet.publicKey.toBase58()}`);
    console.log(`   Executor: ${executorWallet.publicKey.toBase58()}`);
    console.log("───────────────────────────────────");

    return {
      humanWallet: humanWalletKeypair,
      plannerKeypair: plannerWallet,
      executorKeypair: executorWallet,
      humanSolName: authUser.solName
    };
  });

  await sleep(2);

  const createdJob = await runStep(1, async () => {
    const jobIdBuffer = sha256Buffer(`Portfolio Rebalancer Demo ${Date.now()}`);
    const descriptionHashBuffer = sha256Buffer(DEMO_DESCRIPTION);

    const { jobPda, txHash: initTxHash } = await withRpcRetry(async () => {
      const result = await initializeJobTx({
        connection,
        wallet: humanWallet,
        jobId: jobIdBuffer,
        descriptionHash: descriptionHashBuffer,
        template: TEMPLATE_PORTFOLIO_REBALANCER,
        budgetLamports: new BN(JOB_BUDGET_LAMPORTS)
      });
      await confirmSignature(connection, result.txHash);
      return result;
    });

    const backendJob = await backend.createJob({
      onchainId: jobIdBuffer.toString("hex"),
      description: DEMO_DESCRIPTION,
      template: "PORTFOLIO_REBALANCER",
      budgetSol: 0.05,
      plannerSubName: "planner",
      executorSubNames: ["executor"]
    });

    await backend.activateJob(backendJob.id, initTxHash);

    console.log(`✓ Job created: ${backendJob.id}`);
    console.log(`   TX: ${explorerTxUrl(initTxHash)}`);

    return {
      backendJobId: backendJob.id,
      jobPda,
      jobIdBuffer,
      initTxHash
    };
  });

  await sleep(3);

  const planner = await runStep(2, async () => {
    const plannerSolName = `planner.${humanSolName}`;
    const plannerNameHash = sha256Buffer(plannerSolName);

    const { agentPda, txHash } = await withRpcRetry(async () => {
      const result = await spawnAgentTx({
        connection,
        wallet: humanWallet,
        jobPda: createdJob.jobPda,
        solNameHash: plannerNameHash,
        agentType: AGENT_TYPE_PLANNER,
        agentWallet: plannerKeypair.publicKey,
        parentAgent: null
      });
      await confirmSignature(connection, result.txHash);
      return result;
    });

    const graphAgent = await backend.registerAgent({
      jobId: createdJob.backendJobId,
      solSubName: plannerSolName,
      type: "PLANNER",
      wallet: plannerKeypair.publicKey.toBase58(),
      spawnTxHash: txHash
    });

    console.log(`✓ Planner spawned: ${plannerSolName}`);

    return {
      agentId: graphAgent.id,
      agentPda,
      solName: plannerSolName,
      txHash
    };
  });

  await sleep(2);

  const executor = await runStep(3, async () => {
    const executorSolName = `executor.${humanSolName}`;
    const executorNameHash = sha256Buffer(executorSolName);

    const { agentPda, txHash } = await withRpcRetry(async () => {
      const result = await spawnAgentTx({
        connection,
        wallet: humanWallet,
        jobPda: createdJob.jobPda,
        solNameHash: executorNameHash,
        agentType: AGENT_TYPE_EXECUTOR,
        agentWallet: executorKeypair.publicKey,
        parentAgent: planner.agentPda
      });
      await confirmSignature(connection, result.txHash);
      return result;
    });

    const graphAgent = await backend.registerAgent({
      jobId: createdJob.backendJobId,
      solSubName: executorSolName,
      type: "EXECUTOR",
      wallet: executorKeypair.publicKey.toBase58(),
      parentAgentId: planner.agentId,
      spawnTxHash: txHash
    });

    console.log(`✓ Executor spawned: ${executorSolName}`);

    return {
      agentId: graphAgent.id,
      agentPda,
      solName: executorSolName,
      txHash
    };
  });

  await sleep(3);

  await runStep(4, async () => {
    const action = "Fetch SOL/USDC spot price from Jupiter API";
    const actionHash = sha256Buffer(action);
    const onchainSignature = await signActionHash(actionHash, plannerKeypair);

    const { txHash } = await withRpcRetry(async () => {
      const result = await logDelegationTx({
        connection,
        wallet: plannerKeypair,
        jobPda: createdJob.jobPda,
        senderAgentPda: planner.agentPda,
        receiverAgentPda: executor.agentPda,
        actionHash,
        signature: onchainSignature
      });
      await confirmSignature(connection, result.txHash);
      return result;
    });

    await postMessageWithFallback({
      jobId: createdJob.backendJobId,
      senderSolName: planner.solName,
      receiverSolName: executor.solName,
      action,
      txHash,
      preferredSigner: plannerKeypair,
      fallbackSigner: humanWallet
    });

    console.log("→ Planner delegated: fetch price");
  });

  await sleep(2);

  const price = await runStep(5, async () => {
    const currentPrice = await getSolUsdcPrice();
    console.log(`  SOL/USDC price: $${currentPrice.toFixed(2)}`);
    return currentPrice;
  });

  await sleep(4);

  await runStep(6, async () => {
    const action = `Swap 2.5 SOL for USDC at $${price.toFixed(2)} (simulated)`;
    const actionHash = sha256Buffer(action);
    const onchainSignature = await signActionHash(actionHash, executorKeypair);

    const { txHash } = await withRpcRetry(async () => {
      const result = await logDelegationTx({
        connection,
        wallet: executorKeypair,
        jobPda: createdJob.jobPda,
        senderAgentPda: executor.agentPda,
        receiverAgentPda: null,
        actionHash,
        signature: onchainSignature
      });
      await confirmSignature(connection, result.txHash);
      return result;
    });

    await postMessageWithFallback({
      jobId: createdJob.backendJobId,
      senderSolName: executor.solName,
      action,
      txHash,
      preferredSigner: executorKeypair,
      fallbackSigner: humanWallet
    });

    console.log(`→ Executor logged swap: 2.5 SOL → USDC at $${price.toFixed(2)}`);
  });

  await sleep(3);

  await runStep(7, async () => {
    const action = "Confirm USDC balance post-swap";
    const actionHash = sha256Buffer(action);
    const onchainSignature = await signActionHash(actionHash, plannerKeypair);

    const { txHash } = await withRpcRetry(async () => {
      const result = await logDelegationTx({
        connection,
        wallet: plannerKeypair,
        jobPda: createdJob.jobPda,
        senderAgentPda: planner.agentPda,
        receiverAgentPda: executor.agentPda,
        actionHash,
        signature: onchainSignature
      });
      await confirmSignature(connection, result.txHash);
      return result;
    });

    await postMessageWithFallback({
      jobId: createdJob.backendJobId,
      senderSolName: planner.solName,
      receiverSolName: executor.solName,
      action,
      txHash,
      preferredSigner: plannerKeypair,
      fallbackSigner: humanWallet
    });

    console.log("→ Planner delegated: confirm balance");
  });

  await sleep(2);

  await runStep(8, async () => {
    const action = "Balance confirmed: 355.75 USDC received";
    const actionHash = sha256Buffer(action);
    const onchainSignature = await signActionHash(actionHash, executorKeypair);

    const { txHash } = await withRpcRetry(async () => {
      const result = await logDelegationTx({
        connection,
        wallet: executorKeypair,
        jobPda: createdJob.jobPda,
        senderAgentPda: executor.agentPda,
        receiverAgentPda: null,
        actionHash,
        signature: onchainSignature
      });
      await confirmSignature(connection, result.txHash);
      return result;
    });

    await postMessageWithFallback({
      jobId: createdJob.backendJobId,
      senderSolName: executor.solName,
      action,
      txHash,
      preferredSigner: executorKeypair,
      fallbackSigner: humanWallet
    });

    console.log("→ Executor confirmed balance");
  });

  await sleep(2);

  await runStep(9, async () => {
    const { txHash } = await withRpcRetry(async () => {
      const result = await completeJobTx({
        connection,
        wallet: humanWallet,
        jobPda: createdJob.jobPda
      });
      await confirmSignature(connection, result.txHash);
      return result;
    });

    await backend.completeJob(createdJob.backendJobId);

    console.log("✓ Job completed");
    console.log("─────────────────────────────────");
    console.log("🎉 TrustMesh demo complete!");
    console.log(`   Open http://localhost:5173/jobs/${createdJob.backendJobId}`);
    console.log(`   Final TX: ${explorerTxUrl(txHash)}`);
  });

  process.exit(0);
}

void main().catch((error: unknown) => {
  console.error(`❌ ${formatErrorMessage(error)}`);
  process.exit(1);
});
