import * as anchor from "@coral-xyz/anchor";
import type { BN, Program } from "@coral-xyz/anchor";
import { expect } from "chai";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import nacl from "tweetnacl";
import { Ed25519Program, Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import type { Trustmesh } from "../target/types/trustmesh";

const PROGRAM_ID = new PublicKey("66DXeSqBccWxWWw9S21vxe2Mvvqqkmw5KsK5jqA42quz");
const TEMPLATE_PORTFOLIO_REBALANCER = 0;
const TEMPLATE_DATA_FETCHER = 2;
const JOB_STATUS_ACTIVE = 0;
const JOB_STATUS_COMPLETE = 1;
const AGENT_TYPE_PLANNER = 0;
const AGENT_TYPE_EXECUTOR = 1;
const AGENT_STATUS_REVOKED = 2;

describe("trustmesh", () => {
  const { BN } = anchor;
  const provider = new anchor.AnchorProvider(
    new anchor.web3.Connection("http://127.0.0.1:8899", "confirmed"),
    new anchor.Wallet(loadLocalWallet()),
    { commitment: "confirmed" }
  );
  anchor.setProvider(provider);
  const program = anchor.workspace.Trustmesh as Program<Trustmesh>;

  it("initialize_job creates the PDA and stores the expected fields", async () => {
    const owner = provider.wallet.publicKey;
    const jobId = sha256(`job:${Date.now()}:initialize`);
    const descriptionHash = sha256("Rebalance SOL/USDC to 60/40");
    const [jobPda] = deriveJobPda(owner, jobId);
    const budgetLamports = new BN(2_500_000);

    await program.methods
      .initializeJob([...jobId], [...descriptionHash], TEMPLATE_PORTFOLIO_REBALANCER, budgetLamports)
      .accounts({
        owner,
        job: jobPda,
        systemProgram: SystemProgram.programId
      })
      .rpc();

    const job = await program.account.jobAccount.fetch(jobPda);
    expect(Buffer.from(job.jobId)).to.deep.equal(jobId);
    expect(Buffer.from(job.descriptionHash)).to.deep.equal(descriptionHash);
    expect(job.owner.toBase58()).to.equal(owner.toBase58());
    expect(job.template).to.equal(TEMPLATE_PORTFOLIO_REBALANCER);
    expect(job.status).to.equal(JOB_STATUS_ACTIVE);
    expect(job.agentCount).to.equal(0);
    expect(job.budgetLamports.toString()).to.equal(budgetLamports.toString());
  });

  it("spawn_agent succeeds for an active job and fails once the job is no longer active", async () => {
    const owner = provider.wallet.publicKey;
    const jobId = sha256(`job:${Date.now()}:spawn`);
    const descriptionHash = sha256("Fetch governed treasury balances");
    const [jobPda] = deriveJobPda(owner, jobId);

    await program.methods
      .initializeJob([...jobId], [...descriptionHash], TEMPLATE_DATA_FETCHER, new BN(1_000_000))
      .accounts({ owner, job: jobPda, systemProgram: SystemProgram.programId })
      .rpc();

    const plannerWallet = Keypair.generate();
    const plannerHash = sha256("planner.alice.sol");
    const [plannerAgentPda] = deriveAgentPda(jobPda, plannerWallet.publicKey);

    await program.methods
      .spawnAgent([...plannerHash], AGENT_TYPE_PLANNER, plannerWallet.publicKey, null)
      .accountsPartial({
        owner,
        job: jobPda,
        agent: plannerAgentPda,
        systemProgram: SystemProgram.programId
      })
      .rpc();

    const job = await program.account.jobAccount.fetch(jobPda);
    expect(job.agentCount).to.equal(1);

    await program.methods.completeJob().accounts({ owner, job: jobPda }).rpc();

    const executorWallet = Keypair.generate();
    const executorHash = sha256("executor.alice.sol");
    const [executorAgentPda] = deriveAgentPda(jobPda, executorWallet.publicKey);

    await expectAnchorError(
      program.methods
        .spawnAgent([...executorHash], AGENT_TYPE_EXECUTOR, executorWallet.publicKey, null)
        .accountsPartial({
          owner,
          job: jobPda,
          agent: executorAgentPda,
          systemProgram: SystemProgram.programId
        })
        .rpc(),
      "JobNotActive"
    );
  });

  it("spawn_agent supports valid parent agents and rejects revoked parents", async () => {
    const owner = provider.wallet.publicKey;
    const jobId = sha256(`job:${Date.now()}:parent`);
    const descriptionHash = sha256("Route planner tasks to execution workers");
    const [jobPda] = deriveJobPda(owner, jobId);

    await program.methods
      .initializeJob([...jobId], [...descriptionHash], TEMPLATE_PORTFOLIO_REBALANCER, new BN(1_000_000))
      .accounts({ owner, job: jobPda, systemProgram: SystemProgram.programId })
      .rpc();

    const plannerWallet = Keypair.generate();
    const [plannerAgentPda] = deriveAgentPda(jobPda, plannerWallet.publicKey);

    await program.methods
      .spawnAgent([...sha256("planner.parent.sol")], AGENT_TYPE_PLANNER, plannerWallet.publicKey, null)
      .accountsPartial({
        owner,
        job: jobPda,
        agent: plannerAgentPda,
        systemProgram: SystemProgram.programId
      })
      .rpc();

    const executorWallet = Keypair.generate();
    const [executorAgentPda] = deriveAgentPda(jobPda, executorWallet.publicKey);

    await program.methods
      .spawnAgent(
        [...sha256("executor.child.sol")],
        AGENT_TYPE_EXECUTOR,
        executorWallet.publicKey,
        plannerAgentPda
      )
      .accountsPartial({
        owner,
        job: jobPda,
        agent: executorAgentPda,
        parentAgent: plannerAgentPda,
        systemProgram: SystemProgram.programId
      })
      .rpc();

    const child = await program.account.agentAccount.fetch(executorAgentPda);
    expect(child.parentAgent?.toBase58()).to.equal(plannerAgentPda.toBase58());

    await program.methods
      .revokeAgent(plannerWallet.publicKey)
      .accounts({
        owner,
        job: jobPda,
        agent: plannerAgentPda
      })
      .rpc();

    const blockedWallet = Keypair.generate();
    const [blockedAgentPda] = deriveAgentPda(jobPda, blockedWallet.publicKey);

    await expectAnchorError(
      program.methods
        .spawnAgent(
          [...sha256("blocked.child.sol")],
          AGENT_TYPE_EXECUTOR,
          blockedWallet.publicKey,
          plannerAgentPda
        )
        .accountsPartial({
          owner,
          job: jobPda,
          agent: blockedAgentPda,
          parentAgent: plannerAgentPda,
          systemProgram: SystemProgram.programId
        })
        .rpc(),
      "InvalidParentAgent"
    );
  });

  it("log_delegation accepts a valid Ed25519 proof and rejects tampered data", async () => {
    const owner = provider.wallet.publicKey;
    const jobId = sha256(`job:${Date.now()}:delegation`);
    const descriptionHash = sha256("Coordinate planner and executor actions");
    const [jobPda] = deriveJobPda(owner, jobId);

    await program.methods
      .initializeJob([...jobId], [...descriptionHash], TEMPLATE_PORTFOLIO_REBALANCER, new BN(1_000_000))
      .accounts({ owner, job: jobPda, systemProgram: SystemProgram.programId })
      .rpc();

    const plannerWallet = Keypair.generate();
    const executorWallet = Keypair.generate();
    await Promise.all([
      airdrop(provider.connection, plannerWallet.publicKey),
      airdrop(provider.connection, executorWallet.publicKey)
    ]);

    const [plannerAgentPda] = deriveAgentPda(jobPda, plannerWallet.publicKey);
    const [executorAgentPda] = deriveAgentPda(jobPda, executorWallet.publicKey);

    await program.methods
      .spawnAgent([...sha256("planner.audit.sol")], AGENT_TYPE_PLANNER, plannerWallet.publicKey, null)
      .accountsPartial({
        owner,
        job: jobPda,
        agent: plannerAgentPda,
        systemProgram: SystemProgram.programId
      })
      .rpc();

    await program.methods
      .spawnAgent(
        [...sha256("executor.audit.sol")],
        AGENT_TYPE_EXECUTOR,
        executorWallet.publicKey,
        plannerAgentPda
      )
      .accountsPartial({
        owner,
        job: jobPda,
        agent: executorAgentPda,
        parentAgent: plannerAgentPda,
        systemProgram: SystemProgram.programId
      })
      .rpc();

    const actionHash = sha256("Fetch SOL/USDC spot price from Jupiter API");
    const signature = nacl.sign.detached(actionHash, plannerWallet.secretKey);
    const proofIx = Ed25519Program.createInstructionWithPrivateKey({
      privateKey: plannerWallet.secretKey,
      message: actionHash
    });
    const [delegationPda] = deriveDelegationPda(jobPda, plannerAgentPda, actionHash);

    await program.methods
      .logDelegation([...actionHash], [...signature], executorAgentPda)
      .accountsPartial({
        sender: plannerWallet.publicKey,
        job: jobPda,
        senderAgent: plannerAgentPda,
        delegationLog: delegationPda,
        receiverAgent: executorAgentPda,
        instructions: anchor.web3.SYSVAR_INSTRUCTIONS_PUBKEY,
        systemProgram: SystemProgram.programId
      })
      .preInstructions([proofIx])
      .signers([plannerWallet])
      .rpc();

    const delegation = await program.account.delegationLogAccount.fetch(delegationPda);
    expect(delegation.verified).to.equal(true);
    expect(delegation.receiverAgent?.toBase58()).to.equal(executorAgentPda.toBase58());

    const tamperedSignature = Uint8Array.from(signature);
    tamperedSignature[0] ^= 0xff;
    const tamperedActionHash = sha256("Tampered SOL/USDC delegation");
    const [badDelegationPda] = deriveDelegationPda(jobPda, plannerAgentPda, tamperedActionHash);

    await expectAnchorError(
      program.methods
        .logDelegation([...tamperedActionHash], [...tamperedSignature], executorAgentPda)
        .accountsPartial({
          sender: plannerWallet.publicKey,
          job: jobPda,
          senderAgent: plannerAgentPda,
          delegationLog: badDelegationPda,
          receiverAgent: executorAgentPda,
          instructions: anchor.web3.SYSVAR_INSTRUCTIONS_PUBKEY,
          systemProgram: SystemProgram.programId
        })
        .preInstructions([proofIx])
        .signers([plannerWallet])
        .rpc(),
      "SignatureVerificationFailed"
    );
  });

  it("revoke_agent allows the owner and rejects non-owners", async () => {
    const owner = provider.wallet.publicKey;
    const attacker = Keypair.generate();
    const jobId = sha256(`job:${Date.now()}:revoke`);
    const descriptionHash = sha256("Protect the delegation graph from rogue actors");
    const [jobPda] = deriveJobPda(owner, jobId);

    await program.methods
      .initializeJob([...jobId], [...descriptionHash], TEMPLATE_DATA_FETCHER, new BN(1_000_000))
      .accounts({ owner, job: jobPda, systemProgram: SystemProgram.programId })
      .rpc();

    const plannerWallet = Keypair.generate();
    const [plannerAgentPda] = deriveAgentPda(jobPda, plannerWallet.publicKey);

    await program.methods
      .spawnAgent([...sha256("planner.revoke.sol")], AGENT_TYPE_PLANNER, plannerWallet.publicKey, null)
      .accountsPartial({
        owner,
        job: jobPda,
        agent: plannerAgentPda,
        systemProgram: SystemProgram.programId
      })
      .rpc();

    await expectAnchorError(
      program.methods
        .revokeAgent(plannerWallet.publicKey)
        .accounts({
          owner: attacker.publicKey,
          job: jobPda,
          agent: plannerAgentPda
        })
        .signers([attacker])
        .rpc(),
      ["UnauthorizedSigner", "ConstraintSeeds"]
    );

    await program.methods
      .revokeAgent(plannerWallet.publicKey)
      .accounts({
        owner,
        job: jobPda,
        agent: plannerAgentPda
      })
      .rpc();

    const planner = await program.account.agentAccount.fetch(plannerAgentPda);
    expect(planner.status).to.equal(AGENT_STATUS_REVOKED);
    expect(planner.revokedAt).to.not.equal(null);
  });

  it("complete_job marks the job complete and blocks future agent spawns", async () => {
    const owner = provider.wallet.publicKey;
    const jobId = sha256(`job:${Date.now()}:complete`);
    const descriptionHash = sha256("Finalize the coordination graph");
    const [jobPda] = deriveJobPda(owner, jobId);

    await program.methods
      .initializeJob([...jobId], [...descriptionHash], TEMPLATE_PORTFOLIO_REBALANCER, new BN(1_000_000))
      .accounts({ owner, job: jobPda, systemProgram: SystemProgram.programId })
      .rpc();

    await program.methods.completeJob().accounts({ owner, job: jobPda }).rpc();

    const job = await program.account.jobAccount.fetch(jobPda);
    expect(job.status).to.equal(JOB_STATUS_COMPLETE);

    const plannerWallet = Keypair.generate();
    const [plannerAgentPda] = deriveAgentPda(jobPda, plannerWallet.publicKey);

    await expectAnchorError(
      program.methods
        .spawnAgent([...sha256("planner.complete.sol")], AGENT_TYPE_PLANNER, plannerWallet.publicKey, null)
        .accountsPartial({
          owner,
          job: jobPda,
          agent: plannerAgentPda,
          systemProgram: SystemProgram.programId
        })
        .rpc(),
      "JobNotActive"
    );
  });
});

function deriveJobPda(owner: PublicKey, jobId: Buffer) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("job"), owner.toBuffer(), jobId],
    PROGRAM_ID
  );
}

function deriveAgentPda(job: PublicKey, agentWallet: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("agent"), job.toBuffer(), agentWallet.toBuffer()],
    PROGRAM_ID
  );
}

function deriveDelegationPda(job: PublicKey, senderAgent: PublicKey, actionHash: Buffer) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("delegation"), job.toBuffer(), senderAgent.toBuffer(), actionHash],
    PROGRAM_ID
  );
}

function sha256(value: string) {
  return crypto.createHash("sha256").update(value).digest();
}

async function airdrop(connection: anchor.web3.Connection, publicKey: PublicKey, lamports = 1_000_000_000) {
  const signature = await connection.requestAirdrop(publicKey, lamports);
  await connection.confirmTransaction(signature, "confirmed");
}

async function expectAnchorError(promise: Promise<unknown>, code: string | string[]) {
  try {
    await promise;
    expect.fail(`Expected Anchor error ${Array.isArray(code) ? code.join(" or ") : code}`);
  } catch (error) {
    const anchorError = error as { error?: { errorCode?: { code?: string } }; toString(): string };
    const message = anchorError.toString();
    const actualCode = anchorError.error?.errorCode?.code;
    const haystack = actualCode ?? message;
    const expectedCodes = Array.isArray(code) ? code : [code];
    expect(expectedCodes.some((candidate) => haystack.includes(candidate))).to.equal(true);
  }
}

function loadLocalWallet() {
  const walletPath = process.env.ANCHOR_WALLET ?? path.join(os.homedir(), ".config/solana/id.json");
  const secretKey = JSON.parse(fs.readFileSync(walletPath, "utf8")) as number[];
  return Keypair.fromSecretKey(Uint8Array.from(secretKey));
}
