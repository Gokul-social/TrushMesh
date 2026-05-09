import { Redis } from "ioredis";
import { env } from "./env.js";

export type RedisLike = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ...args: unknown[]): Promise<unknown>;
  del(...keys: string[]): Promise<unknown>;
  publish(channel: string, message: string): Promise<unknown>;
  subscribe?(...channels: string[]): Promise<unknown>;
  unsubscribe?(...channels: string[]): Promise<unknown>;
  on?(event: string, listener: (...args: unknown[]) => void): unknown;
  incr?(key: string): Promise<number>;
  expire?(key: string, seconds: number): Promise<unknown>;
  quit?(): Promise<unknown>;
  duplicate?(): RedisLike;
};

export function createRedisConnection(role: "cache" | "publisher" | "subscriber" | "bullmq" = "cache") {
  return new Redis(env.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: role === "bullmq" ? null : 3,
    enableReadyCheck: role !== "bullmq"
  });
}

export const redis = createRedisConnection("cache");
export const redisPublisher = createRedisConnection("publisher");
export const redisSubscriber = createRedisConnection("subscriber");

export async function getJson<T>(client: RedisLike, key: string): Promise<T | null> {
  const raw = await client.get(key);
  return raw ? (JSON.parse(raw) as T) : null;
}

export async function setJson(
  client: RedisLike,
  key: string,
  value: unknown,
  ttlSeconds: number
) {
  await client.set(key, JSON.stringify(value), "EX", ttlSeconds);
}

export async function incrementWithTtl(client: RedisLike, key: string, ttlSeconds: number) {
  if (!client.incr || !client.expire) {
    return 0;
  }

  const count = await client.incr(key);
  if (count === 1) {
    await client.expire(key, ttlSeconds);
  }

  return count;
}
