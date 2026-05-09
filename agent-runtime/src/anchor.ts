import { createHash } from "node:crypto";
import {
  AnchorProvider,
  Program,
  Wallet,
  type BN,
  type Idl
} from "@coral-xyz/anchor";
import {
  Connection,
  Ed25519Program,
  Keypair,
  PublicKey,
  SYSVAR_INSTRUCTIONS_PUBKEY,
  SystemProgram,
  type TransactionInstruction
} from "@solana/web3.js";
import { trustmeshIdl, type TrustmeshIdl } from "../../src/idl/trustmesh.js";

type TrustmeshProgram = Program<Idl>;

type RpcInvocation = {
  accounts(accounts: Record<string, PublicKey>): RpcInvocation;
  accountsPartial(accounts: Record<string, PublicKey | null | undefined>): RpcInvocation;
  preInstructions(instructions: TransactionInstruction[]): RpcInvocation;
  signers(signers: Keypair[]): RpcInvocation;
  rpc(): Promise<string>;
};

type TrustmeshMethods = {
  initializeJob(
    jobId: number[],
    descriptionHash: number[],
    template: number,
    budgetLamports: BN
  ): RpcInvocation;
  spawnAgent(
    solNameHash: number[],
    agentType: number,
    agentWallet: PublicKey,
    parentAgent: PublicKey | null
  ): RpcInvocation;
  logDelegation(
    actionHash: number[],
    signature: number[],
    receiverAgent: PublicKey | null
  ): RpcInvocation;
  completeJob(): RpcInvocation;
};

type InitializeJobParams = {
  connection: Connection;
  wallet: Keypair;
  jobId: Buffer;
  descriptionHash: Buffer;
  template: number;
  budgetLamports: BN;
};

type SpawnAgentParams = {
  connection: Connection;
  wallet: Keypair;
  jobPda: PublicKey;
  solNameHash: Buffer;
  agentType: number;
  agentWallet: PublicKey;
  parentAgent: PublicKey | null;
};

type LogDelegationParams = {
  connection: Connection;
  wallet: Keypair;
  jobPda: PublicKey;
  senderAgentPda: PublicKey;
  receiverAgentPda: PublicKey | null;
  actionHash: Buffer;
  signature: Buffer;
};

type CompleteJobParams = {
  connection: Connection;
  wallet: Keypair;
  jobPda: PublicKey;
};

function instructionDiscriminator(name: string): number[] {
  return Array.from(
    createHash("sha256")
      .update(`global:${name}`)
      .digest()
      .subarray(0, 8)
  );
}

function getAugmentedIdl(): Idl {
  const baseIdl = trustmeshIdl as Idl & TrustmeshIdl;

  return {
    ...baseIdl,
    instructions: [
      {
        name: "initialize_job",
        discriminator: instructionDiscriminator("initialize_job"),
        accounts: [
          { name: "owner", writable: true, signer: true },
          { name: "job", writable: true },
          { name: "system_program" }
        ],
        args: [
          { name: "job_id", type: { array: ["u8", 32] } },
          { name: "description_hash", type: { array: ["u8", 32] } },
          { name: "template", type: "u8" },
          { name: "budget_lamports", type: "u64" }
        ]
      },
      {
        name: "spawn_agent",
        discriminator: instructionDiscriminator("spawn_agent"),
        accounts: [
          { name: "owner", writable: true, signer: true },
          { name: "job", writable: true },
          { name: "agent", writable: true },
          { name: "parent_agent", optional: true },
          { name: "system_program" }
        ],
        args: [
          { name: "sol_name_hash", type: { array: ["u8", 32] } },
          { name: "agent_type", type: "u8" },
          { name: "agent_wallet", type: "pubkey" },
          { name: "parent_agent", type: { option: "pubkey" } }
        ]
      },
      {
        name: "log_delegation",
        discriminator: instructionDiscriminator("log_delegation"),
        accounts: [
          { name: "sender", writable: true, signer: true },
          { name: "job" },
          { name: "sender_agent", writable: true },
          { name: "delegation_log", writable: true },
          { name: "receiver_agent", optional: true },
          { name: "instructions" },
          { name: "system_program" }
        ],
        args: [
          { name: "action_hash", type: { array: ["u8", 32] } },
          { name: "signature", type: { array: ["u8", 64] } },
          { name: "receiver_agent", type: { option: "pubkey" } }
        ]
      },
      {
        name: "complete_job",
        discriminator: instructionDiscriminator("complete_job"),
        accounts: [
          { name: "owner", writable: true, signer: true },
          { name: "job", writable: true }
        ],
        args: []
      }
    ]
  };
}

function getMethods(program: TrustmeshProgram): TrustmeshMethods {
  return program.methods as unknown as TrustmeshMethods;
}

export function getProgram(connection: Connection, wallet: Keypair): TrustmeshProgram {
  const provider = new AnchorProvider(connection, new Wallet(wallet), {
    commitment: "confirmed"
  });

  return new Program(getAugmentedIdl(), provider);
}

export function deriveJobPda(programId: PublicKey, owner: PublicKey, jobId: Buffer) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("job"), owner.toBuffer(), jobId],
    programId
  );
}

export function deriveAgentPda(programId: PublicKey, job: PublicKey, agentWallet: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("agent"), job.toBuffer(), agentWallet.toBuffer()],
    programId
  );
}

export function deriveDelegationPda(
  programId: PublicKey,
  job: PublicKey,
  sender: PublicKey,
  actionHash: Buffer
) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("delegation"), job.toBuffer(), sender.toBuffer(), actionHash],
    programId
  );
}

export async function initializeJobTx(params: InitializeJobParams) {
  const program = getProgram(params.connection, params.wallet);
  const [jobPda] = deriveJobPda(program.programId, params.wallet.publicKey, params.jobId);
  const methods = getMethods(program);

  const txHash = await methods
    .initializeJob(
      Array.from(params.jobId),
      Array.from(params.descriptionHash),
      params.template,
      params.budgetLamports
    )
    .accounts({
      owner: params.wallet.publicKey,
      job: jobPda,
      systemProgram: SystemProgram.programId
    })
    .signers([params.wallet])
    .rpc();

  return { jobPda, txHash, programId: program.programId };
}

export async function spawnAgentTx(params: SpawnAgentParams) {
  const program = getProgram(params.connection, params.wallet);
  const [agentPda] = deriveAgentPda(program.programId, params.jobPda, params.agentWallet);
  const methods = getMethods(program);

  const txHash = await methods
    .spawnAgent(
      Array.from(params.solNameHash),
      params.agentType,
      params.agentWallet,
      params.parentAgent
    )
    .accountsPartial({
      owner: params.wallet.publicKey,
      job: params.jobPda,
      agent: agentPda,
      parentAgent: params.parentAgent,
      systemProgram: SystemProgram.programId
    })
    .signers([params.wallet])
    .rpc();

  return { agentPda, txHash, programId: program.programId };
}

export async function logDelegationTx(params: LogDelegationParams) {
  const program = getProgram(params.connection, params.wallet);
  const [delegationPda] = deriveDelegationPda(
    program.programId,
    params.jobPda,
    params.senderAgentPda,
    params.actionHash
  );
  const methods = getMethods(program);
  const proofInstruction = Ed25519Program.createInstructionWithPrivateKey({
    privateKey: params.wallet.secretKey,
    message: params.actionHash
  });

  const txHash = await methods
    .logDelegation(
      Array.from(params.actionHash),
      Array.from(params.signature),
      params.receiverAgentPda
    )
    .preInstructions([proofInstruction])
    .accountsPartial({
      sender: params.wallet.publicKey,
      job: params.jobPda,
      senderAgent: params.senderAgentPda,
      delegationLog: delegationPda,
      receiverAgent: params.receiverAgentPda,
      instructions: SYSVAR_INSTRUCTIONS_PUBKEY,
      systemProgram: SystemProgram.programId
    })
    .signers([params.wallet])
    .rpc();

  return { delegationPda, txHash };
}

export async function completeJobTx(params: CompleteJobParams) {
  const program = getProgram(params.connection, params.wallet);
  const methods = getMethods(program);

  const txHash = await methods
    .completeJob()
    .accounts({
      owner: params.wallet.publicKey,
      job: params.jobPda
    })
    .signers([params.wallet])
    .rpc();

  return { txHash };
}
