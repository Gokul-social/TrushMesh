import { createHash } from "node:crypto";
import * as ed25519 from "@noble/ed25519";
import { Keypair } from "@solana/web3.js";

export function sha256Buffer(value: string | Uint8Array): Buffer {
  return createHash("sha256").update(value).digest();
}

export async function signUtf8Message(message: string, keypair: Keypair): Promise<Buffer> {
  const messageBytes = Buffer.from(message, "utf8");
  const secretKey = keypair.secretKey.slice(0, 32);
  const signature = await ed25519.sign(messageBytes, secretKey);
  return Buffer.from(signature);
}

export async function signActionHash(actionHash: Buffer, keypair: Keypair): Promise<Buffer> {
  const secretKey = keypair.secretKey.slice(0, 32);
  const signature = await ed25519.sign(actionHash, secretKey);
  return Buffer.from(signature);
}
