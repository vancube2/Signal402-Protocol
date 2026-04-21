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
