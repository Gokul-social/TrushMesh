# TrustMesh
> Every agent. Every decision. On chain.

**Track:** Agent Identity + Social Identity — SNS Frontier Hackathon  
**Team:** [Your names]  
**Demo:** [Live demo URL or video link]

---

## What it is

TrustMesh is a multi-agent AI coordination and audit platform on Solana. Every AI agent gets a verified `.sol` identity. Every inter-agent delegation is signed with Ed25519 and logged permanently on-chain. Humans can revoke any agent in one transaction — the system cascades the halt to all child agents instantly.

---

## The Problem

Multi-agent AI systems are a black box. When a swarm of agents executes a complex on-chain task (e.g., a DeFi strategy), there's no way for a human to audit which agent made which decision, whether it was authorized, or if an agent went rogue. Protocols are getting swarmed by agents with zero accountability.

---

## How TrustMesh Solves It

1. **Identity layer:** Every agent gets a unique `.sol` sub-name (e.g., `planner.alice.sol`) anchored to SNS. Agents can't impersonate each other.
2. **Audit trail:** Every inter-agent message is signed and logged on Solana via our Anchor program. Anyone can verify the full decision tree post-execution.
3. **Instant revocation:** Humans can revoke any agent's signing authority in one transaction. The backend cascades the halt to all descendants.
4. **Visual explorer:** A D3-powered graph shows the live agent hierarchy, delegation flows, and action logs in real time via WebSocket.

---

## Architecture

```mermaid
graph TD
    subgraph Client ["Client Tier"]
        UI["Web App<br/>(React, Vite, D3.js, Silk)"]
        WS_Client["WebSocket Client<br/>(Live Updates)"]
        UI --- WS_Client
    end

    subgraph API ["Application Tier"]
        Backend["Node.js Server<br/>(Express / Middleware)"]
        API_REST["REST API"]
        WS_Server["WebSocket<br/>Broadcaster"]
        Queues["Job Queues"]
        Backend --- API_REST
        Backend --- WS_Server
        Backend --- Queues
    end

    subgraph State ["State & Persistence"]
        DB[(PostgreSQL<br/>Prisma)]
        Cache[(Redis<br/>Store)]
    end

    subgraph Chain ["Blockchain Tier (Solana)"]
        Anchor["TrustMesh<br/>Anchor Program"]
        SNS["Solana Name<br/>Service (SNS)"]
    end

    %% Connections
    UI -- "HTTP Requests" --> API_REST
    WS_Client <-->|Real-time Data| WS_Server
    
    API_REST -- "Read/Write" --> DB
    WS_Server <-->|"Pub/Sub"| Cache
    Queues <-->|"Worker State"| Cache
    
    Backend <-->|"RPC (Tx / Events)"| Anchor
    Backend -- "Resolve Agent Identity" --> SNS
    
    classDef primary fill:#4f46e5,stroke:#312e81,stroke-width:2px,color:#fff;
    classDef secondary fill:#0ea5e9,stroke:#0369a1,stroke-width:2px,color:#fff;
    classDef database fill:#10b981,stroke:#047857,stroke-width:2px,color:#fff;
    classDef chain fill:#8b5cf6,stroke:#5b21b6,stroke-width:2px,color:#fff;

    class UI,WS_Client secondary;
    class Backend,API_REST,WS_Server,Queues primary;
    class DB,Cache database;
    class Anchor,SNS chain;
```

## Quick Start

### Prerequisites

- Node.js 20+
- Docker + Docker Compose
- Solana CLI 1.18.x
- Anchor CLI 0.30.x

### 1. Clone and Install

```bash
git clone <repo-url>
cd trustmesh
npm install
cd agent-runtime && npm install && cd ..
```

### 2. Start Infrastructure

```bash
docker compose up -d  # Postgres + Redis
```

### 3. Configure Environment

```bash
cp .env.example .env
# Edit .env with your values:
#   SOLANA_RPC_URL=https://api.devnet.solana.com
#   ANCHOR_PROGRAM_ID=66DXeSqBccWxWWw9S21vxe2Mvvqqkmw5KsK5jqA42quz
#   DATABASE_URL=postgresql://trustmesh:trustmesh@localhost:5432/trustmesh
#   REDIS_URL=redis://localhost:6379
```

### 4. Run Migrations + Seed

```bash
npm run prisma:migrate
npm run prisma:seed
```

### 5. Start Backend

```bash
npm run dev  # Listens on :3001
```

### 6. Start Frontend (new terminal)

```bash
npm run frontend:dev  # Listens on :5173
```

### 7. Run Demo (new terminal)

```bash
cd agent-runtime
cp .env.example .env
# Edit agent-runtime/.env:
#   BACKEND_URL=http://localhost:3001/api/v1
#   BACKEND_JWT=<paste from frontend after wallet login>
#   HUMAN_WALLET_KEYPAIR_PATH=./demo-wallet.json

# Generate demo wallet
solana-keygen new --outfile demo-wallet.json --no-bip39-passphrase

# Run the demo
npm run demo
```

Open `http://localhost:5173` and watch the graph populate in real time.

## Tech Stack

| Layer | Technology |
| --- | --- |
| Smart Contract | Rust + Anchor 0.30 |
| Blockchain | Solana Devnet + SNS |
| Backend | Fastify + TypeScript |
| Database | PostgreSQL 16 + Prisma ORM |
| Cache/Queue | Redis 7 + BullMQ |
| Frontend | React 18 + Vite + Tailwind |
| Visualization | D3.js v7 (force graph + tree layout) |
| Real-time | WebSocket + Zustand |
| Wallet | @solana/wallet-adapter |
| Design System | Silk (Neomorphic UI) |

## Project Structure

```text
trustmesh/
├── trustmesh-program/      # Anchor smart contract
│   ├── programs/trustmesh/src/lib.rs
│   └── tests/trustmesh.ts
├── src/                    # Fastify backend
│   ├── routes/             # REST endpoints
│   ├── services/           # SNS, Anchor, crypto
│   ├── queues/             # BullMQ workers
│   └── websocket/          # Redis → WS fanout
├── src/                    # React frontend (shared src/)
│   ├── components/         # NavBar, ForceGraph, etc.
│   ├── pages/              # Explorer, Deploy, JobDetail
│   └── stores/             # Zustand agent state
└── agent-runtime/          # Demo simulator
    └── src/index.ts        # Sequential agent workflow
```

## What Makes This Novel

No one on Solana has built:

- Hierarchical agent identity using SNS sub-domains — `.sol` names aren't just for humans anymore
- On-chain delegation logs with Ed25519 verification — provably signed inter-agent messages
- Real-time graph visualization of multi-agent coordination — D3 force graph + WebSocket updates
- One-click cascade revocation — revoking a parent agent instantly halts all descendants

Existing projects (Blinks, Dialect) focus on human identity or simple agent wallets. TrustMesh is the first agent lineage and accountability layer native to Solana.

## Team

[Your name] — [Role]  
[Teammate name] — [Role]

## License

MIT
