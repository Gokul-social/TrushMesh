import { Connection, ParsedInstruction, PublicKey } from "@solana/web3.js";
import { BorshInstructionCoder, type Idl } from "@coral-xyz/anchor";
import { env } from "../lib/env.js";

export type DelegationExpectation = {
  jobOnchainId?: string;
  agentSolNames?: string[];
};

export type OnchainAgentMessage = {
  jobOnchainId: string;
  senderSolName: string;
  receiverSolName: string | null;
  action: string;
  txHash: string;
  signatureHex: string;
};

export type AnchorVerifier = {
  verifyDelegationLog(txHash: string, expected?: DelegationExpectation): Promise<boolean>;
  verifyRevocationTx(txHash: string, agentSolName: string): Promise<boolean>;
  extractAgentMessage(txHash: string): Promise<OnchainAgentMessage | null>;
};

export class TrustMeshAnchorService implements AnchorVerifier {
  private readonly programId: PublicKey;
  private readonly instructionCoder: BorshInstructionCoder;

  constructor(
    private readonly connection = new Connection(env.SOLANA_RPC_URL, "confirmed"),
    programId = env.ANCHOR_PROGRAM_ID
  ) {
    this.programId = new PublicKey(programId);
    this.instructionCoder = new BorshInstructionCoder(createTrustMeshIdl(this.programId.toBase58()));
  }

  async verifyDelegationLog(txHash: string, expected?: DelegationExpectation) {
    const tx = await this.fetchTransaction(txHash);
    if (!tx) {
      return false;
    }

    if (!this.includesTrustMeshProgram(tx.transaction.message.instructions)) {
      return false;
    }

    const evidence = this.getTransactionEvidence(tx);
    if (expected?.jobOnchainId && !evidence.some((line) => line.includes(expected.jobOnchainId!))) {
      return false;
    }

    if (expected?.agentSolNames) {
      return expected.agentSolNames.every((solName) => evidence.some((line) => line.includes(solName)));
    }

    return true;
  }

  async verifyRevocationTx(txHash: string, agentSolName: string) {
    const tx = await this.fetchTransaction(txHash);
    if (!tx) {
      return false;
    }

    if (!this.includesTrustMeshProgram(tx.transaction.message.instructions)) {
      return false;
    }

    const evidence = this.getTransactionEvidence(tx);
    return evidence.some((line) => line.toLowerCase().includes("revoke")) &&
      evidence.some((line) => line.includes(agentSolName));
  }

  async extractAgentMessage(txHash: string): Promise<OnchainAgentMessage | null> {
    const tx = await this.fetchTransaction(txHash);
    const logs = tx?.meta?.logMessages ?? [];
    for (const line of logs) {
      const match = line.match(/TRUSTMESH_MESSAGE\s+({.+})/);
      if (!match) {
        continue;
      }
      const parsed = JSON.parse(match[1]) as Omit<OnchainAgentMessage, "txHash">;
      return { ...parsed, txHash };
    }
    return null;
  }

  private async fetchTransaction(txHash: string) {
    try {
      return await this.connection.getParsedTransaction(txHash, {
        commitment: "confirmed",
        maxSupportedTransactionVersion: 0
      });
    } catch {
      return null;
    }
  }

  private includesTrustMeshProgram(instructions: ParsedInstruction[] | readonly unknown[]) {
    return instructions.some((instruction) => {
      const programId = (instruction as { programId?: PublicKey }).programId;
      return programId?.toBase58() === this.programId.toBase58();
    });
  }

  private getTransactionEvidence(tx: NonNullable<Awaited<ReturnType<TrustMeshAnchorService["fetchTransaction"]>>>) {
    const logs = tx.meta?.logMessages ?? [];
    const decoded = tx.transaction.message.instructions
      .filter((instruction) => {
        const programId = (instruction as { programId?: PublicKey }).programId;
        return programId?.toBase58() === this.programId.toBase58();
      })
      .map((instruction) => this.decodeInstruction(instruction))
      .filter((value): value is string => Boolean(value));

    return [...logs, ...decoded];
  }

  private decodeInstruction(instruction: unknown) {
    const data = (instruction as { data?: string }).data;
    if (!data) {
      return null;
    }
    const decoded = this.instructionCoder.decode(data, "base58");
    return decoded ? JSON.stringify(decoded) : null;
  }
}

function createTrustMeshIdl(address: string): Idl {
  return {
    address,
    metadata: {
      name: "trustmesh",
      version: "0.1.0",
      spec: "0.1.0",
      description: "TrustMesh coordination and audit program"
    },
    instructions: []
  };
}
