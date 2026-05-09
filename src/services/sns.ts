import * as snsSdk from "@bonfida/spl-name-service";
import { PublicKey } from "@solana/web3.js";
import { redis, type RedisLike } from "../lib/redis.js";
import { connection } from "../lib/solana.js";

const TTL_SECONDS = 300;
const NULL_CACHE_VALUE = "__NULL__";
const {
  NameRegistryState,
  ROOT_DOMAIN_ACCOUNT,
  getFavoriteDomain,
  getHashedName,
  getNameAccountKey
} = snsSdk as unknown as {
  NameRegistryState: {
    retrieve(connectionArg: typeof connection, nameAccountKey: PublicKey): Promise<unknown>;
  };
  ROOT_DOMAIN_ACCOUNT: PublicKey;
  getFavoriteDomain(connectionArg: typeof connection, owner: PublicKey): Promise<unknown>;
  getHashedName(name: string): Promise<Buffer>;
  getNameAccountKey(
    hashedName: Buffer,
    nameClass?: PublicKey,
    nameParent?: PublicKey
  ): Promise<PublicKey> | PublicKey;
};

export class SnsResolutionError extends Error {
  constructor(public readonly solName: string) {
    super(`SNS: could not resolve "${solName}"`);
    this.name = "SnsResolutionError";
  }
}

export type SnsResolver = {
  resolveNameToWallet(solName: string): Promise<string>;
  resolveWalletToName(wallet: string): Promise<string | null>;
  validateSubName(subName: string, parentSolName: string): Promise<boolean>;
};

export async function resolveNameToWallet(solName: string): Promise<string> {
  return createSnsResolver().resolveNameToWallet(solName);
}

export async function resolveWalletToName(wallet: string): Promise<string | null> {
  return createSnsResolver().resolveWalletToName(wallet);
}

export async function validateSubName(subName: string, parentSolName: string): Promise<boolean> {
  return createSnsResolver().validateSubName(subName, parentSolName);
}

export function createSnsResolver(cache: RedisLike = redis): SnsResolver {
  return {
    async resolveNameToWallet(solName: string) {
      const normalized = normalizeSolName(solName);
      const cacheKey = `sns:name:${normalized}`;
      const cached = await cache.get(cacheKey);
      if (cached) {
        return cached;
      }

      try {
        const nameAccountKey = await deriveNameAccountKey(normalized);
        const registry = await NameRegistryState.retrieve(connection, nameAccountKey);
        const owner = extractOwner(registry);
        await cache.set(cacheKey, owner, "EX", TTL_SECONDS);
        return owner;
      } catch {
        throw new SnsResolutionError(solName);
      }
    },

    async resolveWalletToName(wallet: string) {
      const cacheKey = `sns:wallet:${wallet}`;
      const cached = await cache.get(cacheKey);
      if (cached) {
        return cached === NULL_CACHE_VALUE ? null : cached;
      }

      try {
        const favoriteDomain = await getFavoriteDomain(connection, new PublicKey(wallet));
        const resolved = normalizeFavoriteDomain(favoriteDomain);
        await cache.set(cacheKey, resolved ?? NULL_CACHE_VALUE, "EX", TTL_SECONDS);
        return resolved;
      } catch {
        await cache.set(cacheKey, NULL_CACHE_VALUE, "EX", TTL_SECONDS);
        return null;
      }
    },

    async validateSubName(subName: string, parentSolName: string) {
      if (!/^[a-z0-9-]{1,32}$/.test(subName)) {
        return false;
      }

      try {
        await this.resolveNameToWallet(parentSolName);
        return true;
      } catch {
        return false;
      }
    }
  };
}

function normalizeSolName(solName: string) {
  return solName.trim().toLowerCase().replace(/\.sol$/u, "");
}

async function deriveNameAccountKey(normalizedSolName: string): Promise<PublicKey> {
  const labels = normalizedSolName.split(".").filter(Boolean);
  if (labels.length === 0) {
    throw new SnsResolutionError(normalizedSolName);
  }

  if (labels.length === 1) {
    const hashed = await getHashedName(labels[0]);
    return await Promise.resolve(getNameAccountKey(hashed, undefined, ROOT_DOMAIN_ACCOUNT));
  }

  let parentKey = await deriveNameAccountKey(labels.slice(1).join("."));
  for (let index = labels.length - 2; index >= 0; index -= 1) {
    const hashed = await getHashedName(`\0${labels[index]}`);
    parentKey = await Promise.resolve(getNameAccountKey(hashed, undefined, parentKey));
  }

  return parentKey;
}

function extractOwner(registry: unknown) {
  if (
    typeof registry === "object" &&
    registry !== null &&
    "registry" in registry &&
    typeof registry.registry === "object" &&
    registry.registry !== null &&
    "owner" in registry.registry
  ) {
    const owner = registry.registry.owner;
    if (owner instanceof PublicKey) {
      return owner.toBase58();
    }
  }

  throw new Error("Unexpected SNS registry payload");
}

function normalizeFavoriteDomain(value: unknown): string | null {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    return value.endsWith(".sol") ? value : `${value}.sol`;
  }

  if (typeof value === "object") {
    const name =
      "name" in value
        ? value.name
        : "reverse" in value
          ? value.reverse
          : "domain" in value
            ? value.domain
            : null;
    if (typeof name === "string" && name.length > 0) {
      return name.endsWith(".sol") ? name : `${name}.sol`;
    }
  }

  return null;
}
