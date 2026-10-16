//! Silo: pump.fun creator fees held in a vault that only a Winternitz one-time
//! signature over SHA-256 can open. No ed25519 key controls the vault.
//!
//! The hashing and message layout mirror src/lib/wots.ts so browser signatures
//! verify here byte for byte.

use anchor_lang::prelude::*;
use anchor_lang::solana_program::hash::hashv;

declare_id!("S1LoqVau1tPq9xW3mZ7bHn4cRk2eYd8uTf6gJsA5LvN");

pub const N: usize = 28; // bytes per chain value (224 bits)
pub const MSG_DIGITS: usize = 28;
pub const CHAINS: usize = 30; // 28 message + 2 checksum
pub const W: u16 = 256;
pub const SIG_BYTES: usize = CHAINS * N; // 840
pub const MAX_VERIFY_STEPS: u32 = 3_600;

#[program]
pub mod silo {
    use super::*;

    /// Create a silo committed to the hash of one-time key #0. Called once,
    /// before the creator points pump.fun's fee sharing at this PDA.
    pub fn open_silo(ctx: Context<OpenSilo>, first_key_hash: [u8; 32]) -> Result<()> {
        let s = &mut ctx.accounts.silo;
        s.first_key_hash = first_key_hash;
        s.key_hash = first_key_hash;
        s.key_index = 0;
        s.pending = None;
        s.bump = ctx.bumps.silo;
        Ok(())
    }

    /// Verify a WOTS signature over `action`, rotate to the next key, and queue
    /// the action. Permissionless: the signature is the authority.
    pub fn authorize(ctx: Context<Authorize>, sig: Vec<u8>, action: Action, salt: u32) -> Result<()> {
        require!(sig.len() == SIG_BYTES, SiloError::BadSignatureLength);
        let s = &mut ctx.accounts.silo;
        require!(s.pending.is_none(), SiloError::ActionPending);
        require!(action.key_index == s.key_index, SiloError::WrongKey);

        let msg = encode(&crate::ID, &s.key(), &action, salt);
        let digits = digits(&msg);
        let steps: u32 = digits.iter().map(|d| (W - 1 - *d as u16) as u32).sum();
        require!(steps <= MAX_VERIFY_STEPS, SiloError::TooMuchWork);

        let mut pk = [[0u8; N]; CHAINS];
        for j in 0..CHAINS {
            let mut v = [0u8; N];
            v.copy_from_slice(&sig[j * N..(j + 1) * N]);
            pk[j] = walk(v, j as u8, digits[j], (W - 1 - digits[j] as u16) as u8);
        }
        let refs: Vec<&[u8]> = pk.iter().map(|p| p.as_slice()).collect();
        require!(hashv(&refs).to_bytes() == s.key_hash, SiloError::InvalidSignature);

        // One-time key: retire it before anything moves.
        s.key_hash = action.next_key_hash;
        s.key_index = s.key_index.checked_add(1).unwrap();
        s.pending = Some(action);
        Ok(())
    }

    /// Pay out exactly what `authorize` approved. Anyone can call it.
    pub fn execute_sol(ctx: Context<ExecuteSol>) -> Result<()> {
        let s = &mut ctx.accounts.silo;
        let a = s.pending.take().ok_or(SiloError::NothingPending)?;
        require!(a.kind == Kind::Sol, SiloError::WrongKind);
        require_keys_eq!(a.destination, ctx.accounts.destination.key(), SiloError::WrongDestination);

        let rent = Rent::get()?.minimum_balance(8 + Silo::INIT_SPACE);
        let free = s.to_account_info().lamports().saturating_sub(rent);
        let amount = if a.amount == u64::MAX { free } else { a.amount };
        require!(amount <= free, SiloError::Insufficient);

        // The silo is program-owned, so lamports move directly.
        **s.to_account_info().try_borrow_mut_lamports()? -= amount;
        **ctx.accounts.destination.try_borrow_mut_lamports()? += amount;
        s.total_out = s.total_out.saturating_add(amount);
        Ok(())
    }

    // TODO execute_token: same shape, transfers SPL quote tokens (non-SOL pairs)
    // from the silo's ATA with invoke_signed.
}

// ---------------------------------------------------------------- WOTS

fn step(x: &[u8; N], j: u8, k: u8) -> [u8; N] {
    let h = hashv(&[&[j, k], x]).to_bytes();
    let mut o = [0u8; N];
    o.copy_from_slice(&h[..N]);
    o
}

fn walk(mut v: [u8; N], j: u8, from: u8, steps: u8) -> [u8; N] {
    for k in 0..steps as u16 {
        v = step(&v, j, (from as u16 + k) as u8);
    }
    v
}

fn digits(msg: &[u8]) -> [u8; CHAINS] {
    let h = hashv(&[msg]).to_bytes();
    let mut d = [0u8; CHAINS];
    d[..MSG_DIGITS].copy_from_slice(&h[..MSG_DIGITS]);
    let csum: u16 = d[..MSG_DIGITS].iter().map(|x| (W - 1 - *x as u16)).sum();
    d[28] = (csum >> 8) as u8;
    d[29] = (csum & 0xff) as u8;
    d
}

/// Must match encodeWithdrawal() in src/lib/wots.ts. Pubkeys are signed as
/// base58 strings so the browser can build the message without a decoder;
/// switch both sides to raw 32 bytes to save compute.
fn encode(program: &Pubkey, silo: &Pubkey, a: &Action, salt: u32) -> Vec<u8> {
    let mut m = b"silo/withdraw/v1".to_vec();
    m.extend(program.to_string().as_bytes());
    m.extend(silo.to_string().as_bytes());
    m.extend(a.key_index.to_le_bytes());
    m.push(if a.kind == Kind::Sol { 0 } else { 1 });
    m.extend(a.mint.to_string().as_bytes());
    m.extend(a.amount.to_le_bytes());
    m.extend(a.destination.to_string().as_bytes());
    m.extend(a.next_key_hash);
    m.extend(salt.to_le_bytes());
    m
}

// ---------------------------------------------------------------- state

#[account]
#[derive(InitSpace)]
pub struct Silo {
    pub first_key_hash: [u8; 32],
    pub key_hash: [u8; 32],
    pub key_index: u32,
    pub pending: Option<Action>,
    pub total_out: u64,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, InitSpace)]
pub enum Kind {
    Sol,
    Token,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct Action {
    pub key_index: u32,
    pub kind: Kind,
    pub mint: Pubkey,
    pub amount: u64, // u64::MAX = everything above rent
    pub destination: Pubkey,
    pub next_key_hash: [u8; 32],
}

#[derive(Accounts)]
#[instruction(first_key_hash: [u8; 32])]
pub struct OpenSilo<'info> {
    #[account(init, payer = payer, space = 8 + Silo::INIT_SPACE, seeds = [b"silo", first_key_hash.as_ref()], bump)]
    pub silo: Account<'info, Silo>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Authorize<'info> {
    #[account(mut, seeds = [b"silo", silo.first_key_hash.as_ref()], bump = silo.bump)]
    pub silo: Account<'info, Silo>,
}

#[derive(Accounts)]
pub struct ExecuteSol<'info> {
    #[account(mut, seeds = [b"silo", silo.first_key_hash.as_ref()], bump = silo.bump)]
    pub silo: Account<'info, Silo>,
    /// CHECK: must equal the signed destination.
    #[account(mut)]
    pub destination: UncheckedAccount<'info>,
}

#[error_code]
pub enum SiloError {
    #[msg("signature must be 840 bytes")]
    BadSignatureLength,
    #[msg("an approved action is waiting to execute")]
    ActionPending,
    #[msg("signed with the wrong key number")]
    WrongKey,
    #[msg("salt too weak: verifier work over budget")]
    TooMuchWork,
    #[msg("signature does not match the silo's current key")]
    InvalidSignature,
    #[msg("nothing approved")]
    NothingPending,
    #[msg("action kind mismatch")]
    WrongKind,
    #[msg("destination does not match the signature")]
    WrongDestination,
    #[msg("not enough above rent")]
    Insufficient,
}
