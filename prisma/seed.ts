import { PrismaClient, AgentStatus, AgentType, JobStatus } from "@prisma/client";
import { logger } from "../src/lib/logger.js";

const prisma = new PrismaClient();

async function main() {
  await prisma.agentMessage.deleteMany();
  await prisma.agent.deleteMany();
  await prisma.job.deleteMany();
  await prisma.user.deleteMany();

  const alice = await prisma.user.create({
    data: {
      walletAddr: "11111111111111111111111111111111",
      solName: "alice.sol"
    }
  });

  const bob = await prisma.user.create({
    data: {
      walletAddr: "So11111111111111111111111111111111111111112",
      solName: "bob.sol"
    }
  });

  const carol = await prisma.user.create({
    data: {
      walletAddr: "SysvarC1ock11111111111111111111111111111111",
      solName: "carol.sol"
    }
  });

  const aliceJob = await prisma.job.create({
    data: {
      onchainId: "A7F3C2",
      ownerId: alice.id,
      description: "Historical block audit and shard reconciliation",
      template: "DATA_FETCHER",
      budgetSol: "0.250000000",
      status: JobStatus.ACTIVE
    }
  });

  const alicePlanner = await prisma.agent.create({
    data: {
      jobId: aliceJob.id,
      ownerId: alice.id,
      solSubName: "planner.alice.sol",
      type: AgentType.PLANNER,
      spawnTxHash: "tx-spawn-planner-a7f3c2"
    }
  });

  const dataFetcher = await prisma.agent.create({
    data: {
      jobId: aliceJob.id,
      ownerId: alice.id,
      solSubName: "data-fetcher.alice.sol",
      type: AgentType.EXECUTOR,
      parentAgentId: alicePlanner.id,
      spawnTxHash: "tx-spawn-data-fetcher-a7f3c2",
      actionCount: 1
    }
  });

  const logProcessor = await prisma.agent.create({
    data: {
      jobId: aliceJob.id,
      ownerId: alice.id,
      solSubName: "log-processor.alice.sol",
      type: AgentType.EXECUTOR,
      parentAgentId: alicePlanner.id,
      spawnTxHash: "tx-spawn-log-processor-a7f3c2",
      actionCount: 2
    }
  });

  await prisma.agent.createMany({
    data: [
      {
        jobId: aliceJob.id,
        ownerId: alice.id,
        solSubName: "report-gen.alice.sol",
        type: AgentType.EXECUTOR,
        parentAgentId: alicePlanner.id,
        spawnTxHash: "tx-spawn-report-gen-a7f3c2"
      },
      {
        jobId: aliceJob.id,
        ownerId: alice.id,
        solSubName: "shard-index.alice.sol",
        type: AgentType.ANALYZER,
        parentAgentId: logProcessor.id,
        spawnTxHash: "tx-spawn-shard-index-a7f3c2"
      }
    ]
  });

  await prisma.agentMessage.createMany({
    data: [
      {
        jobId: aliceJob.id,
        senderId: alicePlanner.id,
        receiverId: dataFetcher.id,
        action: "Requested historical block data for shard #09. Batch size 500 records.",
        txHash: "0x9f1a-c4e2",
        signatureHex: "0".repeat(128),
        verified: true
      },
      {
        jobId: aliceJob.id,
        senderId: dataFetcher.id,
        receiverId: logProcessor.id,
        action: "Transferred data payload (3.4MB) for sanitization and indexing.",
        txHash: "0x82b4-33a0",
        signatureHex: "1".repeat(128),
        verified: true
      },
      {
        jobId: aliceJob.id,
        senderId: logProcessor.id,
        receiverId: null,
        action: "Executing cross-chain log reconciliation via LayerZero messaging bridge.",
        txHash: "0x17ae-5b92",
        signatureHex: "2".repeat(128),
        verified: true
      }
    ]
  });

  const bobJob = await prisma.job.create({
    data: {
      onchainId: "B91E44",
      ownerId: bob.id,
      description: "DAO voter delegation and quorum watch",
      template: "DAO_VOTER",
      budgetSol: "0.120000000",
      status: JobStatus.ACTIVE
    }
  });

  const bobPlanner = await prisma.agent.create({
    data: {
      jobId: bobJob.id,
      ownerId: bob.id,
      solSubName: "planner.bob.sol",
      type: AgentType.PLANNER,
      spawnTxHash: "tx-spawn-planner-b91e44"
    }
  });

  await prisma.agent.createMany({
    data: [
      {
        jobId: bobJob.id,
        ownerId: bob.id,
        solSubName: "vote-reader.bob.sol",
        type: AgentType.ANALYZER,
        parentAgentId: bobPlanner.id,
        spawnTxHash: "tx-spawn-vote-reader-b91e44"
      },
      {
        jobId: bobJob.id,
        ownerId: bob.id,
        solSubName: "confirmer.bob.sol",
        type: AgentType.CONFIRMER,
        parentAgentId: bobPlanner.id,
        spawnTxHash: "tx-spawn-confirmer-b91e44"
      }
    ]
  });

  const carolJob = await prisma.job.create({
    data: {
      onchainId: "C04F99",
      ownerId: carol.id,
      description: "Revoked portfolio rebalancer demo",
      template: "PORTFOLIO_REBALANCER",
      budgetSol: "0.500000000",
      status: JobStatus.REVOKED
    }
  });

  const carolPlanner = await prisma.agent.create({
    data: {
      jobId: carolJob.id,
      ownerId: carol.id,
      solSubName: "planner.carol.sol",
      type: AgentType.PLANNER,
      status: AgentStatus.REVOKED,
      spawnTxHash: "tx-spawn-planner-c04f99",
      revokeTxHash: "tx-revoke-carol-c04f99",
      revokedAt: new Date()
    }
  });

  await prisma.agent.create({
    data: {
      jobId: carolJob.id,
      ownerId: carol.id,
      solSubName: "trader.carol.sol",
      type: AgentType.TRADER,
      status: AgentStatus.REVOKED,
      parentAgentId: carolPlanner.id,
      spawnTxHash: "tx-spawn-trader-c04f99",
      revokeTxHash: "tx-revoke-carol-c04f99",
      revokedAt: new Date()
    }
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    logger.error({ err: error }, "prisma seed failed");
    await prisma.$disconnect();
    process.exit(1);
  });
