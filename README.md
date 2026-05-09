# TrustMesh Backend

Production-oriented Fastify backend for the TrustMesh Solana multi-agent coordination and audit platform.

## Stack

- Node.js 20 and TypeScript strict mode
- Fastify with CORS, JWT auth, rate limiting, and WebSocket support
- PostgreSQL 16 through Prisma
- Redis 7 for cache, pub/sub, and BullMQ
- Solana RPC through `@solana/web3.js` and Anchor-compatible service wrappers

## Local Setup

```bash
cp .env.example .env
docker compose up -d
npm install
npm run prisma:dev
npm run prisma:seed
npm run dev
```

The API listens on `PORT` and exposes REST routes under `/api/v1`. WebSocket clients connect to `/ws?jobId=<id>`.

## Verification

```bash
npm run typecheck
npm test
```

The integration tests exercise the Fastify server with mocked Prisma, Redis, SNS, and Anchor dependencies. A real database is used by the app at runtime.
