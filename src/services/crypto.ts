import { randomBytes } from "node:crypto";
import * as ed from "@noble/ed25519";
import bs58 from "bs58";
import { PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";

const encoder = new TextEncoder();

export function createNonce() {
  return randomBytes(24).toString("base64url");
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
  return message.match(/^Nonce:\s*(.+)$/mu)?.[1]?.trim() ?? null;
}

export function verifyWalletSignature(message: string, signature: string, walletAddr: string) {
  const signatureBytes = decodeSignature(signature);
  const publicKey = new PublicKey(walletAddr);
  return nacl.sign.detached.verify(encoder.encode(message), signatureBytes, publicKey.toBytes());
}

export async function verifyEd25519Signature(
  message: string,
  signatureHex: string,
  walletAddress: string
): Promise<boolean> {
  try {
    const messageBytes = Buffer.from(message, "utf8");
    const sigBytes = Buffer.from(signatureHex, "hex");
    const pubKeyBytes = new PublicKey(walletAddress).toBytes();
    return await ed.verify(sigBytes, messageBytes, pubKeyBytes);
  } catch {
    return false;
  }
}

export function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function decodeSignature(signature: string) {
  if (/^[0-9a-fA-F]{128}$/.test(signature)) {
    return Buffer.from(signature, "hex");
  }

  try {
    const decoded = bs58.decode(signature);
    if (decoded.length === 64) {
      return decoded;
    }
  } catch {
    // Fall through to base64 handling.
  }

  const base64 = Buffer.from(signature, "base64");
  if (base64.length === 64) {
    return new Uint8Array(base64);
  }

  throw new Error("Invalid signature encoding");
}
