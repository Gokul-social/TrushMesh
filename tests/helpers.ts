import { buildServer, type AppServices } from "../src/server.js";
import { WebSocketHub } from "../src/websocket/hub.js";

export const testUser = {
  id: "user_1",
  walletAddr: "11111111111111111111111111111111",
  solName: "alice.sol",
  createdAt: new Date("2026-05-08T00:00:00.000Z")
};

export class MemoryRedis {
  readonly store = new Map<string, string>();
  readonly listeners = new Map<string, Array<(...args: unknown[]) => void>>();

  async get(key: string) {
    return this.store.get(key) ?? null;
  }

  async set(key: string, value: string) {
    this.store.set(key, value);
    return "OK";
  }

  async del(...keys: string[]) {
    for (const key of keys) {
      this.store.delete(key);
    }
    return keys.length;
  }

  async publish(channel: string, message: string) {
    for (const listener of this.listeners.get("message") ?? []) {
      listener(channel, message);
    }
    return 1;
  }

  async subscribe() {
    return 1;
  }

  on(event: string, listener: (...args: unknown[]) => void) {
    const listeners = this.listeners.get(event) ?? [];
    listeners.push(listener);
    this.listeners.set(event, listeners);
    return this;
  }

  async incr(key: string) {
    const next = Number(this.store.get(key) ?? 0) + 1;
    this.store.set(key, String(next));
    return next;
  }

  async expire() {
    return 1;
  }

  async quit() {
    return undefined;
  }
}

export function makeBasePrisma(overrides: Record<string, unknown> = {}) {
  return {
    user: {
      findUnique: async () => testUser,
      upsert: async () => testUser,
      update: async () => testUser
    },
    job: {
      findFirst: async () => ({ id: "job_1", onchainId: "A7F3C2", ownerId: testUser.id, status: "ACTIVE" }),
      findUnique: async () => ({ id: "job_1", onchainId: "A7F3C2" }),
      count: async () => 1
    },
    agent: {
      count: async () => 0
    },
    agentMessage: {
      count: async () => 0
    },
    $disconnect: async () => undefined,
    ...overrides
  };
}

export function makeAnchor(overrides: Partial<AppServices["anchor"]> = {}) {
  return {
    verifyDelegationLog: async () => true,
    verifyRevocationTx: async () => true,
    extractAgentMessage: async () => null,
    ...overrides
  };
}

export function makeSns(overrides: Partial<AppServices["sns"]> = {}) {
  return {
    resolveWalletToName: async () => "alice.sol",
    resolveNameToWallet: async () => testUser.walletAddr,
    ...overrides
  };
}

export async function makeTestApp(input: {
  prisma?: Record<string, unknown>;
  sns?: AppServices["sns"];
  anchor?: AppServices["anchor"];
} = {}) {
  const redis = new MemoryRedis();
  const redisPub = new MemoryRedis();
  const redisSub = new MemoryRedis();
  const app = await buildServer({
    logger: false,
    disableRateLimit: true,
    services: {
      prisma: makeBasePrisma(input.prisma) as unknown as AppServices["prisma"],
      redis,
      redisPub,
      redisSub,
      sns: input.sns ?? makeSns(),
      anchor: input.anchor ?? makeAnchor(),
      wsHub: new WebSocketHub(redisSub)
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
