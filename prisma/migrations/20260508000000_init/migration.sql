CREATE TYPE "JobStatus" AS ENUM ('ACTIVE', 'COMPLETE', 'REVOKED');
CREATE TYPE "AgentType" AS ENUM ('PLANNER', 'EXECUTOR', 'ANALYZER', 'TRADER', 'CONFIRMER');
CREATE TYPE "AgentStatus" AS ENUM ('ACTIVE', 'WARNING', 'REVOKED', 'COMPLETE');

CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "walletAddr" TEXT NOT NULL,
  "solName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Job" (
  "id" TEXT NOT NULL,
  "onchainId" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "template" TEXT NOT NULL,
  "budgetSol" DECIMAL(18,9) NOT NULL,
  "status" "JobStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Agent" (
  "id" TEXT NOT NULL,
  "jobId" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "solSubName" TEXT NOT NULL,
  "type" "AgentType" NOT NULL,
  "status" "AgentStatus" NOT NULL DEFAULT 'ACTIVE',
  "parentAgentId" TEXT,
  "spawnTxHash" TEXT NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "revokeTxHash" TEXT,
  "actionCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Agent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AgentMessage" (
  "id" TEXT NOT NULL,
  "jobId" TEXT NOT NULL,
  "senderId" TEXT NOT NULL,
  "receiverId" TEXT,
  "action" TEXT NOT NULL,
  "txHash" TEXT NOT NULL,
  "signatureHex" TEXT NOT NULL,
  "verified" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgentMessage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_walletAddr_key" ON "User"("walletAddr");
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");

CREATE UNIQUE INDEX "Job_onchainId_key" ON "Job"("onchainId");
CREATE INDEX "Job_ownerId_status_createdAt_idx" ON "Job"("ownerId", "status", "createdAt");
CREATE INDEX "Job_status_createdAt_idx" ON "Job"("status", "createdAt");

CREATE UNIQUE INDEX "Agent_solSubName_key" ON "Agent"("solSubName");
CREATE INDEX "Agent_jobId_status_idx" ON "Agent"("jobId", "status");
CREATE INDEX "Agent_ownerId_status_idx" ON "Agent"("ownerId", "status");
CREATE INDEX "Agent_parentAgentId_idx" ON "Agent"("parentAgentId");

CREATE INDEX "AgentMessage_jobId_createdAt_id_idx" ON "AgentMessage"("jobId", "createdAt", "id");
CREATE INDEX "AgentMessage_senderId_createdAt_idx" ON "AgentMessage"("senderId", "createdAt");
CREATE INDEX "AgentMessage_receiverId_createdAt_idx" ON "AgentMessage"("receiverId", "createdAt");
CREATE UNIQUE INDEX "AgentMessage_senderId_txHash_key" ON "AgentMessage"("senderId", "txHash");

ALTER TABLE "Job" ADD CONSTRAINT "Job_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Agent" ADD CONSTRAINT "Agent_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Agent" ADD CONSTRAINT "Agent_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Agent" ADD CONSTRAINT "Agent_parentAgentId_fkey" FOREIGN KEY ("parentAgentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AgentMessage" ADD CONSTRAINT "AgentMessage_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AgentMessage" ADD CONSTRAINT "AgentMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AgentMessage" ADD CONSTRAINT "AgentMessage_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
