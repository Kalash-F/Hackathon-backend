use anchor_lang::prelude::*;
use anchor_lang::solana_program::{
    instruction::{AccountMeta, Instruction},
    program::invoke,
};
use anchor_spl::token::{self, Transfer};

use crate::state::accounts::FlashLoanAndArbitrage;
use crate::state::errors::FlashLoanArbitrageError;

// Constants for minimum profit threshold and fees
const MIN_PROFIT_THRESHOLD: u64 = 1000; // Minimum profit in base units
const FLASH_LOAN_FEE_BPS: u64 = 30; // 0.3% in basis points
const BPS_DIVISOR: u64 = 10000;

pub fn process_flash_loan_and_arbitrage(
    ctx: Context<FlashLoanAndArbitrage>,
    loan_amount: u64,
    min_profit_amount: u64,
) -> Result<()> {
    // Validate inputs
    require!(loan_amount > 0, FlashLoanArbitrageError::InvalidLoanAmount);
    require!(
        min_profit_amount >= MIN_PROFIT_THRESHOLD,
        FlashLoanArbitrageError::InsufficientProfit
    );

    // Record initial balance
    let initial_balance = ctx.accounts.loan_token_account.amount;
    msg!("Initial balance: {}", initial_balance);

    // Step 1: Initiate flash loan
    initiate_flash_loan(&ctx, loan_amount)?;

    // Step 2: Execute swap on DEX A
    execute_dex_a_swap(&ctx, loan_amount)?;

    // Step 3: Execute swap on DEX B
    let intermediate_amount = ctx.accounts.dex_a_output_token_account.amount;
    execute_dex_b_swap(&ctx, intermediate_amount)?;

    // Step 4: Repay flash loan
    let repayment_amount = calculate_loan_repayment(loan_amount)?;
    repay_flash_loan(&ctx, repayment_amount)?;

    // Step 5: Verify profit
    let final_balance = ctx.accounts.loan_token_account.amount;
    let profit = final_balance
        .checked_sub(initial_balance)
        .ok_or(FlashLoanArbitrageError::MathOverflow)?;
    
    require!(
        profit >= min_profit_amount,
        FlashLoanArbitrageError::InsufficientProfit
    );

    Ok(())
}

/// Helper function to initiate a flash loan from the lending protocol
fn initiate_flash_loan(ctx: &Context<FlashLoanAndArbitrage>, amount: u64) -> Result<()> {
    // Example instruction data for flash loan initialization
    let mut data = Vec::with_capacity(9);
    data.push(0); // Instruction code for flash loan
    data.extend_from_slice(&amount.to_le_bytes());
    
    // Create accounts list for the instruction
    let accounts = &[
        ctx.accounts.loan_reserve_account.to_account_info(),
        ctx.accounts.loan_token_account.to_account_info(),
        ctx.accounts.base.token_program.to_account_info(),
        ctx.accounts.lending_fee_account.to_account_info(),
        ctx.accounts.base.authority.to_account_info(),
    ];
    
    // Create the instruction
    let ix = Instruction {
        program_id: ctx.accounts.lending_program.key(),
        accounts: vec![
            AccountMeta::new(ctx.accounts.loan_reserve_account.key(), false),
            AccountMeta::new(ctx.accounts.loan_token_account.key(), false),
            AccountMeta::new_readonly(ctx.accounts.base.token_program.key(), false),
            AccountMeta::new(ctx.accounts.lending_fee_account.key(), false),
            AccountMeta::new_readonly(ctx.accounts.base.authority.key(), true),
        ],
        data,
    };
    
    // Invoke the instruction
    invoke(&ix, accounts).map_err(|_| FlashLoanArbitrageError::FlashLoanInitFailed.into())
}

/// Helper function to execute a swap on DEX A
fn execute_dex_a_swap(ctx: &Context<FlashLoanAndArbitrage>, amount: u64) -> Result<()> {
    // Example instruction data for DEX A swap
    let mut data = Vec::with_capacity(9);
    data.push(1); // Instruction code for swap
    data.extend_from_slice(&amount.to_le_bytes());
    
    // Create accounts list for the instruction
    let accounts = &[
        ctx.accounts.dex_a_pool.to_account_info(),
        ctx.accounts.dex_a_authority.to_account_info(),
        ctx.accounts.base.authority.to_account_info(),
        ctx.accounts.dex_a_input_token_account.to_account_info(),
        ctx.accounts.dex_a_output_token_account.to_account_info(),
        ctx.accounts.dex_a_token_a_account.to_account_info(),
        ctx.accounts.dex_a_token_b_account.to_account_info(),
        ctx.accounts.base.token_program.to_account_info(),
    ];
    
    // Create the instruction
    let ix = Instruction {
        program_id: ctx.accounts.dex_a_program.key(),
        accounts: vec![
            AccountMeta::new(ctx.accounts.dex_a_pool.key(), false),
            AccountMeta::new_readonly(ctx.accounts.dex_a_authority.key(), false),
            AccountMeta::new_readonly(ctx.accounts.base.authority.key(), true),
            AccountMeta::new(ctx.accounts.dex_a_input_token_account.key(), false),
            AccountMeta::new(ctx.accounts.dex_a_output_token_account.key(), false),
            AccountMeta::new(ctx.accounts.dex_a_token_a_account.key(), false),
            AccountMeta::new(ctx.accounts.dex_a_token_b_account.key(), false),
            AccountMeta::new_readonly(ctx.accounts.base.token_program.key(), false),
        ],
        data,
    };
    
    // Invoke the instruction
    invoke(&ix, accounts).map_err(|_| FlashLoanArbitrageError::DexSwapFailed.into())
}

/// Helper function to execute a swap on DEX B
fn execute_dex_b_swap(ctx: &Context<FlashLoanAndArbitrage>, amount: u64) -> Result<()> {
    // Example instruction data for DEX B swap
    let mut data = Vec::with_capacity(9);
    data.push(1); // Instruction code for swap
    data.extend_from_slice(&amount.to_le_bytes());
    
    // Create accounts list for the instruction
    let accounts = &[
        ctx.accounts.dex_b_pool.to_account_info(),
        ctx.accounts.dex_b_authority.to_account_info(),
        ctx.accounts.base.authority.to_account_info(),
        ctx.accounts.dex_b_input_token_account.to_account_info(),
        ctx.accounts.dex_b_output_token_account.to_account_info(),
        ctx.accounts.dex_b_token_a_account.to_account_info(),
        ctx.accounts.dex_b_token_b_account.to_account_info(),
        ctx.accounts.base.token_program.to_account_info(),
    ];
    
    // Create the instruction
    let ix = Instruction {
        program_id: ctx.accounts.dex_b_program.key(),
        accounts: vec![
            AccountMeta::new(ctx.accounts.dex_b_pool.key(), false),
            AccountMeta::new_readonly(ctx.accounts.dex_b_authority.key(), false),
            AccountMeta::new_readonly(ctx.accounts.base.authority.key(), true),
            AccountMeta::new(ctx.accounts.dex_b_input_token_account.key(), false),
            AccountMeta::new(ctx.accounts.dex_b_output_token_account.key(), false),
            AccountMeta::new(ctx.accounts.dex_b_token_a_account.key(), false),
            AccountMeta::new(ctx.accounts.dex_b_token_b_account.key(), false),
            AccountMeta::new_readonly(ctx.accounts.base.token_program.key(), false),
        ],
        data,
    };
    
    // Invoke the instruction
    invoke(&ix, accounts).map_err(|_| FlashLoanArbitrageError::DexSwapFailed.into())
}

/// Helper function to repay the flash loan
fn repay_flash_loan(ctx: &Context<FlashLoanAndArbitrage>, amount: u64) -> Result<()> {
    // Transfer from loan token account to reserve account
    let cpi_accounts = Transfer {
        from: ctx.accounts.loan_token_account.to_account_info(),
        to: ctx.accounts.loan_reserve_account.to_account_info(),
        authority: ctx.accounts.base.authority.to_account_info(),
    };
    
    let cpi_program = ctx.accounts.base.token_program.to_account_info();
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
    
    token::transfer(cpi_ctx, amount).map_err(|_| FlashLoanArbitrageError::FlashLoanRepaymentFailed.into())
}

/// Helper function to calculate the flash loan repayment amount including fees
fn calculate_loan_repayment(principal: u64) -> Result<u64> {
    // Calculate fee: principal * (FLASH_LOAN_FEE_BPS / BPS_DIVISOR)
    let fee = principal
        .checked_mul(FLASH_LOAN_FEE_BPS)
        .unwrap_or(0)
        .checked_div(BPS_DIVISOR)
        .unwrap_or(0);
    
    // Calculate total repayment: principal + fee
    let repayment = principal.checked_add(fee).unwrap_or(principal);
    
    Ok(repayment)
} 