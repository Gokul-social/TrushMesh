use anchor_lang::prelude::*;
use anchor_lang::solana_program::{
    ed25519_program,
    instruction::Instruction,
    sysvar::instructions::{load_current_index_checked, load_instruction_at_checked},
};

declare_id!("66DXeSqBccWxWWw9S21vxe2Mvvqqkmw5KsK5jqA42quz");

const JOB_SEED: &[u8] = b"job";
const AGENT_SEED: &[u8] = b"agent";
const DELEGATION_SEED: &[u8] = b"delegation";

const TEMPLATE_PORTFOLIO_REBALANCER: u8 = 0;
const TEMPLATE_DAO_VOTER: u8 = 1;
const TEMPLATE_DATA_FETCHER: u8 = 2;

const JOB_STATUS_ACTIVE: u8 = 0;
const JOB_STATUS_COMPLETE: u8 = 1;
const JOB_STATUS_REVOKED: u8 = 2;

const AGENT_STATUS_ACTIVE: u8 = 0;
const AGENT_STATUS_WARNING: u8 = 1;
const AGENT_STATUS_REVOKED: u8 = 2;
const AGENT_STATUS_COMPLETE: u8 = 3;

const ED25519_SIGNATURE_COUNT_OFFSET: usize = 0;
const ED25519_PADDING_OFFSET: usize = 1;
const ED25519_OFFSETS_START: usize = 2;
const ED25519_OFFSETS_LEN: usize = 14;
const ED25519_PUBLIC_KEY_LEN: usize = 32;
const ED25519_SIGNATURE_LEN: usize = 64;

#[program]
pub mod trustmesh {
    use super::*;

    pub fn initialize_job(
        ctx: Context<InitializeJob>,
        job_id: [u8; 32],
        description_hash: [u8; 32],
        template: u8,
        budget_lamports: u64,
    ) -> Result<()> {
        require!(is_valid_template(template), TrustMeshError::InvalidTemplate);

        let now = Clock::get()?.unix_timestamp;
        let job = &mut ctx.accounts.job;
        job.owner = ctx.accounts.owner.key();
        job.job_id = job_id;
        job.description_hash = description_hash;
        job.template = template;
        job.budget_lamports = budget_lamports;
        job.status = JOB_STATUS_ACTIVE;
        job.agent_count = 0;
        job.created_at = now;
        job.bump = ctx.bumps.job;

        emit!(JobInitialized {
            job_id,
            owner: ctx.accounts.owner.key(),
            template,
            timestamp: now,
        });

        Ok(())
    }

    pub fn spawn_agent(
        ctx: Context<SpawnAgent>,
        sol_name_hash: [u8; 32],
        agent_type: u8,
        agent_wallet: Pubkey,
        parent_agent: Option<Pubkey>,
    ) -> Result<()> {
        let job = &mut ctx.accounts.job;
        require!(job.status == JOB_STATUS_ACTIVE, TrustMeshError::JobNotActive);

        if let Some(parent_agent_key) = parent_agent {
            let parent = ctx
                .accounts
                .parent_agent
                .as_ref()
                .ok_or(error!(TrustMeshError::AgentNotFound))?;

            require_keys_eq!(parent.key(), parent_agent_key, TrustMeshError::InvalidParentAgent);
            require_keys_eq!(parent.job, job.key(), TrustMeshError::InvalidParentAgent);
            require!(parent.status == AGENT_STATUS_ACTIVE, TrustMeshError::InvalidParentAgent);
        }

        let agent = &mut ctx.accounts.agent;
        agent.job = job.key();
        agent.owner = ctx.accounts.owner.key();
        agent.agent_wallet = agent_wallet;
        agent.sol_name_hash = sol_name_hash;
        agent.agent_type = agent_type;
        agent.status = AGENT_STATUS_ACTIVE;
        agent.parent_agent = parent_agent;
        agent.action_count = 0;
        agent.spawned_at = Clock::get()?.unix_timestamp;
        agent.revoked_at = None;
        agent.bump = ctx.bumps.agent;

        job.agent_count = job
            .agent_count
            .checked_add(1)
            .ok_or(error!(TrustMeshError::BudgetExceeded))?;

        emit!(AgentSpawned {
            job: job.key(),
            agent_wallet,
            sol_name_hash,
            agent_type,
            parent_agent,
        });

        Ok(())
    }

    pub fn log_delegation(
        ctx: Context<LogDelegation>,
        action_hash: [u8; 32],
        signature: [u8; 64],
        receiver_agent: Option<Pubkey>,
    ) -> Result<()> {
        let job = &ctx.accounts.job;
        require!(job.status == JOB_STATUS_ACTIVE, TrustMeshError::JobNotActive);

        let sender_agent = &mut ctx.accounts.sender_agent;
        require_keys_eq!(
            sender_agent.agent_wallet,
            ctx.accounts.sender.key(),
            TrustMeshError::UnauthorizedSigner
        );
        require_keys_eq!(sender_agent.job, job.key(), TrustMeshError::AgentNotFound);
        require!(
            sender_agent.status == AGENT_STATUS_ACTIVE,
            TrustMeshError::AgentNotActive
        );

        if let Some(receiver_agent_key) = receiver_agent {
            let receiver = ctx
                .accounts
                .receiver_agent
                .as_ref()
                .ok_or(error!(TrustMeshError::AgentNotFound))?;
            require_keys_eq!(receiver.key(), receiver_agent_key, TrustMeshError::AgentNotFound);
            require_keys_eq!(receiver.job, job.key(), TrustMeshError::AgentNotFound);
            require!(
                receiver.status == AGENT_STATUS_ACTIVE,
                TrustMeshError::AgentNotActive
            );
        }

        verify_ed25519_ix(
            &ctx.accounts.instructions,
            &ctx.accounts.sender.key().to_bytes(),
            &action_hash,
            &signature,
        )?;

        let now = Clock::get()?.unix_timestamp;
        let delegation_log = &mut ctx.accounts.delegation_log;
        delegation_log.job = job.key();
        delegation_log.sender_agent = sender_agent.key();
        delegation_log.receiver_agent = receiver_agent;
        delegation_log.action_hash = action_hash;
        delegation_log.signature = signature;
        delegation_log.verified = true;
        delegation_log.logged_at = now;
        delegation_log.bump = ctx.bumps.delegation_log;

        sender_agent.action_count = sender_agent
            .action_count
            .checked_add(1)
            .ok_or(error!(TrustMeshError::BudgetExceeded))?;

        emit!(DelegationLogged {
            job: job.key(),
            sender: sender_agent.key(),
            receiver: receiver_agent,
            action_hash,
            verified: true,
            logged_at: now,
        });

        Ok(())
    }

    pub fn revoke_agent(ctx: Context<RevokeAgent>, agent_to_revoke: Pubkey) -> Result<()> {
        let job = &ctx.accounts.job;
        require_keys_eq!(job.owner, ctx.accounts.owner.key(), TrustMeshError::UnauthorizedSigner);

        let agent = &mut ctx.accounts.agent;
        require_keys_eq!(agent.job, job.key(), TrustMeshError::AgentNotFound);
        require!(agent.status == AGENT_STATUS_ACTIVE, TrustMeshError::AgentNotActive);

        let now = Clock::get()?.unix_timestamp;
        agent.status = AGENT_STATUS_REVOKED;
        agent.revoked_at = Some(now);

        emit!(AgentRevoked {
            job: job.key(),
            agent_wallet: agent_to_revoke,
            revoked_at: now,
        });

        Ok(())
    }

    pub fn complete_job(ctx: Context<CompleteJob>) -> Result<()> {
        let job = &mut ctx.accounts.job;
        require!(job.status == JOB_STATUS_ACTIVE, TrustMeshError::JobNotActive);
        job.status = JOB_STATUS_COMPLETE;

        emit!(JobCompleted {
            job_id: job.job_id,
            owner: ctx.accounts.owner.key(),
        });

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(job_id: [u8; 32])]
pub struct InitializeJob<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(
        init,
        payer = owner,
        space = JobAccount::LEN,
        seeds = [JOB_SEED, owner.key().as_ref(), job_id.as_ref()],
        bump
    )]
    pub job: Account<'info, JobAccount>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(sol_name_hash: [u8; 32], agent_type: u8, agent_wallet: Pubkey, parent_agent: Option<Pubkey>)]
pub struct SpawnAgent<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(
        mut,
        seeds = [JOB_SEED, owner.key().as_ref(), job.job_id.as_ref()],
        bump = job.bump,
        has_one = owner @ TrustMeshError::UnauthorizedSigner
    )]
    pub job: Account<'info, JobAccount>,
    #[account(
        init,
        payer = owner,
        space = AgentAccount::LEN,
        seeds = [AGENT_SEED, job.key().as_ref(), agent_wallet.as_ref()],
        bump
    )]
    pub agent: Account<'info, AgentAccount>,
    pub parent_agent: Option<Account<'info, AgentAccount>>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(action_hash: [u8; 32], signature: [u8; 64], receiver_agent: Option<Pubkey>)]
pub struct LogDelegation<'info> {
    #[account(mut)]
    pub sender: Signer<'info>,
    #[account(
        seeds = [JOB_SEED, job.owner.as_ref(), job.job_id.as_ref()],
        bump = job.bump
    )]
    pub job: Account<'info, JobAccount>,
    #[account(
        mut,
        seeds = [AGENT_SEED, job.key().as_ref(), sender.key().as_ref()],
        bump = sender_agent.bump
    )]
    pub sender_agent: Account<'info, AgentAccount>,
    #[account(
        init,
        payer = sender,
        space = DelegationLogAccount::LEN,
        seeds = [DELEGATION_SEED, job.key().as_ref(), sender_agent.key().as_ref(), action_hash.as_ref()],
        bump
    )]
    pub delegation_log: Account<'info, DelegationLogAccount>,
    pub receiver_agent: Option<Account<'info, AgentAccount>>,
    #[account(address = anchor_lang::solana_program::sysvar::instructions::ID)]
    pub instructions: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(agent_to_revoke: Pubkey)]
pub struct RevokeAgent<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(
        seeds = [JOB_SEED, owner.key().as_ref(), job.job_id.as_ref()],
        bump = job.bump,
        has_one = owner @ TrustMeshError::UnauthorizedSigner
    )]
    pub job: Account<'info, JobAccount>,
    #[account(
        mut,
        seeds = [AGENT_SEED, job.key().as_ref(), agent_to_revoke.as_ref()],
        bump = agent.bump
    )]
    pub agent: Account<'info, AgentAccount>,
}

#[derive(Accounts)]
pub struct CompleteJob<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(
        mut,
        seeds = [JOB_SEED, owner.key().as_ref(), job.job_id.as_ref()],
        bump = job.bump,
        has_one = owner @ TrustMeshError::UnauthorizedSigner
    )]
    pub job: Account<'info, JobAccount>,
}

#[account]
pub struct JobAccount {
    pub owner: Pubkey,
    pub job_id: [u8; 32],
    pub description_hash: [u8; 32],
    pub template: u8,
    pub budget_lamports: u64,
    pub status: u8,
    pub agent_count: u16,
    pub created_at: i64,
    pub bump: u8,
}

impl JobAccount {
    pub const LEN: usize = 8 + 32 + 32 + 32 + 1 + 8 + 1 + 2 + 8 + 1;
}

#[account]
pub struct AgentAccount {
    pub job: Pubkey,
    pub owner: Pubkey,
    pub agent_wallet: Pubkey,
    pub sol_name_hash: [u8; 32],
    pub agent_type: u8,
    pub status: u8,
    pub parent_agent: Option<Pubkey>,
    pub action_count: u32,
    pub spawned_at: i64,
    pub revoked_at: Option<i64>,
    pub bump: u8,
}

impl AgentAccount {
    pub const LEN: usize = 8 + 32 + 32 + 32 + 32 + 1 + 1 + 1 + 32 + 4 + 8 + 1 + 8 + 1;
}

#[account]
pub struct DelegationLogAccount {
    pub job: Pubkey,
    pub sender_agent: Pubkey,
    pub receiver_agent: Option<Pubkey>,
    pub action_hash: [u8; 32],
    pub signature: [u8; 64],
    pub verified: bool,
    pub logged_at: i64,
    pub bump: u8,
}

impl DelegationLogAccount {
    pub const LEN: usize = 8 + 32 + 32 + 1 + 32 + 32 + 64 + 1 + 8 + 1;
}

#[event]
pub struct JobInitialized {
    pub job_id: [u8; 32],
    pub owner: Pubkey,
    pub template: u8,
    pub timestamp: i64,
}

#[event]
pub struct AgentSpawned {
    pub job: Pubkey,
    pub agent_wallet: Pubkey,
    pub sol_name_hash: [u8; 32],
    pub agent_type: u8,
    pub parent_agent: Option<Pubkey>,
}

#[event]
pub struct DelegationLogged {
    pub job: Pubkey,
    pub sender: Pubkey,
    pub receiver: Option<Pubkey>,
    pub action_hash: [u8; 32],
    pub verified: bool,
    pub logged_at: i64,
}

#[event]
pub struct AgentRevoked {
    pub job: Pubkey,
    pub agent_wallet: Pubkey,
    pub revoked_at: i64,
}

#[event]
pub struct JobCompleted {
    pub job_id: [u8; 32],
    pub owner: Pubkey,
}

#[error_code]
pub enum TrustMeshError {
    #[msg("Job is not active")]
    JobNotActive,
    #[msg("Agent is not active")]
    AgentNotActive,
    #[msg("Agent account was not found")]
    AgentNotFound,
    #[msg("Parent agent is invalid")]
    InvalidParentAgent,
    #[msg("Ed25519 signature verification failed")]
    SignatureVerificationFailed,
    #[msg("Signer is not authorized for this instruction")]
    UnauthorizedSigner,
    #[msg("Invalid job template")]
    InvalidTemplate,
    #[msg("Budget or counters exceeded allowed limits")]
    BudgetExceeded,
}

fn is_valid_template(template: u8) -> bool {
    matches!(
        template,
        TEMPLATE_PORTFOLIO_REBALANCER | TEMPLATE_DAO_VOTER | TEMPLATE_DATA_FETCHER
    )
}

fn verify_ed25519_ix(
    instructions_sysvar: &UncheckedAccount<'_>,
    expected_pubkey: &[u8; 32],
    expected_message: &[u8; 32],
    expected_signature: &[u8; 64],
) -> Result<()> {
    let current_index = load_current_index_checked(&instructions_sysvar.to_account_info())?;
    require!(current_index > 0, TrustMeshError::SignatureVerificationFailed);

    let ix = load_instruction_at_checked(
        (current_index - 1) as usize,
        &instructions_sysvar.to_account_info(),
    )?;

    validate_ed25519_ix(&ix, expected_pubkey, expected_message, expected_signature)
}

fn validate_ed25519_ix(
    instruction: &Instruction,
    expected_pubkey: &[u8; 32],
    expected_message: &[u8; 32],
    expected_signature: &[u8; 64],
) -> Result<()> {
    require_keys_eq!(
        instruction.program_id,
        ed25519_program::ID,
        TrustMeshError::SignatureVerificationFailed
    );
    require!(
        instruction.accounts.is_empty(),
        TrustMeshError::SignatureVerificationFailed
    );

    let data = instruction.data.as_slice();
    require!(
        data.len() >= ED25519_OFFSETS_START + ED25519_OFFSETS_LEN,
        TrustMeshError::SignatureVerificationFailed
    );
    require!(
        data[ED25519_SIGNATURE_COUNT_OFFSET] == 1,
        TrustMeshError::SignatureVerificationFailed
    );
    require!(
        data[ED25519_PADDING_OFFSET] == 0,
        TrustMeshError::SignatureVerificationFailed
    );

    let signature_offset = read_u16(data, ED25519_OFFSETS_START)? as usize;
    let signature_instruction_index = read_u16(data, ED25519_OFFSETS_START + 2)?;
    let public_key_offset = read_u16(data, ED25519_OFFSETS_START + 4)? as usize;
    let public_key_instruction_index = read_u16(data, ED25519_OFFSETS_START + 6)?;
    let message_data_offset = read_u16(data, ED25519_OFFSETS_START + 8)? as usize;
    let message_data_size = read_u16(data, ED25519_OFFSETS_START + 10)? as usize;
    let message_instruction_index = read_u16(data, ED25519_OFFSETS_START + 12)?;

    require!(
        signature_instruction_index == u16::MAX
            && public_key_instruction_index == u16::MAX
            && message_instruction_index == u16::MAX,
        TrustMeshError::SignatureVerificationFailed
    );

    let public_key_bytes = read_slice(data, public_key_offset, ED25519_PUBLIC_KEY_LEN)?;
    let signature_bytes = read_slice(data, signature_offset, ED25519_SIGNATURE_LEN)?;
    let message_bytes = read_slice(data, message_data_offset, message_data_size)?;

    require!(
        public_key_bytes == expected_pubkey,
        TrustMeshError::SignatureVerificationFailed
    );
    require!(
        signature_bytes == expected_signature,
        TrustMeshError::SignatureVerificationFailed
    );
    require!(
        message_bytes.len() == expected_message.len() && message_bytes == expected_message,
        TrustMeshError::SignatureVerificationFailed
    );

    Ok(())
}

fn read_u16(data: &[u8], offset: usize) -> Result<u16> {
    let bytes = read_slice(data, offset, 2)?;
    Ok(u16::from_le_bytes([bytes[0], bytes[1]]))
}

fn read_slice<'a>(data: &'a [u8], offset: usize, len: usize) -> Result<&'a [u8]> {
    data.get(offset..offset + len)
        .ok_or(error!(TrustMeshError::SignatureVerificationFailed))
}
