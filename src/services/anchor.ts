import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";
import { Keypair, PublicKey } from "@solana/web3.js";
import { env } from "../lib/env.js";
import { logger } from "../lib/logger.js";
import { connection } from "../lib/solana.js";
import { trustmeshIdl } from "../idl/trustmesh.js";

const idl = {
  ...trustmeshIdl,
  address: env.ANCHOR_PROGRAM_ID
};
const provider = new AnchorProvider(connection, new Wallet(Keypair.generate()), {
  commitment: "confirmed"
});
const program = new Program(idl, provider);

type DelegationVerification = {
  verified: boolean;
  senderWallet: string;
  receiverWallet: string | null;
  actionHash: string;
  loggedAt: number;
};

type AgentAccountData = {
  status: number;
  actionCount: number;
  solNameHash: string;
};

export class AnchorVerificationError extends Error {
  constructor(public readonly txHash: string, reason: string) {
    super(`Anchor: verification failed for tx ${txHash} — ${reason}`);
    this.name = "AnchorVerificationError";
  }
}

export type AnchorVerifier = {
  verifyDelegationLog(txHash: string): Promise<DelegationVerification>;
  verifyRevocationTx(txHash: string, agentWallet: string): Promise<boolean>;
  verifyJobInit(txHash: string, jobOnchainId: string): Promise<boolean>;
  getAgentAccountData(jobPubkey: PublicKey, agentWallet: string): Promise<AgentAccountData | null>;
  deriveJobPda(ownerWallet: string, jobOnchainId: string): PublicKey;
};

export async function verifyDelegationLog(txHash: string): Promise<DelegationVerification> {
  const event = await findEvent(txHash, "DelegationLogged");
  if (!event) {
    throw new AnchorVerificationError(txHash, "DelegationLogged event not found");
  }

  return {
    verified: readBoolean(event.data, ["verified"]),
    senderWallet: readPublicKey(event.data, ["senderWallet", "sender", "agentWallet"], txHash, "sender"),
    receiverWallet: readOptionalPublicKey(event.data, ["receiverWallet", "receiver"]),
    actionHash: readHex(event.data, ["actionHash"], txHash, "actionHash"),
    loggedAt: readNumber(event.data, ["loggedAt", "timestamp"], txHash, "loggedAt")
  };
}

export async function verifyRevocationTx(txHash: string, agentWallet: string): Promise<boolean> {
  const event = await findEvent(txHash, "AgentRevoked");
  if (!event) {
    return false;
  }

  const eventAgentWallet = readOptionalPublicKey(event.data, ["agentWallet", "agent"]);
  return eventAgentWallet === agentWallet;
}

export async function verifyJobInit(txHash: string, jobOnchainId: string): Promise<boolean> {
  const event = await findEvent(txHash, "JobInitialized");
  if (!event) {
    return false;
  }

  return readHex(event.data, ["jobId"], txHash, "jobId").toLowerCase() === jobOnchainId.toLowerCase();
}

export async function getAgentAccountData(
  jobPubkey: PublicKey,
  agentWallet: string
): Promise<AgentAccountData | null> {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("agent"), jobPubkey.toBuffer(), new PublicKey(agentWallet).toBuffer()],
    program.programId
  );

  const accountNamespace = (program.account as unknown as Record<string, unknown>)["agentAccount"] as {
    fetchNullable(address: PublicKey): Promise<unknown>;
  };
  const account = await accountNamespace.fetchNullable(pda);
  if (!account) {
    return null;
  }

  return {
    status: readNumber(account, ["status"], "account", "status"),
    actionCount: readNumber(account, ["actionCount"], "account", "actionCount"),
    solNameHash: readHex(account, ["solNameHash"], "account", "solNameHash")
  };
}

export function deriveJobPda(ownerWallet: string, jobOnchainId: string): PublicKey {
  const [jobPda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("job"),
      new PublicKey(ownerWallet).toBuffer(),
      Buffer.from(jobOnchainId, "hex")
    ],
    program.programId
  );

  return jobPda;
}

export const anchorService: AnchorVerifier = {
  verifyDelegationLog,
  verifyRevocationTx,
  verifyJobInit,
  getAgentAccountData,
  deriveJobPda
};

async function findEvent(txHash: string, eventName: string) {
  const transaction = await connection.getParsedTransaction(txHash, {
    commitment: "confirmed",
    maxSupportedTransactionVersion: 0
  });

  if (!transaction) {
    throw new AnchorVerificationError(txHash, "transaction not found");
  }

  const logs = transaction.meta?.logMessages ?? [];
  for (const log of logs) {
    try {
      const decoded = program.coder.events.decode(log);
      if (decoded?.name === eventName) {
        return decoded;
      }
    } catch (error) {
      logger.debug({ err: error, txHash, log }, "skipping undecodable Anchor log");
    }
  }

  return null;
}

function readBoolean(source: unknown, keys: string[]) {
  const value = readValue(source, keys);
  return typeof value === "boolean" ? value : Boolean(value);
}

function readOptionalPublicKey(source: unknown, keys: string[]) {
  const value = readValue(source, keys);
  if (!value) {
    return null;
  }
  return coercePublicKeyString(value);
}

function readPublicKey(source: unknown, keys: string[], txHash: string, field: string) {
  const value = readOptionalPublicKey(source, keys);
  if (!value) {
    throw new AnchorVerificationError(txHash, `missing ${field}`);
  }
  return value;
}

function readHex(source: unknown, keys: string[], txHash: string, field: string) {
  const value = readValue(source, keys);
  if (!value) {
    throw new AnchorVerificationError(txHash, `missing ${field}`);
  }

  if (isUint8ArrayLike(value)) {
    return Buffer.from(value).toString("hex");
  }

  if (isNumberArray(value)) {
    return Buffer.from(value).toString("hex");
  }

  throw new AnchorVerificationError(txHash, `invalid ${field}`);
}

function readNumber(source: unknown, keys: string[], txHash: string, field: string) {
  const value = readValue(source, keys);
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "bigint") {
    return Number(value);
  }
  if (hasToNumber(value)) {
    return value.toNumber();
  }
  if (typeof value === "string") {
    return Number(value);
  }

  throw new AnchorVerificationError(txHash, `invalid ${field}`);
}

function readValue(source: unknown, keys: string[]) {
  if (typeof source !== "object" || source === null) {
    return null;
  }

  const record = source as Record<string, unknown>;

  for (const key of keys) {
    if (key in record) {
      return record[key];
    }
  }

  return null;
}

function coercePublicKeyString(value: unknown) {
  if (typeof value === "string") {
    return value;
  }

  if (value && typeof value === "object" && "toBase58" in value && typeof value.toBase58 === "function") {
    return value.toBase58() as string;
  }

  return null;
}

function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((item) => typeof item === "number");
}

function isUint8ArrayLike(value: unknown): value is Uint8Array | Buffer {
  return value instanceof Uint8Array || Buffer.isBuffer(value);
}

function hasToNumber(value: unknown): value is { toNumber(): number } {
  return (
    value !== null &&
    typeof value === "object" &&
    "toNumber" in value &&
    typeof (value as { toNumber?: unknown }).toNumber === "function"
  );
}
