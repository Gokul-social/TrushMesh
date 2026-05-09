import { randomBytes } from "node:crypto";
import bs58 from "bs58";
import { PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";

const encoder = new TextEncoder();

export function createNonce() {
  return randomBytes(24).toString("base64url");
}

export function canonicalAgentMessage(input: {
  jobId: string;
  senderSolName: string;
  receiverSolName: string | null;
  action: string;
  txHash: string;
}) {
  return [
    "TrustMesh Agent Message",
    `Job: ${input.jobId}`,
    `Sender: ${input.senderSolName}`,
    `Receiver: ${input.receiverSolName ?? "ONCHAIN"}`,
    `Action: ${input.action}`,
    `Tx: ${input.txHash}`
  ].join("\n");
}

export function buildSiwsMessage(input: {
  walletAddr: string;
  nonce: string;
  issuedAt: Date;
  expiresAt: Date;
  domain: string;
}) {
  return [
    `${input.domain} wants you to sign in with your Solana account:`,
    input.walletAddr,
    "",
    "Sign in to TrustMesh.",
    "",
    `URI: ${input.domain}`,
    "Version: 1",
    "Chain ID: solana",
    `Nonce: ${input.nonce}`,
    `Issued At: ${input.issuedAt.toISOString()}`,
    `Expiration Time: ${input.expiresAt.toISOString()}`
  ].join("\n");
}

export function extractSiwsNonce(message: string) {
  return message.match(/^Nonce:\s*(.+)$/m)?.[1]?.trim() ?? null;
}

export function verifyWalletSignature(message: string, signature: string, walletAddr: string) {
  const signatureBytes = decodeSignature(signature);
  const publicKey = new PublicKey(walletAddr);
  return nacl.sign.detached.verify(encoder.encode(message), signatureBytes, publicKey.toBytes());
}

export function verifyAgentMessage(message: string, signatureHex: string, agentWallet: string) {
  const signatureBytes = hexToBytes(signatureHex);
  const publicKey = new PublicKey(agentWallet);
  return nacl.sign.detached.verify(encoder.encode(message), signatureBytes, publicKey.toBytes());
}

export function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function decodeSignature(signature: string) {
  if (/^[0-9a-fA-F]{128}$/.test(signature)) {
    return hexToBytes(signature);
  }

  try {
    const decoded = bs58.decode(signature);
    if (decoded.length === 64) {
      return decoded;
    }
  } catch {
    // Try base64 below.
  }

  const base64 = Buffer.from(signature, "base64");
  if (base64.length === 64) {
    return new Uint8Array(base64);
  }

  throw new Error("Invalid signature encoding");
}

function hexToBytes(hex: string) {
  if (!/^[0-9a-fA-F]{128}$/.test(hex)) {
    throw new Error("Invalid Ed25519 signature hex");
  }
  const bytes = new Uint8Array(64);
  for (let i = 0; i < 64; i += 1) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}
