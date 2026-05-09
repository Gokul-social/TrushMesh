import bs58 from "bs58";
import nacl from "tweetnacl";
import { describe, expect, it } from "vitest";
import { Keypair } from "@solana/web3.js";
import { makeTestApp } from "./helpers.js";

describe("auth flow", () => {
  it("issues a SIWS challenge and verifies a wallet signature", async () => {
    const keypair = Keypair.generate();
    const walletAddr = keypair.publicKey.toBase58();
    const app = await makeTestApp({
      prisma: {
        user: {
          findUnique: async () => ({
            id: "user_auth",
            walletAddr,
            solName: "alice.sol",
            createdAt: new Date("2026-05-08T00:00:00.000Z")
          }),
          upsert: async () => ({
            id: "user_auth",
            walletAddr,
            solName: "alice.sol",
            createdAt: new Date("2026-05-08T00:00:00.000Z")
          }),
          update: async () => ({
            id: "user_auth",
            walletAddr,
            solName: "alice.sol",
            createdAt: new Date("2026-05-08T00:00:00.000Z")
          })
        }
      }
    });

    const challenge = await app.inject({
      method: "POST",
      url: "/api/v1/auth/challenge",
      payload: { walletAddr }
    });

    expect(challenge.statusCode).toBe(200);

    const challengeBody = JSON.parse(challenge.body) as { data: { message: string } };
    const message = challengeBody.data.message;
    const signature = bs58.encode(nacl.sign.detached(new TextEncoder().encode(message), keypair.secretKey));

    const verified = await app.inject({
      method: "POST",
      url: "/api/v1/auth/verify",
      payload: { walletAddr, message, signature }
    });

    expect(verified.statusCode).toBe(200);
    const verifiedBody = JSON.parse(verified.body) as { data: { token: string } };

    expect(verifiedBody.data.token).toEqual(expect.any(String));

    const me = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: {
        Authorization: `Bearer ${verifiedBody.data.token}`
      }
    });

    expect(me.statusCode).toBe(200);
    const meBody = JSON.parse(me.body) as { data: { walletAddr: string; solName: string } };
    expect(meBody.data.walletAddr).toBe(walletAddr);
    expect(meBody.data.solName).toBe("alice.sol");

    await app.close();
  });
});
