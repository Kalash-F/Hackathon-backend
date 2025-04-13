use anchor_lang::prelude::*;
use anchor_lang::solana_program::{
    instruction::{AccountMeta, Instruction},
    program::invoke,
    pubkey::Pubkey,
};
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::accounts::FlashLoanAndArbitrage;
use crate::errors::FlashLoanArbitrageError;

// Constants for protocol constraints
const MIN_LOAN_AMOUNT: u64 = 1_000; // Minimum loan amount in base units
const MAX_LOAN_AMOUNT: u64 = 1_000_000_000_000; // Maximum loan amount
const MIN_PROFIT_THRESHOLD: u64 = 1000; // Minimum profit in base units
const FLASH_LOAN_FEE_BPS: u64 = 30; // 0.3% in basis points
const BPS_DIVISOR: u64 = 10000;
const DEFAULT_SLIPPAGE_BPS: u64 = 100; // 1% slippage tolerance
const MAX_EXECUTION_TIME: i64 = 30; // Maximum seconds for execution

pub struct SwapConfig {
    pub min_out_amount: u64,
    pub slippage_bps: u64,
}

pub fn flash_loan_and_arbitrage(
    ctx: Context<FlashLoanAndArbitrage>,
    loan_amount: u64,
    min_profit_amount: u64,
) -> Result<()> {
    // Validate inputs
    require!(
        loan_amount >= MIN_LOAN_AMOUNT,
        FlashLoanArbitrageError::LoanAmountTooSmall
    );
    require!(
        loan_amount <= MAX_LOAN_AMOUNT,
        FlashLoanArbitrageError::LoanAmountTooLarge
    );
    require!(
        min_profit_amount >= MIN_PROFIT_THRESHOLD,
        FlashLoanArbitrageError::InsufficientProfit
    );

    // Ensure DEX A and DEX B are not the same program
    require!(
        ctx.accounts.dex_a_program.key() != ctx.accounts.dex_b_program.key(),
        FlashLoanArbitrageError::SameDexError
    );

    // Capture start time for execution time limiting
    let start_time = ctx.accounts.clock.unix_timestamp;

    // Get initial balance to compare at the end
    let initial_balance = ctx.accounts.loan_token_account.amount;
    msg!("Initial balance: {}", initial_balance);

    // 1. Initiate flash loan
    msg!("Initiating flash loan of {} tokens", loan_amount);
    initiate_flash_loan(&ctx, loan_amount)?;

    // Check time constraint after flash loan
    check_execution_time(start_time, ctx.accounts.clock.unix_timestamp)?;

    // 2. Execute first swap (DEX A)
    let estimated_out_amount = estimate_dex_a_output(&ctx, loan_amount);
    let swap_a_config = SwapConfig {
        min_out_amount: calculate_min_amount_with_slippage(estimated_out_amount, DEFAULT_SLIPPAGE_BPS),
        slippage_bps: DEFAULT_SLIPPAGE_BPS,
    };
    
    msg!("Executing swap on DEX A with min output: {}", swap_a_config.min_out_amount);
    execute_dex_a_swap(&ctx, loan_amount, &swap_a_config)?;

    // Get intermediate token balance after first swap
    let intermediate_balance = ctx.accounts.dex_a_output_token_account.amount;
    msg!("Intermediate token balance after first swap: {}", intermediate_balance);
    
    // Validate we got enough tokens from the first swap
    require!(
        intermediate_balance >= swap_a_config.min_out_amount,
        FlashLoanArbitrageError::FirstSwapInsufficientOutput
    );

    // Check time constraint after first swap
    check_execution_time(start_time, ctx.accounts.clock.unix_timestamp)?;

    // 3. Execute second swap (DEX B)
    let estimated_out_amount = estimate_dex_b_output(&ctx, intermediate_balance);
    let swap_b_config = SwapConfig {
        min_out_amount: calculate_min_amount_with_slippage(estimated_out_amount, DEFAULT_SLIPPAGE_BPS),
        slippage_bps: DEFAULT_SLIPPAGE_BPS,
    };
    
    msg!("Executing swap on DEX B with min output: {}", swap_b_config.min_out_amount);
    execute_dex_b_swap(&ctx, intermediate_balance, &swap_b_config)?;

    // Get final loan token balance after second swap
    let final_balance = ctx.accounts.loan_token_account.amount;
    msg!("Final loan token balance: {}", final_balance);
    
    // Validate we got enough tokens from the second swap
    require!(
        final_balance >= swap_b_config.min_out_amount,
        FlashLoanArbitrageError::SecondSwapInsufficientOutput
    );

    // Check time constraint after second swap
    check_execution_time(start_time, ctx.accounts.clock.unix_timestamp)?;

    // 4. Calculate and validate repayment amount
    let repayment_amount = calculate_loan_repayment(loan_amount);
    msg!("Repaying flash loan, amount: {}", repayment_amount);
    
    // Ensure we have enough tokens for repayment
    require!(
        final_balance >= repayment_amount,
        FlashLoanArbitrageError::FlashLoanRepaymentFailed
    );

    // 5. Repay flash loan
    repay_flash_loan(&ctx, repayment_amount)?;

    // 6. Calculate profit
    let profit = ctx.accounts.loan_token_account.amount
        .checked_sub(initial_balance)
        .ok_or(FlashLoanArbitrageError::MathOverflow)?;
    
    msg!("Arbitrage profit: {}", profit);

    // Ensure minimum profit is achieved
    require!(
        profit >= min_profit_amount,
        FlashLoanArbitrageError::InsufficientProfit
    );

    // Final time check
    check_execution_time(start_time, ctx.accounts.clock.unix_timestamp)?;

    Ok(())
}

/// Checks if the execution time has exceeded the maximum allowed time
fn check_execution_time(start_time: i64, current_time: i64) -> Result<()> {
    let elapsed = current_time.checked_sub(start_time).unwrap_or(0);
    require!(
        elapsed <= MAX_EXECUTION_TIME,
        FlashLoanArbitrageError::InstructionTimeoutExceeded
    );
    Ok(())
}

/// Calculates the minimum amount with slippage tolerance
fn calculate_min_amount_with_slippage(amount: u64, slippage_bps: u64) -> u64 {
    let slippage = amount
        .checked_mul(slippage_bps)
        .unwrap_or(0)
        .checked_div(BPS_DIVISOR)
        .unwrap_or(0);
    
    amount.checked_sub(slippage).unwrap_or(amount)
}

/// Estimates the output amount for DEX A swap (placeholder - to be implemented with actual DEX API)
fn estimate_dex_a_output(ctx: &Context<FlashLoanAndArbitrage>, amount: u64) -> u64 {
    // In a real implementation, you would query the DEX or use a pricing oracle
    // This is a placeholder that assumes 98% of input (approximating 2% fee and slippage)
    amount.checked_mul(98).unwrap_or(amount).checked_div(100).unwrap_or(amount)
}

/// Estimates the output amount for DEX B swap (placeholder - to be implemented with actual DEX API)
fn estimate_dex_b_output(ctx: &Context<FlashLoanAndArbitrage>, amount: u64) -> u64 {
    // In a real implementation, you would query the DEX or use a pricing oracle
    // This is a placeholder that assumes 98% of input (approximating 2% fee and slippage)
    amount.checked_mul(98).unwrap_or(amount).checked_div(100).unwrap_or(amount)
}

/// Helper function to initiate a flash loan from the lending protocol
fn initiate_flash_loan(ctx: &Context<FlashLoanAndArbitrage>, amount: u64) -> Result<()> {
    // Validate accounts
    require!(
        ctx.accounts.loan_reserve_account.owner == ctx.accounts.lending_program.key(),
        FlashLoanArbitrageError::LendingPoolOwnerMismatch
    );
    
    require!(
        ctx.accounts.lending_fee_account.owner == ctx.accounts.lending_program.key(),
        FlashLoanArbitrageError::LendingPoolOwnerMismatch
    );

    // This is a placeholder implementation that should be replaced with actual lending protocol integration
    // Example with Solend or similar protocol
    
    // Example instruction data for flash loan initialization
    let mut data = Vec::with_capacity(9);
    data.push(0); // Instruction code for flash loan (adjust based on actual protocol)
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
    ).map_err(|e| {
        msg!("Flash loan initialization failed with error: {:?}", e);
        FlashLoanArbitrageError::FlashLoanInitFailed.into()
    })
}

/// Helper function to execute a swap on DEX A
fn execute_dex_a_swap(ctx: &Context<FlashLoanAndArbitrage>, amount: u64, config: &SwapConfig) -> Result<()> {
    // Validate accounts
    require!(
        ctx.accounts.dex_a_pool.owner == ctx.accounts.dex_a_program.key(),
        FlashLoanArbitrageError::DexPoolOwnerMismatch
    );
    
    // This is a placeholder implementation that should be replaced with actual DEX integration
    // For example with Jupiter, Orca, or Raydium
    
    // The actual implementation would depend on the specific DEX being used
    let mut data = Vec::with_capacity(17);
    data.push(1); // Instruction code for swap (adjust based on actual DEX)
    data.extend_from_slice(&amount.to_le_bytes());
    data.extend_from_slice(&config.min_out_amount.to_le_bytes());
    
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
    ).map_err(|e| {
        msg!("DEX A swap failed with error: {:?}", e);
        FlashLoanArbitrageError::DexSwapFailed.into()
    })
}

/// Helper function to execute a swap on DEX B
fn execute_dex_b_swap(ctx: &Context<FlashLoanAndArbitrage>, amount: u64, config: &SwapConfig) -> Result<()> {
    // Validate accounts
    require!(
        ctx.accounts.dex_b_pool.owner == ctx.accounts.dex_b_program.key(),
        FlashLoanArbitrageError::DexPoolOwnerMismatch
    );
    
    // This is a placeholder implementation that should be replaced with actual DEX integration
    // For example with Jupiter, Orca, or Raydium
    
    // The actual implementation would depend on the specific DEX being used
    let mut data = Vec::with_capacity(17);
    data.push(1); // Instruction code for swap (adjust based on actual DEX)
    data.extend_from_slice(&amount.to_le_bytes());
    data.extend_from_slice(&config.min_out_amount.to_le_bytes());
    
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
    ).map_err(|e| {
        msg!("DEX B swap failed with error: {:?}", e);
        FlashLoanArbitrageError::DexSwapFailed.into()
    })
}

/// Helper function to repay the flash loan
fn repay_flash_loan(ctx: &Context<FlashLoanAndArbitrage>, amount: u64) -> Result<()> {
    // Validate accounts
    require!(
        ctx.accounts.loan_reserve_account.owner == ctx.accounts.lending_program.key(),
        FlashLoanArbitrageError::LendingPoolOwnerMismatch
    );
    
    // Repay the flash loan directly from the loan token account to the reserve account
    
    // Transfer from loan token account to reserve account
    let cpi_accounts = Transfer {
        from: ctx.accounts.loan_token_account.to_account_info(),
        to: ctx.accounts.loan_reserve_account.to_account_info(),
        authority: ctx.accounts.base.authority.to_account_info(),
    };
    
    let cpi_program = ctx.accounts.base.token_program.to_account_info();
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
    
    token::transfer(cpi_ctx, amount).map_err(|e| {
        msg!("Flash loan repayment failed with error: {:?}", e);
        FlashLoanArbitrageError::FlashLoanRepaymentFailed.into()
    })
}

/// Helper function to calculate the flash loan repayment amount including fees
fn calculate_loan_repayment(principal: u64) -> u64 {
    // Calculate fee: principal * (FLASH_LOAN_FEE_BPS / BPS_DIVISOR)
    let fee = principal
        .checked_mul(FLASH_LOAN_FEE_BPS)
        .unwrap_or(0)
        .checked_div(BPS_DIVISOR)
        .unwrap_or(0);
    
    // Calculate total repayment: principal + fee
    principal.checked_add(fee).unwrap_or(principal)
}

/// Public function to simulate an arbitrage transaction and check if it would be profitable
pub fn simulate_arbitrage(
    ctx: &Context<FlashLoanAndArbitrage>,
    loan_amount: u64,
    min_profit_amount: u64,
) -> Result<u64> {
    // Simulate flash loan fee
    let repayment_amount = calculate_loan_repayment(loan_amount);
    
    // Simulate DEX A swap
    let intermediate_amount = estimate_dex_a_output(ctx, loan_amount);
    
    // Simulate DEX B swap
    let final_amount = estimate_dex_b_output(ctx, intermediate_amount);
    
    // Calculate estimated profit
    let estimated_profit = final_amount.checked_sub(repayment_amount).unwrap_or(0);
    
    // Check if estimated profit meets minimum
    if estimated_profit < min_profit_amount {
        return Err(FlashLoanArbitrageError::InsufficientProfit.into());
    }
    
    // Return estimated profit
    Ok(estimated_profit)
} 