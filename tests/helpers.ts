import type { PrismaClient } from "@prisma/client";
import { buildServer } from "../src/server.js";

export const testUser = {
  id: "user_1",
  walletAddr: "11111111111111111111111111111111",
  solName: "alice.sol",
  createdAt: new Date("2026-05-08T00:00:00.000Z")
};

export class MemoryRedis {
  async get(_key: string) {
    return null;
  }

  async set(_key: string, _value: string) {
    return "OK";
  }

  async del(..._keys: string[]) {
    return 1;
  }

  async publish(_channel: string, _message: string) {
    return 1;
  }

  async incr(_key: string) {
    return 1;
  }

  async expire(_key: string, _seconds: number) {
    return 1;
  }

  async quit() {
    return undefined;
  }
}

type PrismaOverrides = {
  user?: Record<string, unknown>;
  job?: Record<string, unknown>;
  agent?: Record<string, unknown>;
  agentMessage?: Record<string, unknown>;
  $transaction?: unknown;
  $disconnect?: unknown;
};

export function makeBasePrisma(overrides: PrismaOverrides = {}) {
  const txClient = {
    user: {
      findUnique: async () => testUser,
      upsert: async () => testUser,
      update: async () => testUser,
      ...(overrides.user ?? {})
    },
    job: {
      findUnique: async () => null,
      findFirst: async () => null,
      create: async () => null,
      update: async () => null,
      findMany: async () => [],
      count: async () => 0,
      ...(overrides.job ?? {})
    },
    agent: {
      findUnique: async () => null,
      findFirst: async () => null,
      findMany: async () => [],
      create: async ({ data }: { data: Record<string, unknown> }) => ({
        id: "agent_tx",
        ...data
      }),
      createMany: async ({ data }: { data: unknown[] }) => ({ count: data.length }),
      update: async () => null,
      updateMany: async () => ({ count: 0 }),
      count: async () => 0,
      ...(overrides.agent ?? {})
    },
    agentMessage: {
      create: async () => null,
      count: async () => 0,
      ...(overrides.agentMessage ?? {})
    }
  };

  const prismaLike: Record<string, unknown> = {
    user: {
      findUnique: async () => testUser,
      upsert: async () => testUser,
      update: async () => testUser,
      ...(overrides.user ?? {})
    },
    job: {
      findUnique: async () => null,
      findFirst: async () => null,
      create: async () => null,
      update: async () => null,
      findMany: async () => [],
      count: async () => 0,
      ...(overrides.job ?? {})
    },
    agent: {
      findUnique: async () => null,
      findFirst: async () => null,
      findMany: async () => [],
      update: async () => null,
      updateMany: async () => ({ count: 0 }),
      count: async () => 0,
      ...(overrides.agent ?? {})
    },
    agentMessage: {
      create: async () => null,
      count: async () => 0,
      ...(overrides.agentMessage ?? {})
    },
    $transaction:
      overrides.$transaction ??
      (async <T>(callback: (tx: typeof txClient) => Promise<T>) => callback(txClient)),
    $disconnect: overrides.$disconnect ?? (async () => undefined)
  };

  return prismaLike as unknown as PrismaClient;
}

export async function makeTestApp(prismaOverrides: PrismaOverrides = {}) {
  const app = await buildServer({
    logger: false,
    disableRateLimit: true,
    services: {
      prisma: makeBasePrisma(prismaOverrides),
      redis: new MemoryRedis()
    }
  });

  await app.ready();
  return app;
}

export function authHeader(app: Awaited<ReturnType<typeof makeTestApp>>) {
  const token = app.jwt.sign(
    { sub: testUser.id, walletAddr: testUser.walletAddr },
    { expiresIn: "24h" }
  );
  return `Bearer ${token}`;
}
