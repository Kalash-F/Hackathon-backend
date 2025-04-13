use anchor_lang::prelude::*;
use anchor_lang::solana_program::{
    instruction::{AccountMeta, Instruction},
    program::invoke,
    pubkey::Pubkey,
};
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::accounts::FlashLoanAndArbitrage;
use crate::errors::FlashLoanArbitrageError;

// Constants for minimum profit threshold
const MIN_PROFIT_THRESHOLD: u64 = 1000; // Minimum profit in base units

pub fn flash_loan_and_arbitrage(
    ctx: Context<FlashLoanAndArbitrage>,
    loan_amount: u64,
    min_profit_amount: u64,
) -> Result<()> {
    // Get initial balance to compare at the end
    let initial_balance = ctx.accounts.loan_token_account.amount;
    msg!("Initial balance: {}", initial_balance);

    // 1. Initiate flash loan
    msg!("Initiating flash loan of {} SOL tokens", loan_amount);
    initiate_flash_loan(&ctx, loan_amount)?;

    // 2. Execute first swap (DEX A)
    msg!("Executing swap on DEX A");
    execute_dex_a_swap(&ctx, loan_amount)?;

    // Get intermediate token balance after first swap
    let intermediate_balance = ctx.accounts.dex_a_output_token_account.amount;
    msg!("Intermediate token balance after first swap: {}", intermediate_balance);

    // 3. Execute second swap (DEX B)
    msg!("Executing swap on DEX B");
    execute_dex_b_swap(&ctx, intermediate_balance)?;

    // Get final loan token balance after second swap
    let final_balance = ctx.accounts.loan_token_account.amount;
    msg!("Final loan token balance: {}", final_balance);

    // 4. Repay flash loan
    let repayment_amount = calculate_loan_repayment(loan_amount);
    msg!("Repaying flash loan, amount: {}", repayment_amount);
    repay_flash_loan(&ctx, repayment_amount)?;

    // 5. Calculate profit
    let profit = ctx.accounts.loan_token_account.amount.checked_sub(initial_balance)
        .ok_or(FlashLoanArbitrageError::MathOverflow)?;
    
    msg!("Arbitrage profit: {}", profit);

    // Ensure minimum profit is achieved
    require!(
        profit >= min_profit_amount.max(MIN_PROFIT_THRESHOLD),
        FlashLoanArbitrageError::InsufficientProfit
    );

    Ok(())
}

/// Helper function to initiate a flash loan from the lending protocol
fn initiate_flash_loan(ctx: &Context<FlashLoanAndArbitrage>, amount: u64) -> Result<()> {
    // Construct and invoke the flash loan instruction for the lending protocol
    // Note: This example uses a generic instruction format; replace with the actual lending protocol's format
    
    // Example instruction data for flash loan initialization
    let flash_loan_ix_data = [0u8; 9]; // Instruction code 0 + amount as u64 (8 bytes)
    let mut data = Vec::with_capacity(9);
    data.push(0); // Instruction code for flash loan
    data.extend_from_slice(&amount.to_le_bytes());
    
    let accounts = vec![
        AccountMeta::new(ctx.accounts.loan_reserve_account.key(), false),
        AccountMeta::new(ctx.accounts.loan_token_account.key(), false),
        AccountMeta::new_readonly(ctx.accounts.base.token_program.key(), false),
        AccountMeta::new(ctx.accounts.lending_fee_account.key(), false),
        AccountMeta::new_readonly(ctx.accounts.base.authority.key(), true),
    ];
    
    let flash_loan_ix = Instruction {
        program_id: ctx.accounts.lending_program.key(),
        accounts,
        data,
    };
    
    invoke(
        &flash_loan_ix,
        &[
            ctx.accounts.loan_reserve_account.to_account_info(),
            ctx.accounts.loan_token_account.to_account_info(),
            ctx.accounts.base.token_program.to_account_info(),
            ctx.accounts.lending_fee_account.to_account_info(),
            ctx.accounts.base.authority.to_account_info(),
        ],
    ).map_err(|_| FlashLoanArbitrageError::FlashLoanInitFailed.into())
}

/// Helper function to execute a swap on DEX A
fn execute_dex_a_swap(ctx: &Context<FlashLoanAndArbitrage>, amount: u64) -> Result<()> {
    // Construct and invoke the swap instruction for DEX A
    // Note: This example uses a generic instruction format; replace with the actual DEX's format
    
    // Example instruction data for DEX A swap
    let mut data = Vec::with_capacity(9);
    data.push(1); // Instruction code for swap
    data.extend_from_slice(&amount.to_le_bytes());
    
    let accounts = vec![
        AccountMeta::new(ctx.accounts.dex_a_pool.key(), false),
        AccountMeta::new_readonly(ctx.accounts.dex_a_authority.key(), false),
        AccountMeta::new_readonly(ctx.accounts.base.authority.key(), true),
        AccountMeta::new(ctx.accounts.dex_a_input_token_account.key(), false),
        AccountMeta::new(ctx.accounts.dex_a_output_token_account.key(), false),
        AccountMeta::new(ctx.accounts.dex_a_token_a_account.key(), false),
        AccountMeta::new(ctx.accounts.dex_a_token_b_account.key(), false),
        AccountMeta::new_readonly(ctx.accounts.base.token_program.key(), false),
    ];
    
    let swap_ix = Instruction {
        program_id: ctx.accounts.dex_a_program.key(),
        accounts,
        data,
    };
    
    invoke(
        &swap_ix,
        &[
            ctx.accounts.dex_a_pool.to_account_info(),
            ctx.accounts.dex_a_authority.to_account_info(),
            ctx.accounts.base.authority.to_account_info(),
            ctx.accounts.dex_a_input_token_account.to_account_info(),
            ctx.accounts.dex_a_output_token_account.to_account_info(),
            ctx.accounts.dex_a_token_a_account.to_account_info(),
            ctx.accounts.dex_a_token_b_account.to_account_info(),
            ctx.accounts.base.token_program.to_account_info(),
        ],
    ).map_err(|_| FlashLoanArbitrageError::DexSwapFailed.into())
}

/// Helper function to execute a swap on DEX B
fn execute_dex_b_swap(ctx: &Context<FlashLoanAndArbitrage>, amount: u64) -> Result<()> {
    // Construct and invoke the swap instruction for DEX B
    // Note: This example uses a generic instruction format; replace with the actual DEX's format
    
    // Example instruction data for DEX B swap
    let mut data = Vec::with_capacity(9);
    data.push(1); // Instruction code for swap
    data.extend_from_slice(&amount.to_le_bytes());
    
    let accounts = vec![
        AccountMeta::new(ctx.accounts.dex_b_pool.key(), false),
        AccountMeta::new_readonly(ctx.accounts.dex_b_authority.key(), false),
        AccountMeta::new_readonly(ctx.accounts.base.authority.key(), true),
        AccountMeta::new(ctx.accounts.dex_b_input_token_account.key(), false),
        AccountMeta::new(ctx.accounts.dex_b_output_token_account.key(), false),
        AccountMeta::new(ctx.accounts.dex_b_token_a_account.key(), false),
        AccountMeta::new(ctx.accounts.dex_b_token_b_account.key(), false),
        AccountMeta::new_readonly(ctx.accounts.base.token_program.key(), false),
    ];
    
    let swap_ix = Instruction {
        program_id: ctx.accounts.dex_b_program.key(),
        accounts,
        data,
    };
    
    invoke(
        &swap_ix,
        &[
            ctx.accounts.dex_b_pool.to_account_info(),
            ctx.accounts.dex_b_authority.to_account_info(),
            ctx.accounts.base.authority.to_account_info(),
            ctx.accounts.dex_b_input_token_account.to_account_info(),
            ctx.accounts.dex_b_output_token_account.to_account_info(),
            ctx.accounts.dex_b_token_a_account.to_account_info(),
            ctx.accounts.dex_b_token_b_account.to_account_info(),
            ctx.accounts.base.token_program.to_account_info(),
        ],
    ).map_err(|_| FlashLoanArbitrageError::DexSwapFailed.into())
}

/// Helper function to repay the flash loan
fn repay_flash_loan(ctx: &Context<FlashLoanAndArbitrage>, amount: u64) -> Result<()> {
    // Repay the flash loan directly from the loan token account to the reserve account
    
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
fn calculate_loan_repayment(principal: u64) -> u64 {
    // Example: 0.3% fee for flash loans
    const FLASH_LOAN_FEE_BPS: u64 = 30; // 0.3% in basis points
    const BPS_DIVISOR: u64 = 10000;
    
    // Calculate fee: principal * (FLASH_LOAN_FEE_BPS / BPS_DIVISOR)
    let fee = principal
        .checked_mul(FLASH_LOAN_FEE_BPS)
        .unwrap_or(0)
        .checked_div(BPS_DIVISOR)
        .unwrap_or(0);
    
    // Calculate total repayment: principal + fee
    principal.checked_add(fee).unwrap_or(principal)
} 