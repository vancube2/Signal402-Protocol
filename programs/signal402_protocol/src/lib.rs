//! Signal402 Trust Layer
//!
//! This program provides verifiable sports betting predictions on Solana.
//! It hashes predictions on-chain before matches begin, creating immutable proof
//! that can be verified after match completion.

use anchor_lang::prelude::*;
use anchor_lang::solana_program::hash::hash;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

/// Maximum commitment message length
pub const MAX_COMMITMENT_LEN: usize = 1024;
/// Prediction expiry window (48 hours)
pub const PREDICTION_EXPIRY: i64 = 48 * 60 * 60;
/// Minimum stake for predictions (0.01 SOL = 10_000_000 lamports)
pub const MINIMUM_STAKE: u64 = 10_000_000;
/// Platform fee basis points (2.5%)
pub const PLATFORM_FEE_BPS: u16 = 250;
/// Minimum oracle stake (0.1 SOL = 100_000_000 lamports)
pub const MINIMUM_ORACLE_STAKE: u64 = 100_000_000;
/// Slashing percentage for incorrect predictions (10%)
pub const SLASH_PERCENTAGE: u16 = 1000;

#[program]
pub mod signal402_protocol {
    use super::*;

    /// Initialize a new prediction commitment
    pub fn commit_prediction(
        ctx: Context<CommitPrediction>,
        commitment_hash: [u8; 32],
        match_id: String,
        expiry_timestamp: i64,
    ) -> Result<()> {
        let prediction = &mut ctx.accounts.prediction;
        let oracle = &ctx.accounts.oracle;
        let clock = Clock::get()?;

        require!(
            expiry_timestamp > clock.unix_timestamp,
            ErrorCode::InvalidExpiry
        );
        require!(
            expiry_timestamp <= clock.unix_timestamp + PREDICTION_EXPIRY,
            ErrorCode::ExpiryTooFar
        );

        prediction.oracle = oracle.key();
        prediction.commitment_hash = commitment_hash;
        prediction.match_id = match_id.clone();
        prediction.timestamp = clock.unix_timestamp;
        prediction.expiry_timestamp = expiry_timestamp;
        prediction.is_revealed = false;
        prediction.bump = ctx.bumps.prediction;

        emit!(PredictionCommitted {
            oracle: oracle.key(),
            match_id: match_id.clone(),
            commitment_hash,
            timestamp: prediction.timestamp,
        });

        Ok(())
    }

    /// Reveal a prediction after match completion
    pub fn reveal_prediction(
        ctx: Context<RevealPrediction>,
        prediction_data: String,
        nonce: u64,
    ) -> Result<()> {
        let prediction = &mut ctx.accounts.prediction;
        let clock = Clock::get()?;

        require!(
            clock.unix_timestamp >= prediction.expiry_timestamp,
            ErrorCode::PredictionNotExpired
        );
        require!(!prediction.is_revealed, ErrorCode::AlreadyRevealed);

        // Reconstruct the commitment
        let mut commitment_input = Vec::new();
        commitment_input.extend_from_slice(prediction_data.as_bytes());
        commitment_input.extend_from_slice(&nonce.to_le_bytes());
        commitment_input.extend_from_slice(&prediction.timestamp.to_le_bytes());

        let computed_hash = hash(&commitment_input);

        require!(
            computed_hash.to_bytes() == prediction.commitment_hash,
            ErrorCode::InvalidRevelation
        );

        prediction.is_revealed = true;
        prediction.revealed_data = Some(prediction_data.clone());

        emit!(PredictionRevealed {
            oracle: prediction.oracle,
            match_id: prediction.match_id.clone(),
            prediction_data,
            nonce,
            timestamp: clock.unix_timestamp,
        });

        Ok(())
    }

    /// Initialize the global protocol state
    pub fn initialize_protocol(ctx: Context<InitializeProtocol>) -> Result<()> {
        let protocol_state = &mut ctx.accounts.protocol_state;
        let authority = &ctx.accounts.authority;

        protocol_state.authority = authority.key();
        protocol_state.prediction_count = 0;
        protocol_state.verified_oracles = vec![];
        protocol_state.bump = ctx.bumps.protocol_state;

        emit!(ProtocolInitialized {
            authority: authority.key(),
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    /// Register a verified oracle
    pub fn register_oracle(ctx: Context<RegisterOracle>, oracle_pubkey: Pubkey) -> Result<()> {
        let protocol_state = &mut ctx.accounts.protocol_state;
        let authority = &ctx.accounts.authority;

        require!(
            authority.key() == protocol_state.authority,
            ErrorCode::Unauthorized
        );
        require!(
            !protocol_state.verified_oracles.contains(&oracle_pubkey),
            ErrorCode::OracleAlreadyRegistered
        );

        protocol_state.verified_oracles.push(oracle_pubkey);

        emit!(OracleRegistered {
            oracle: oracle_pubkey,
            registered_by: authority.key(),
        });

        Ok(())
    }

    /// Verify a prediction using the Trust Layer
    pub fn verify_prediction(
        ctx: Context<VerifyPrediction>,
        prediction_data: String,
        nonce: u64,
    ) -> Result<bool> {
        let prediction = &ctx.accounts.prediction;

        require!(prediction.is_revealed, ErrorCode::NotYetRevealed);

        let mut commitment_input = Vec::new();
        commitment_input.extend_from_slice(prediction_data.as_bytes());
        commitment_input.extend_from_slice(&nonce.to_le_bytes());
        commitment_input.extend_from_slice(&prediction.timestamp.to_le_bytes());

        let computed_hash = hash(&commitment_input);
        let is_valid = computed_hash.to_bytes() == prediction.commitment_hash;

        emit!(PredictionVerified {
            oracle: prediction.oracle,
            match_id: prediction.match_id.clone(),
            is_valid,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(is_valid)
    }

    /// Initialize a payment vault for an oracle (x402 integration)
    pub fn initialize_vault(ctx: Context<InitializeVault>) -> Result<()> {
        let vault = &mut ctx.accounts.payment_vault;
        let oracle = &ctx.accounts.oracle;
        let authority = &ctx.accounts.authority;

        vault.oracle = oracle.key();
        vault.authority = authority.key();
        vault.balance = 0;
        vault.total_streamed = 0;
        vault.is_active = true;
        vault.bump = ctx.bumps.payment_vault;

        emit!(VaultInitialized {
            oracle: oracle.key(),
            authority: authority.key(),
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    /// Deposit funds into the payment vault
    pub fn deposit_to_vault(ctx: Context<DepositToVault>, amount: u64) -> Result<()> {
        let vault = &mut ctx.accounts.payment_vault;

        require!(amount > 0, ErrorCode::InvalidAmount);
        require!(vault.is_active, ErrorCode::VaultInactive);

        // Transfer lamports from depositor to vault
        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.depositor.to_account_info(),
                to: vault.to_account_info(),
            },
        );
        anchor_lang::system_program::transfer(cpi_context, amount)?;

        vault.balance = vault.balance.checked_add(amount).unwrap();

        emit!(VaultDeposit {
            vault: vault.key(),
            depositor: ctx.accounts.depositor.key(),
            amount,
            new_balance: vault.balance,
        });

        Ok(())
    }

    /// Stream payment for a verified prediction (x402 style micropayment)
    pub fn stream_payment(ctx: Context<StreamPayment>, amount: u64) -> Result<()> {
        let vault = &mut ctx.accounts.payment_vault;
        let prediction = &ctx.accounts.prediction;
        let recipient = &ctx.accounts.recipient;

        require!(vault.is_active, ErrorCode::VaultInactive);
        require!(prediction.is_revealed, ErrorCode::NotYetRevealed);
        require!(vault.balance >= amount, ErrorCode::InsufficientFunds);
        require!(
            recipient.key() == prediction.oracle || recipient.key() == vault.authority,
            ErrorCode::UnauthorizedRecipient
        );

        // Calculate platform fee
        let fee = amount.checked_mul(PLATFORM_FEE_BPS as u64).unwrap()
            .checked_div(10000).unwrap();
        let net_amount = amount.checked_sub(fee).unwrap();

        // Update vault state
        vault.balance = vault.balance.checked_sub(amount).unwrap();
        vault.total_streamed = vault.total_streamed.checked_add(amount).unwrap();

        // Transfer net amount to recipient
        **vault.to_account_info().try_borrow_mut_lamports()? -= net_amount;
        **recipient.to_account_info().try_borrow_mut_lamports()? += net_amount;

        // Transfer fee to protocol authority
        if fee > 0 {
            let protocol_state = &ctx.accounts.protocol_state;
            // Note: In production, you'd transfer to a dedicated fee vault
            // For now, we keep the fee in the vault for distribution
            vault.balance = vault.balance.checked_add(fee).unwrap();
        }

        emit!(PaymentStreamed {
            vault: vault.key(),
            recipient: recipient.key(),
            amount: net_amount,
            fee,
            prediction_match_id: prediction.match_id.clone(),
        });

        Ok(())
    }

    /// Initialize oracle staking account
    pub fn initialize_oracle_stake(ctx: Context<OracleStakeAccount>) -> Result<()> {
        let stake_account = &mut ctx.accounts.stake_account;
        let oracle = &ctx.accounts.oracle;

        stake_account.oracle = oracle.key();
        stake_account.staked_amount = 0;
        stake_account.total_predictions = 0;
        stake_account.correct_predictions = 0;
        stake_account.accuracy_score = 0;
        stake_account.is_slashed = false;
        stake_account.slash_count = 0;
        stake_account.last_prediction_timestamp = 0;
        stake_account.bump = ctx.bumps.stake_account;

        emit!(OracleStakeInitialized {
            oracle: oracle.key(),
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    /// Add stake to oracle account
    pub fn add_stake(ctx: Context<AddStake>, amount: u64) -> Result<()> {
        let stake_account = &mut ctx.accounts.stake_account;

        require!(!stake_account.is_slashed, ErrorCode::OracleSlashed);
        require!(amount > 0, ErrorCode::InvalidAmount);

        // Transfer lamports to the stake account
        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.oracle.to_account_info(),
                to: stake_account.to_account_info(),
            },
        );
        anchor_lang::system_program::transfer(cpi_context, amount)?;

        stake_account.staked_amount = stake_account.staked_amount.checked_add(amount).unwrap();

        emit!(StakeAdded {
            oracle: stake_account.oracle,
            amount,
            new_total: stake_account.staked_amount,
        });

        Ok(())
    }

    /// Remove stake from oracle account
    pub fn remove_stake(ctx: Context<AddStake>, amount: u64) -> Result<()> {
        let stake_account = &mut ctx.accounts.stake_account;

        require!(amount <= stake_account.staked_amount, ErrorCode::InsufficientStake);

        // After removal, must maintain minimum stake if they have predictions
        let remaining = stake_account.staked_amount.checked_sub(amount).unwrap();
        if stake_account.total_predictions > 0 {
            require!(remaining >= MINIMUM_ORACLE_STAKE, ErrorCode::MinimumStakeRequired);
        }

        // Transfer lamports back to oracle
        **stake_account.to_account_info().try_borrow_mut_lamports()? -= amount;
        **ctx.accounts.oracle.to_account_info().try_borrow_mut_lamports()? += amount;

        stake_account.staked_amount = remaining;

        emit!(StakeRemoved {
            oracle: stake_account.oracle,
            amount,
            remaining,
        });

        Ok(())
    }

    /// Update oracle accuracy after verified prediction
    pub fn update_oracle_accuracy(
        ctx: Context<UpdateAccuracy>,
        was_correct: bool,
    ) -> Result<()> {
        let stake_account = &mut ctx.accounts.stake_account;
        let protocol_state = &ctx.accounts.protocol_state;

        require!(
            ctx.accounts.authority.key() == protocol_state.authority,
            ErrorCode::Unauthorized
        );

        // Update prediction counts
        stake_account.total_predictions = stake_account.total_predictions.checked_add(1).unwrap();
        if was_correct {
            stake_account.correct_predictions = stake_account.correct_predictions.checked_add(1).unwrap();
        }

        // Recalculate accuracy score (basis points)
        stake_account.accuracy_score = ((stake_account.correct_predictions as u128)
            .checked_mul(10000).unwrap()
            .checked_div(stake_account.total_predictions as u128).unwrap()) as u16;

        emit!(AccuracyUpdated {
            oracle: stake_account.oracle,
            total_predictions: stake_account.total_predictions,
            correct_predictions: stake_account.correct_predictions,
            accuracy_score: stake_account.accuracy_score,
            was_correct,
        });

        Ok(())
    }

    /// Slash oracle stake for incorrect predictions
    pub fn slash_oracle(ctx: Context<SlashOracle>, amount: u64) -> Result<()> {
        let stake_account = &mut ctx.accounts.stake_account;
        let protocol_state = &ctx.accounts.protocol_state;
        let prediction = &ctx.accounts.prediction;

        require!(
            ctx.accounts.authority.key() == protocol_state.authority,
            ErrorCode::Unauthorized
        );
        require!(
            prediction.oracle == stake_account.oracle,
            ErrorCode::Unauthorized
        );
        require!(amount <= stake_account.staked_amount, ErrorCode::InsufficientStake);

        // Calculate slash amount (capped at percentage of stake)
        let slash_amount = amount.min(
            stake_account.staked_amount
                .checked_mul(SLASH_PERCENTAGE as u64).unwrap()
                .checked_div(10000).unwrap()
        );

        // Transfer slashed amount to protocol authority
        **stake_account.to_account_info().try_borrow_mut_lamports()? -= slash_amount;
        // In production, this would go to a treasury or insurance fund
        // For now, burn by not transferring

        stake_account.staked_amount = stake_account.staked_amount.checked_sub(slash_amount).unwrap();
        stake_account.slash_count = stake_account.slash_count.checked_add(1).unwrap();

        if stake_account.slash_count >= 3 {
            stake_account.is_slashed = true;
        }

        emit!(OracleSlashed {
            oracle: stake_account.oracle,
            slashed_amount: slash_amount,
            remaining_stake: stake_account.staked_amount,
            slash_count: stake_account.slash_count,
            is_slashed: stake_account.is_slashed,
        });

        Ok(())
    }
}

/// Accounts for committing a prediction
#[derive(Accounts)]
#[instruction(commitment_hash: [u8; 32], match_id: String)]
pub struct CommitPrediction<'info> {
    #[account(
        init,
        payer = oracle,
        space = 8 + Prediction::SIZE,
        seeds = [
            b"prediction",
            oracle.key().as_ref(),
            match_id.as_bytes(),
            &Clock::get()?.unix_timestamp.to_le_bytes()
        ],
        bump
    )]
    pub prediction: Account<'info, Prediction>,
    #[account(mut)]
    pub oracle: Signer<'info>,
    pub system_program: Program<'info, System>,
}

/// Accounts for revealing a prediction
#[derive(Accounts)]
pub struct RevealPrediction<'info> {
    #[account(
        mut,
        seeds = [
            b"prediction",
            prediction.oracle.as_ref(),
            prediction.match_id.as_bytes(),
            &prediction.timestamp.to_le_bytes()
        ],
        bump = prediction.bump,
        has_one = oracle
    )]
    pub prediction: Account<'info, Prediction>,
    pub oracle: Signer<'info>,
}

/// Accounts for initializing the protocol
#[derive(Accounts)]
pub struct InitializeProtocol<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + ProtocolState::SIZE,
        seeds = [b"protocol_state"],
        bump
    )]
    pub protocol_state: Account<'info, ProtocolState>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

/// Accounts for registering an oracle
#[derive(Accounts)]
pub struct RegisterOracle<'info> {
    #[account(
        mut,
        seeds = [b"protocol_state"],
        bump = protocol_state.bump,
    )]
    pub protocol_state: Account<'info, ProtocolState>,
    pub authority: Signer<'info>,
}

/// Accounts for oracle staking
#[derive(Accounts)]
pub struct OracleStakeAccount<'info> {
    #[account(
        init,
        payer = oracle,
        space = 8 + OracleStake::SIZE,
        seeds = [b"oracle_stake", oracle.key().as_ref()],
        bump
    )]
    pub stake_account: Account<'info, OracleStake>,
    #[account(mut)]
    pub oracle: Signer<'info>,
    pub system_program: Program<'info, System>,
}

/// Accounts for adding stake
#[derive(Accounts)]
pub struct AddStake<'info> {
    #[account(
        mut,
        seeds = [b"oracle_stake", oracle.key().as_ref()],
        bump = stake_account.bump,
        has_one = oracle
    )]
    pub stake_account: Account<'info, OracleStake>,
    #[account(mut)]
    pub oracle: Signer<'info>,
    pub system_program: Program<'info, System>,
}

/// Accounts for slashing oracle stake
#[derive(Accounts)]
pub struct SlashOracle<'info> {
    #[account(
        mut,
        seeds = [b"oracle_stake", stake_account.oracle.as_ref()],
        bump = stake_account.bump,
    )]
    pub stake_account: Account<'info, OracleStake>,
    #[account(
        mut,
        seeds = [b"protocol_state"],
        bump = protocol_state.bump,
    )]
    pub protocol_state: Account<'info, ProtocolState>,
    #[account(
        mut,
        seeds = [
            b"prediction",
            prediction.oracle.as_ref(),
            prediction.match_id.as_bytes(),
            &prediction.timestamp.to_le_bytes()
        ],
        bump = prediction.bump,
    )]
    pub prediction: Account<'info, Prediction>,
    pub authority: Signer<'info>,
}

/// Accounts for updating accuracy
#[derive(Accounts)]
pub struct UpdateAccuracy<'info> {
    #[account(
        mut,
        seeds = [b"oracle_stake", oracle.key().as_ref()],
        bump = stake_account.bump,
    )]
    pub stake_account: Account<'info, OracleStake>,
    pub oracle: SystemAccount<'info>,
    #[account(
        mut,
        seeds = [b"protocol_state"],
        bump = protocol_state.bump,
    )]
    pub protocol_state: Account<'info, ProtocolState>,
    pub authority: Signer<'info>,
}

/// Accounts for verifying a prediction
#[derive(Accounts)]
pub struct VerifyPrediction<'info> {
    #[account(
        seeds = [
            b"prediction",
            prediction.oracle.as_ref(),
            prediction.match_id.as_bytes(),
            &prediction.timestamp.to_le_bytes()
        ],
        bump = prediction.bump,
    )]
    pub prediction: Account<'info, Prediction>,
}

/// Accounts for initializing payment vault
#[derive(Accounts)]
pub struct InitializeVault<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + PaymentVault::SIZE,
        seeds = [b"payment_vault", oracle.key().as_ref()],
        bump
    )]
    pub payment_vault: Account<'info, PaymentVault>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub oracle: SystemAccount<'info>,
    pub system_program: Program<'info, System>,
}

/// Accounts for depositing to vault
#[derive(Accounts)]
pub struct DepositToVault<'info> {
    #[account(
        mut,
        seeds = [b"payment_vault", payment_vault.oracle.as_ref()],
        bump = payment_vault.bump,
    )]
    pub payment_vault: Account<'info, PaymentVault>,
    #[account(mut)]
    pub depositor: Signer<'info>,
    pub system_program: Program<'info, System>,
}

/// Accounts for streaming payment
#[derive(Accounts)]
pub struct StreamPayment<'info> {
    #[account(
        mut,
        seeds = [b"payment_vault", payment_vault.oracle.as_ref()],
        bump = payment_vault.bump,
    )]
    pub payment_vault: Account<'info, PaymentVault>,
    #[account(
        mut,
        seeds = [
            b"prediction",
            prediction.oracle.as_ref(),
            prediction.match_id.as_bytes(),
            &prediction.timestamp.to_le_bytes()
        ],
        bump = prediction.bump,
    )]
    pub prediction: Account<'info, Prediction>,
    #[account(mut)]
    pub recipient: SystemAccount<'info>,
    pub protocol_state: Account<'info, ProtocolState>,
}

/// Payment vault for x402 micropayments
#[account]
pub struct PaymentVault {
    pub oracle: Pubkey,
    pub authority: Pubkey,
    pub balance: u64,
    pub total_streamed: u64,
    pub is_active: bool,
    pub bump: u8,
}

impl PaymentVault {
    pub const SIZE: usize = 32 + 32 + 8 + 8 + 1 + 1;
}

/// Prediction account storing the commitment
#[account]
pub struct Prediction {
    pub oracle: Pubkey,
    pub commitment_hash: [u8; 32],
    pub match_id: String,
    pub timestamp: i64,
    pub expiry_timestamp: i64,
    pub is_revealed: bool,
    pub revealed_data: Option<String>,
    pub bump: u8,
}

impl Prediction {
    pub const SIZE: usize = 32 + 32 + 68 + 8 + 8 + 1 + 517 + 1;
}

/// Global protocol state
#[account]
pub struct ProtocolState {
    pub authority: Pubkey,
    pub prediction_count: u64,
    pub verified_oracles: Vec<Pubkey>,
    pub bump: u8,
}

impl ProtocolState {
    pub const SIZE: usize = 32 + 8 + 3204 + 1;
}

/// Oracle staking account for reputation
#[account]
pub struct OracleStake {
    pub oracle: Pubkey,
    pub staked_amount: u64,
    pub total_predictions: u64,
    pub correct_predictions: u64,
    pub accuracy_score: u16, // Basis points (0-10000)
    pub is_slashed: bool,
    pub slash_count: u8,
    pub last_prediction_timestamp: i64,
    pub bump: u8,
}

impl OracleStake {
    pub const SIZE: usize = 32 + 8 + 8 + 8 + 2 + 1 + 1 + 8 + 1;
}

/// Custom error codes
#[error_code]
pub enum ErrorCode {
    #[msg("Prediction expiry must be in the future")]
    InvalidExpiry,
    #[msg("Prediction expiry too far in the future")]
    ExpiryTooFar,
    #[msg("Prediction has not yet expired")]
    PredictionNotExpired,
    #[msg("Prediction already revealed")]
    AlreadyRevealed,
    #[msg("Invalid revelation - hash mismatch")]
    InvalidRevelation,
    #[msg("Prediction not yet revealed")]
    NotYetRevealed,
    #[msg("Unauthorized action")]
    Unauthorized,
    #[msg("Oracle already registered")]
    OracleAlreadyRegistered,
    #[msg("Invalid amount")]
    InvalidAmount,
    #[msg("Payment vault is inactive")]
    VaultInactive,
    #[msg("Insufficient funds in vault")]
    InsufficientFunds,
    #[msg("Unauthorized recipient")]
    UnauthorizedRecipient,
    #[msg("Oracle has been slashed")]
    OracleSlashed,
    #[msg("Insufficient stake")]
    InsufficientStake,
    #[msg("Minimum stake required")]
    MinimumStakeRequired,
}

/// Events
#[event]
pub struct PredictionCommitted {
    pub oracle: Pubkey,
    pub match_id: String,
    pub commitment_hash: [u8; 32],
    pub timestamp: i64,
}

#[event]
pub struct PredictionRevealed {
    pub oracle: Pubkey,
    pub match_id: String,
    pub prediction_data: String,
    pub nonce: u64,
    pub timestamp: i64,
}

#[event]
pub struct ProtocolInitialized {
    pub authority: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct OracleRegistered {
    pub oracle: Pubkey,
    pub registered_by: Pubkey,
}

#[event]
pub struct PredictionVerified {
    pub oracle: Pubkey,
    pub match_id: String,
    pub is_valid: bool,
    pub timestamp: i64,
}

#[event]
pub struct VaultInitialized {
    pub oracle: Pubkey,
    pub authority: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct VaultDeposit {
    pub vault: Pubkey,
    pub depositor: Pubkey,
    pub amount: u64,
    pub new_balance: u64,
}

#[event]
pub struct PaymentStreamed {
    pub vault: Pubkey,
    pub recipient: Pubkey,
    pub amount: u64,
    pub fee: u64,
    pub prediction_match_id: String,
}

#[event]
pub struct OracleStakeInitialized {
    pub oracle: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct StakeAdded {
    pub oracle: Pubkey,
    pub amount: u64,
    pub new_total: u64,
}

#[event]
pub struct StakeRemoved {
    pub oracle: Pubkey,
    pub amount: u64,
    pub remaining: u64,
}

#[event]
pub struct AccuracyUpdated {
    pub oracle: Pubkey,
    pub total_predictions: u64,
    pub correct_predictions: u64,
    pub accuracy_score: u16,
    pub was_correct: bool,
}

#[event]
pub struct OracleSlashed {
    pub oracle: Pubkey,
    pub slashed_amount: u64,
    pub remaining_stake: u64,
    pub slash_count: u8,
    pub is_slashed: bool,
}
