import { createHash } from "node:crypto";
import { Connection, PublicKey } from "@solana/web3.js";
import { REDIS_KEYS } from "../lib/constants.js";
import { AppError } from "../lib/errors.js";
import { env } from "../lib/env.js";
import { getJson, RedisLike, setJson } from "./redis.js";

export type SnsResolver = {
  resolveNameToWallet(solName: string): Promise<string>;
  resolveWalletToName(wallet: string): Promise<string | null>;
};

export class SnsService implements SnsResolver {
  private readonly ttlSeconds = 300;
  private readonly nameProgramId = new PublicKey(env.SNS_PROGRAM_ID);
  private readonly rootDomainAccount = new PublicKey("58PwtjSDuFHuUkYjH9BYnnQKHfwo9reZhC2zMJv9JPkx");
  private readonly reverseLookupClass = new PublicKey("jCebN34bUfdeUYJT13J1yG16XWQpt5PDx6Mse9GUqhR");

  constructor(
    private readonly redis: RedisLike,
    private readonly connection = new Connection(env.SOLANA_RPC_URL, "confirmed")
  ) {}

  async resolveNameToWallet(solName: string) {
    const normalized = solName.toLowerCase();
    const cached = await getJson<string>(this.redis, REDIS_KEYS.snsName(normalized));
    if (cached) {
      return cached;
    }

    const wallet = await this.resolveNameViaSdk(normalized);
    if (!wallet) {
      throw new AppError("NOT_FOUND", `Could not resolve SNS name ${normalized}`);
    }

    await setJson(this.redis, REDIS_KEYS.snsName(normalized), wallet, this.ttlSeconds);
    await setJson(this.redis, REDIS_KEYS.snsWallet(wallet), normalized, this.ttlSeconds);
    return wallet;
  }

  async resolveWalletToName(wallet: string) {
    const cached = await getJson<string>(this.redis, REDIS_KEYS.snsWallet(wallet));
    if (cached) {
      return cached;
    }

    const solName = await this.resolveWalletViaSdk(wallet);
    if (solName) {
      await setJson(this.redis, REDIS_KEYS.snsWallet(wallet), solName, this.ttlSeconds);
      await setJson(this.redis, REDIS_KEYS.snsName(solName), wallet, this.ttlSeconds);
    }
    return solName;
  }

  private async resolveNameViaSdk(solName: string) {
    try {
      const { pubkey } = this.getDomainKey(solName);
      const account = await this.connection.getAccountInfo(pubkey, "confirmed");
      if (!account?.data || account.data.length < 96) {
        return null;
      }
      return new PublicKey(account.data.slice(32, 64)).toBase58();
    } catch {
      return null;
    }
  }

  private async resolveWalletViaSdk(wallet: string) {
    try {
      const owner = new PublicKey(wallet);
      const domains = await this.connection.getProgramAccounts(this.nameProgramId, {
        filters: [
          { memcmp: { offset: 32, bytes: owner.toBase58() } },
          { memcmp: { offset: 0, bytes: this.rootDomainAccount.toBase58() } }
        ],
        dataSlice: { offset: 0, length: 0 }
      });
      if (domains.length === 0) {
        return null;
      }
      const name = await this.reverseLookup(domains[0].pubkey);
      return name.endsWith(".sol") ? name : `${name}.sol`;
    } catch {
      return null;
    }
  }

  private getDomainKey(domain: string): { pubkey: PublicKey; parent?: PublicKey } {
    const normalized = domain.endsWith(".sol") ? domain.slice(0, -4) : domain;
    const parts = normalized.split(".");

    if (parts.length === 1) {
      const hashed = this.getHashedName(parts[0]);
      return {
        pubkey: this.getNameAccountKey(hashed, undefined, this.rootDomainAccount)
      };
    }

    if (parts.length === 2) {
      const parent = this.getDomainKey(parts[1]).pubkey;
      const hashed = this.getHashedName(`\0${parts[0]}`);
      return {
        pubkey: this.getNameAccountKey(hashed, undefined, parent),
        parent
      };
    }

    throw new AppError("VALIDATION_ERROR", "SNS sub-name depth greater than one is not supported");
  }

  private async reverseLookup(nameAccount: PublicKey) {
    const hashed = this.getHashedName(nameAccount.toBase58());
    const reverseAccount = this.getNameAccountKey(hashed, this.reverseLookupClass);
    const account = await this.connection.getAccountInfo(reverseAccount, "confirmed");
    if (!account?.data || account.data.length < 100) {
      throw new AppError("NOT_FOUND", "Reverse SNS account not found");
    }

    const data = account.data.slice(96);
    const length = data.slice(0, 4).readUInt32LE(0);
    return data.slice(4, 4 + length).toString().replace(/^\0/, "");
  }

  private getHashedName(name: string) {
    return createHash("sha256").update(`SPL Name Service${name}`, "utf8").digest();
  }

  private getNameAccountKey(hashedName: Buffer, nameClass?: PublicKey, nameParent?: PublicKey) {
    return PublicKey.findProgramAddressSync(
      [
        hashedName,
        nameClass?.toBuffer() ?? Buffer.alloc(32),
        nameParent?.toBuffer() ?? Buffer.alloc(32)
      ],
      this.nameProgramId
    )[0];
  }
}
