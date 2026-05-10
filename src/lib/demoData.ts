import type { Agent, AgentMessage, Delegation, GlobalStats, GraphSnapshot, Job, MessagePage } from "../types";
import type { ApiEnvelope } from "../types";

const now = Date.now();
const minsAgo = (m: number) => new Date(now - m * 60_000).toISOString();
const hoursAgo = (h: number) => new Date(now - h * 3_600_000).toISOString();
const daysAgo = (d: number) => new Date(now - d * 86_400_000).toISOString();

// ── Wallets ──────────────────────────────────────────────────────────────────
const WALLETS = {
  alice: "FvW8UptFGFRe4sTM3i9c2MfJDYvHEfJfGJBNZdpkuTHx",
  bob: "7nMh94UfMTEGpH3J2CkNbEfwRF8MpLgKmwsRq6VJWxBd",
  carol: "2xBxFPMKq9Wh4vJRL8RrC6YhmNhVE8f93M4p7aKTzQSV",
  dave: "9dQxYgR7NHcLvwKjSWFz3nVuG5MmtqPaEYfbcDiXTB2e",
  eve: "3MkApW6nXdQ2rZJVcmTL9bHzFYeBxSNyCquiP7DtWnKe"
};

// ── Agent IDs ─────────────────────────────────────────────────────────────────
const AG = {
  // Job 1 — alice
  alicePlanner:   "ag_cm9k2f001_plan",
  aliceExecutor:  "ag_cm9k2f001_exec",
  aliceConfirmer: "ag_cm9k2f001_conf",
  // Job 2 — bob
  bobPlanner:   "ag_cm9k2f002_plan",
  bobAnalyzer:  "ag_cm9k2f002_anlz",
  // Job 3 — carol
  carolPlanner:   "ag_cm9k2f003_plan",
  carolExecutor:  "ag_cm9k2f003_exec",
  carolTrader:    "ag_cm9k2f003_trad",
  carolConfirmer: "ag_cm9k2f003_conf",
  // Job 4 — dave (complete)
  davePlanner:  "ag_cm9k2f004_plan",
  daveExecutor: "ag_cm9k2f004_exec",
  // Job 5 — eve (revoked)
  evePlanner:  "ag_cm9k2f005_plan",
  eveExecutor: "ag_cm9k2f005_exec"
};

// ── Jobs ──────────────────────────────────────────────────────────────────────
export const DEMO_JOBS: Job[] = [
  {
    id: "cm9k2f001job",
    onchainId: "a7f3c291e8b6",
    ownerId: WALLETS.alice,
    ownerSolName: "alice.sol",
    description: "Rebalance SOL/USDC portfolio to 60/40 target allocation",
    template: "PORTFOLIO_REBALANCER",
    budgetSol: "0.05",
    status: "ACTIVE",
    agentCount: 3,
    activeAgentCount: 3,
    breachCount: 0,
    createdAt: hoursAgo(2.5),
    updatedAt: minsAgo(4)
  },
  {
    id: "cm9k2f002job",
    onchainId: "b8e4d302f9c7",
    ownerId: WALLETS.bob,
    ownerSolName: "bob.sol",
    description: "Cast governance vote on Marinade DAO proposal #42",
    template: "DAO_VOTER",
    budgetSol: "0.02",
    status: "ACTIVE",
    agentCount: 2,
    activeAgentCount: 1,
    breachCount: 1,
    createdAt: hoursAgo(1.2),
    updatedAt: minsAgo(12)
  },
  {
    id: "cm9k2f003job",
    onchainId: "c9f5e413g0d8",
    ownerId: WALLETS.carol,
    ownerSolName: "carol.sol",
    description: "Monitor and compound USDC yield on Kamino Finance",
    template: "DATA_FETCHER",
    budgetSol: "0.08",
    status: "ACTIVE",
    agentCount: 4,
    activeAgentCount: 4,
    breachCount: 0,
    createdAt: hoursAgo(5),
    updatedAt: minsAgo(1)
  },
  {
    id: "cm9k2f004job",
    onchainId: "d0g6f524h1e9",
    ownerId: WALLETS.dave,
    ownerSolName: "dave.sol",
    description: "SOL/USDC arbitrage between Orca and Raydium pools",
    template: "PORTFOLIO_REBALANCER",
    budgetSol: "0.12",
    status: "COMPLETE",
    agentCount: 2,
    activeAgentCount: 0,
    breachCount: 0,
    createdAt: daysAgo(1),
    updatedAt: hoursAgo(18)
  },
  {
    id: "cm9k2f005job",
    onchainId: "e1h7g635i2f0",
    ownerId: WALLETS.eve,
    ownerSolName: "eve.sol",
    description: "Rebalance mSOL/SOL ratio for liquid staking optimisation",
    template: "PORTFOLIO_REBALANCER",
    budgetSol: "0.03",
    status: "REVOKED",
    agentCount: 2,
    activeAgentCount: 0,
    breachCount: 2,
    createdAt: daysAgo(2),
    updatedAt: hoursAgo(36)
  },
  {
    id: "cm9k2f006job",
    onchainId: "f2i8h746j3g1",
    ownerId: WALLETS.alice,
    ownerSolName: "alice.sol",
    description: "Collect DeFi TVL data across top Solana protocols",
    template: "DATA_FETCHER",
    budgetSol: "0.01",
    status: "PENDING",
    agentCount: 0,
    activeAgentCount: 0,
    breachCount: 0,
    createdAt: minsAgo(15),
    updatedAt: minsAgo(15)
  }
];

// ── Agents ────────────────────────────────────────────────────────────────────
export const DEMO_AGENTS: Agent[] = [
  // Job 1 — alice (ACTIVE)
  {
    id: AG.alicePlanner,
    jobId: "cm9k2f001job",
    label: "Planner",
    solSubName: "planner.alice.sol",
    type: "PLANNER",
    status: "ACTIVE",
    parentAgentId: null,
    actionCount: 12,
    createdAt: hoursAgo(2.4),
    walletAddr: "HxK1mWpQFzLyN3JdTVcS8e2Rh6bGqYoXCuAtBsEmPgI",
    lastActionAt: minsAgo(4)
  },
  {
    id: AG.aliceExecutor,
    jobId: "cm9k2f001job",
    label: "Executor",
    solSubName: "executor.alice.sol",
    type: "EXECUTOR",
    status: "ACTIVE",
    parentAgentId: AG.alicePlanner,
    actionCount: 8,
    createdAt: hoursAgo(2.3),
    walletAddr: "3PqFrBmTaLc9KdMxEyHwZ5NvS7JjUbGnVeXCiRhAoYp",
    lastActionAt: minsAgo(6)
  },
  {
    id: AG.aliceConfirmer,
    jobId: "cm9k2f001job",
    label: "Confirmer",
    solSubName: "confirmer.alice.sol",
    type: "CONFIRMER",
    status: "ACTIVE",
    parentAgentId: AG.alicePlanner,
    actionCount: 5,
    createdAt: hoursAgo(2.2),
    walletAddr: "8WsKdLnPzMf7VrCyQbAE4X6JtHuGiNeDSoRTmBkOejx",
    lastActionAt: minsAgo(8)
  },
  // Job 2 — bob (ACTIVE, one WARNING agent)
  {
    id: AG.bobPlanner,
    jobId: "cm9k2f002job",
    label: "Planner",
    solSubName: "planner.bob.sol",
    type: "PLANNER",
    status: "ACTIVE",
    parentAgentId: null,
    actionCount: 6,
    createdAt: hoursAgo(1.1),
    walletAddr: "5LmJbNrQkTp2WeAyDcXF8V3YhZsGiMuRoECnBvHPqId",
    lastActionAt: minsAgo(12)
  },
  {
    id: AG.bobAnalyzer,
    jobId: "cm9k2f002job",
    label: "Analyzer",
    solSubName: "analyzer.bob.sol",
    type: "ANALYZER",
    status: "WARNING",
    parentAgentId: AG.bobPlanner,
    actionCount: 3,
    createdAt: hoursAgo(1.0),
    walletAddr: "9TkGcOrSjUp3XfBzEaYG5W4ZhAiNvQuCsFDmBwItPne",
    lastActionAt: minsAgo(28)
  },
  // Job 3 — carol (fully ACTIVE, 4 agents)
  {
    id: AG.carolPlanner,
    jobId: "cm9k2f003job",
    label: "Planner",
    solSubName: "planner.carol.sol",
    type: "PLANNER",
    status: "ACTIVE",
    parentAgentId: null,
    actionCount: 9,
    createdAt: hoursAgo(4.9),
    walletAddr: "2RnHdLsQkMb8WgAyFcUG7V6XiZrEjNuCpFoBtPmDwKa",
    lastActionAt: minsAgo(1)
  },
  {
    id: AG.carolExecutor,
    jobId: "cm9k2f003job",
    label: "Executor",
    solSubName: "executor.carol.sol",
    type: "EXECUTOR",
    status: "ACTIVE",
    parentAgentId: AG.carolPlanner,
    actionCount: 7,
    createdAt: hoursAgo(4.8),
    walletAddr: "6YpKeLsRmNc9XhBzFaVH8W3ZiAqGnOuDrECsMbJwPtd",
    lastActionAt: minsAgo(2)
  },
  {
    id: AG.carolTrader,
    jobId: "cm9k2f003job",
    label: "Trader",
    solSubName: "trader.carol.sol",
    type: "TRADER",
    status: "ACTIVE",
    parentAgentId: AG.carolExecutor,
    actionCount: 4,
    createdAt: hoursAgo(4.7),
    walletAddr: "4VmGfKrPpLb7UeAyCdTF9X2YhWsEjMuQoNCpBrJxIdk",
    lastActionAt: minsAgo(3)
  },
  {
    id: AG.carolConfirmer,
    jobId: "cm9k2f003job",
    label: "Confirmer",
    solSubName: "confirmer.carol.sol",
    type: "CONFIRMER",
    status: "ACTIVE",
    parentAgentId: AG.carolPlanner,
    actionCount: 2,
    createdAt: hoursAgo(4.6),
    walletAddr: "7XnFcMsQkOd8VgBzGaWH9Y3ZjBrFkNuEpGoBsKmLwPe",
    lastActionAt: minsAgo(5)
  },
  // Job 4 — dave (COMPLETE)
  {
    id: AG.davePlanner,
    jobId: "cm9k2f004job",
    label: "Planner",
    solSubName: "planner.dave.sol",
    type: "PLANNER",
    status: "COMPLETE",
    parentAgentId: null,
    actionCount: 15,
    createdAt: daysAgo(1),
    walletAddr: "1SoJdKqRmNe7UcAyFbTG8W5XhZsGjNuDpFoCtLmBwPa",
    lastActionAt: hoursAgo(18)
  },
  {
    id: AG.daveExecutor,
    jobId: "cm9k2f004job",
    label: "Executor",
    solSubName: "executor.dave.sol",
    type: "EXECUTOR",
    status: "COMPLETE",
    parentAgentId: AG.davePlanner,
    actionCount: 12,
    createdAt: daysAgo(1),
    walletAddr: "8TkHeLsQmPc9WgBzFaVJ7Y4ZiArGnOuEqFoCuKmNxPd",
    lastActionAt: hoursAgo(18)
  },
  // Job 5 — eve (REVOKED)
  {
    id: AG.evePlanner,
    jobId: "cm9k2f005job",
    label: "Planner",
    solSubName: "planner.eve.sol",
    type: "PLANNER",
    status: "REVOKED",
    parentAgentId: null,
    actionCount: 3,
    revokedAt: hoursAgo(36),
    revokeTxHash: "7Kp2fNmTaLc9RdMxEyHwZ3NvS8JjUbGnVeXCiRhAoYq",
    createdAt: daysAgo(2),
    walletAddr: "5UnKdLsQjPb8WgCyFcTH7V3XiZrFjNuBpDoCsLmAwPe",
    lastActionAt: hoursAgo(36)
  },
  {
    id: AG.eveExecutor,
    jobId: "cm9k2f005job",
    label: "Executor",
    solSubName: "executor.eve.sol",
    type: "EXECUTOR",
    status: "REVOKED",
    parentAgentId: AG.evePlanner,
    actionCount: 1,
    revokedAt: hoursAgo(36),
    revokeTxHash: "8Lq3gOnUbMd0SeMzFzIxA4OwT9KkVcHoWfYDjSiBpZr",
    createdAt: daysAgo(2),
    walletAddr: "3VpJcMrQkNc9XhAzGaUI8Y5ZjBrFkMuEoGoBsKmNwPd",
    lastActionAt: hoursAgo(36)
  }
];

// ── Global Stats ──────────────────────────────────────────────────────────────
export const DEMO_STATS: GlobalStats = {
  activeJobs: 3,
  totalAgents: 13,
  totalMessages: 184,
  unauthorizedActions: 2
};

// ── Messages (for job 1 — most interesting) ───────────────────────────────────
const makeMsg = (
  id: string,
  senderId: string,
  senderName: string,
  receiverId: string,
  receiverName: string,
  action: string,
  txHash: string,
  verified: boolean,
  createdAt: string
): AgentMessage => ({
  id,
  jobId: "cm9k2f001job",
  senderId,
  senderName,
  receiverId,
  receiverName,
  action,
  txHash,
  signatureHex: `${txHash.slice(0, 32)}a3f91b8c`,
  verified,
  createdAt
});

export const DEMO_MESSAGES_JOB1: AgentMessage[] = [
  makeMsg("msg001", AG.alicePlanner, "planner.alice.sol", AG.aliceExecutor, "executor.alice.sol",
    "Fetch current SOL/USDC spot price from Jupiter aggregator",
    "5Zx9kQm2fNpTaLc3RdMxEyHwZ4NvS7JjUbGnVeXCiRh", true, minsAgo(130)),
  makeMsg("msg002", AG.aliceExecutor, "executor.alice.sol", AG.alicePlanner, "planner.alice.sol",
    "Price fetched: 1 SOL = $142.87 USDC (Jupiter best route)",
    "6Ay0lRn3gOqUbMd4SeMzFzIxA5OwT8KkVcHoWfYDjSiB", true, minsAgo(128)),
  makeMsg("msg003", AG.alicePlanner, "planner.alice.sol", AG.aliceExecutor, "executor.alice.sol",
    "Calculate rebalance: current 54/46, target 60/40 — need to sell 0.42 USDC",
    "7Bz1mSo4hPrVcNe5TfNaGaJyB6PxU9LlWdIpXgZEkTjC", true, minsAgo(126)),
  makeMsg("msg004", AG.aliceExecutor, "executor.alice.sol", AG.aliceConfirmer, "confirmer.alice.sol",
    "Execute swap: sell 59.81 USDC → SOL via Orca concentrated pool",
    "8Ca2nTp5iQsWdOf6UgObHbKzC7QyV0MmXeJqYhAFlUkD", true, minsAgo(122)),
  makeMsg("msg005", AG.aliceConfirmer, "confirmer.alice.sol", AG.aliceExecutor, "executor.alice.sol",
    "Swap confirmed on-chain — received 0.418 SOL, txHash: 5Zx9...",
    "9Db3oUq6jRtXeQg7VhPcIcLaD8RzW1NnYfKrZiBGmVlE", true, minsAgo(119)),
  makeMsg("msg006", AG.aliceExecutor, "executor.alice.sol", AG.alicePlanner, "planner.alice.sol",
    "Rebalance complete. Portfolio now 60.2% SOL / 39.8% USDC",
    "0Ec4pVr7kSuYfRh8WiQdJdMbE9SaX2OoZgLsAjCHnWmF", true, minsAgo(116)),
  makeMsg("msg007", AG.alicePlanner, "planner.alice.sol", AG.aliceExecutor, "executor.alice.sol",
    "Initiate second pass: fetch updated balance from wallet",
    "1Fd5qWs8lTvZgSi9XjReKeNcF0TbY3PpAhMtBkDIoXnG", true, minsAgo(60)),
  makeMsg("msg008", AG.aliceExecutor, "executor.alice.sol", AG.aliceConfirmer, "confirmer.alice.sol",
    "Balance confirmed: 2.31 SOL + 130.42 USDC — ratio 60.1/39.9, within tolerance",
    "2Ge6rXt9mUwAhTj0YkSfLfOdG1UcZ4QqBiNuClEJpYoH", true, minsAgo(57)),
  makeMsg("msg009", AG.aliceConfirmer, "confirmer.alice.sol", AG.alicePlanner, "planner.alice.sol",
    "Verification passed. No further action required this cycle.",
    "3Hf7sYu0nVxBiUk1ZlTgMgPeH2VdA5RrCjOvDmFKqZpI", true, minsAgo(55)),
  makeMsg("msg010", AG.alicePlanner, "planner.alice.sol", AG.aliceExecutor, "executor.alice.sol",
    "Schedule next rebalance check in 30 minutes",
    "4Ig8tZv1oWyCjVl2AmUhNhQfI3WeB6SsDkPwEnGLrAqJ", true, minsAgo(12))
];

// messages for job 2 (bob — DAO voter)
export const DEMO_MESSAGES_JOB2: AgentMessage[] = [
  {
    id: "msg201", jobId: "cm9k2f002job",
    senderId: AG.bobPlanner, senderName: "planner.bob.sol",
    receiverId: AG.bobAnalyzer, receiverName: "analyzer.bob.sol",
    action: "Fetch proposal #42 details from Marinade DAO contract",
    txHash: "5Az1kQm2fNpTaLc3RdMxEyHwZ4NvS7JjUbGnVeXCiRh",
    signatureHex: "d2195f93bb0ca3f9", verified: true, createdAt: minsAgo(72)
  },
  {
    id: "msg202", jobId: "cm9k2f002job",
    senderId: AG.bobAnalyzer, senderName: "analyzer.bob.sol",
    receiverId: AG.bobPlanner, receiverName: "planner.bob.sol",
    action: "Proposal analysis: vote YES — 73% community approval projected",
    txHash: "6Bb2lRn3gOqUbMd4SeMzFzIxA5OwT8KkVcHoWfYDjSiB",
    signatureHex: "e3206a04cc1ba4fa", verified: false, createdAt: minsAgo(65)
  },
  {
    id: "msg203", jobId: "cm9k2f002job",
    senderId: AG.bobPlanner, senderName: "planner.bob.sol",
    receiverId: AG.bobAnalyzer, receiverName: "analyzer.bob.sol",
    action: "Cast governance vote: YES on proposal #42 via Realms protocol",
    txHash: "7Cc3mSo4hPrVcNe5TfNaGaJyB6PxU9LlWdIpXgZEkTjC",
    signatureHex: "f4317b15dd2cb5gb", verified: true, createdAt: minsAgo(28)
  }
];

// messages for job 3 (carol — yield monitor)
export const DEMO_MESSAGES_JOB3: AgentMessage[] = [
  {
    id: "msg301", jobId: "cm9k2f003job",
    senderId: AG.carolPlanner, senderName: "planner.carol.sol",
    receiverId: AG.carolExecutor, receiverName: "executor.carol.sol",
    action: "Fetch current Kamino USDC vault APY",
    txHash: "5Az9kQm2fNpTaLc3RdMxEyHwZ4NvS7JjUbGnVeXCiRa",
    signatureHex: "a1204e82ab0ca2f8", verified: true, createdAt: minsAgo(30)
  },
  {
    id: "msg302", jobId: "cm9k2f003job",
    senderId: AG.carolExecutor, senderName: "executor.carol.sol",
    receiverId: AG.carolTrader, receiverName: "trader.carol.sol",
    action: "APY = 12.4%. Compound threshold reached — initiate harvest",
    txHash: "6Ba0lRn3gOqUbMd4SeMzFzIxA5OwT8KkVcHoWfYDjSja",
    signatureHex: "b2315f93bb1ba3f9", verified: true, createdAt: minsAgo(20)
  },
  {
    id: "msg303", jobId: "cm9k2f003job",
    senderId: AG.carolTrader, senderName: "trader.carol.sol",
    receiverId: AG.carolConfirmer, receiverName: "confirmer.carol.sol",
    action: "Harvest 14.23 USDC rewards and reinvest to vault",
    txHash: "7Cb1mSo4hPrVcNe5TfNaGaJyB6PxU9LlWdIpXgZEkTka",
    signatureHex: "c3426a04cc2cb4ga", verified: true, createdAt: minsAgo(10)
  },
  {
    id: "msg304", jobId: "cm9k2f003job",
    senderId: AG.carolConfirmer, senderName: "confirmer.carol.sol",
    receiverId: AG.carolPlanner, receiverName: "planner.carol.sol",
    action: "Compound confirmed. Vault balance updated: 1,247.85 USDC",
    txHash: "8Dc2nTp5iQsWdOf6UgObHbKzC7QyV0MmXeJqYhAFlUla",
    signatureHex: "d4537b15dd3dc5hb", verified: true, createdAt: minsAgo(3)
  }
];

// ── Graph Snapshots ───────────────────────────────────────────────────────────
export const DEMO_GRAPH_JOB1: GraphSnapshot = {
  nodes: DEMO_AGENTS.filter((a) => a.jobId === "cm9k2f001job"),
  edges: [
    { id: "e1", source: AG.alicePlanner, target: AG.aliceExecutor, type: "DELEGATION" },
    { id: "e2", source: AG.alicePlanner, target: AG.aliceConfirmer, type: "DELEGATION" }
  ] as Delegation[]
};

export const DEMO_GRAPH_JOB2: GraphSnapshot = {
  nodes: DEMO_AGENTS.filter((a) => a.jobId === "cm9k2f002job"),
  edges: [
    { id: "e1", source: AG.bobPlanner, target: AG.bobAnalyzer, type: "DELEGATION" }
  ] as Delegation[]
};

export const DEMO_GRAPH_JOB3: GraphSnapshot = {
  nodes: DEMO_AGENTS.filter((a) => a.jobId === "cm9k2f003job"),
  edges: [
    { id: "e1", source: AG.carolPlanner, target: AG.carolExecutor, type: "DELEGATION" },
    { id: "e2", source: AG.carolExecutor, target: AG.carolTrader, type: "DELEGATION" },
    { id: "e3", source: AG.carolPlanner, target: AG.carolConfirmer, type: "DELEGATION" }
  ] as Delegation[]
};

export const DEMO_GRAPH_JOB4: GraphSnapshot = {
  nodes: DEMO_AGENTS.filter((a) => a.jobId === "cm9k2f004job"),
  edges: [{ id: "e1", source: AG.davePlanner, target: AG.daveExecutor, type: "DELEGATION" }] as Delegation[]
};

export const DEMO_GRAPH_JOB5: GraphSnapshot = {
  nodes: DEMO_AGENTS.filter((a) => a.jobId === "cm9k2f005job"),
  edges: [{ id: "e1", source: AG.evePlanner, target: AG.eveExecutor, type: "DELEGATION" }] as Delegation[]
};

const GRAPH_MAP: Record<string, GraphSnapshot> = {
  "cm9k2f001job": DEMO_GRAPH_JOB1,
  "cm9k2f002job": DEMO_GRAPH_JOB2,
  "cm9k2f003job": DEMO_GRAPH_JOB3,
  "cm9k2f004job": DEMO_GRAPH_JOB4,
  "cm9k2f005job": DEMO_GRAPH_JOB5
};

const MESSAGES_MAP: Record<string, AgentMessage[]> = {
  "cm9k2f001job": DEMO_MESSAGES_JOB1,
  "cm9k2f002job": DEMO_MESSAGES_JOB2,
  "cm9k2f003job": DEMO_MESSAGES_JOB3
};

// ── Main resolver: URL → ApiEnvelope ─────────────────────────────────────────
export function resolveDemoResponse(
  url: string | undefined,
  params?: Record<string, string>
): ApiEnvelope<unknown> | null {
  if (!url) return null;

  // GET /stats/global
  if (url.endsWith("/stats/global")) {
    return { data: DEMO_STATS };
  }

  // GET /graph/:jobId
  const graphMatch = url.match(/\/graph\/([^/?]+)/);
  if (graphMatch) {
    const jobId = graphMatch[1];
    const graph = GRAPH_MAP[jobId] ?? DEMO_GRAPH_JOB1;
    return { data: graph };
  }

  // GET /messages
  if (url.includes("/messages")) {
    const jobId = params?.jobId as string | undefined;
    const messages = (jobId && MESSAGES_MAP[jobId]) ? MESSAGES_MAP[jobId] : DEMO_MESSAGES_JOB1;
    const page: MessagePage = { items: messages, nextCursor: null };
    return { data: page };
  }

  // GET /agents/:id  (must come before /agents list)
  const agentDetailMatch = url.match(/\/agents\/([^/?]+)/);
  if (agentDetailMatch && !url.endsWith("/revoke")) {
    const agentId = agentDetailMatch[1];
    const agent = DEMO_AGENTS.find((a) => a.id === agentId) ?? DEMO_AGENTS[0];
    return { data: agent };
  }

  // GET /agents (list)
  if (url.includes("/agents")) {
    const search = (params?.search as string | undefined)?.toLowerCase() ?? "";
    const status = params?.status as string | undefined;
    const type = params?.type as string | undefined;
    let filtered = DEMO_AGENTS;
    if (search) {
      filtered = filtered.filter(
        (a) => a.solSubName.toLowerCase().includes(search) || (a.walletAddr ?? "").toLowerCase().includes(search)
      );
    }
    if (status) filtered = filtered.filter((a) => a.status === status);
    if (type) filtered = filtered.filter((a) => a.type === type);
    return { data: filtered, meta: { total: filtered.length, page: 1, limit: 50 } };
  }

  // GET /jobs/:id
  const jobDetailMatch = url.match(/\/jobs\/([^/?]+)/);
  if (jobDetailMatch && !url.includes("/activate")) {
    const jobId = jobDetailMatch[1];
    const job = DEMO_JOBS.find((j) => j.id === jobId) ?? DEMO_JOBS[0];
    return { data: job };
  }

  // GET /jobs (list)
  if (url.includes("/jobs")) {
    const status = params?.status as string | undefined;
    const filtered = status ? DEMO_JOBS.filter((j) => j.status === status) : DEMO_JOBS;
    return { data: filtered, meta: { total: filtered.length, page: 1, limit: 50 } };
  }

  return null;
}
