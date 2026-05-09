import { Redis } from "ioredis";
import { env } from "../lib/env.js";

export type RedisLike = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ...args: unknown[]): Promise<unknown>;
  del(...keys: string[]): Promise<unknown>;
  publish(channel: string, message: string): Promise<unknown>;
  subscribe?(...channels: string[]): Promise<unknown>;
  unsubscribe?(...channels: string[]): Promise<unknown>;
  psubscribe?(...patterns: string[]): Promise<unknown>;
  on?(event: string, listener: (...args: unknown[]) => void): unknown;
  incr?(key: string): Promise<number>;
  expire?(key: string, seconds: number): Promise<unknown>;
  quit?(): Promise<unknown>;
};

export function createRedisConnection(role: "cache" | "pub" | "sub" | "bullmq" = "cache") {
  return new Redis(env.REDIS_URL, {
    lazyConnect: false,
    maxRetriesPerRequest: role === "bullmq" ? null : 3,
    enableReadyCheck: role !== "bullmq"
  });
}

export async function getJson<T>(redis: RedisLike, key: string): Promise<T | null> {
  const raw = await redis.get(key);
  return raw ? (JSON.parse(raw) as T) : null;
}

export async function setJson(
  redis: RedisLike,
  key: string,
  value: unknown,
  ttlSeconds: number
) {
  await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
}

export async function incrementWithTtl(redis: RedisLike, key: string, ttlSeconds: number) {
  if (!redis.incr || !redis.expire) {
    return 0;
  }
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, ttlSeconds);
  }
  return count;
}
