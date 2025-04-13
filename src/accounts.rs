use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount};

// Common accounts that will be reused across different instructions
#[derive(Accounts)]
pub struct ArbitrageState<'info> {
    /// The authority who can execute this arbitrage
    #[account(mut)]
    pub authority: Signer<'info>,
    
    /// SPL Token program
    pub token_program: Program<'info, Token>,
    
    /// System program
    pub system_program: Program<'info, System>,
}

// Accounts needed for the flash loan and arbitrage instruction
#[derive(Accounts)]
pub struct FlashLoanAndArbitrage<'info> {
    /// The base arbitrage accounts
    pub base: ArbitrageState<'info>,
    
    // === Lending Protocol Accounts ===
    
    /// The lending protocol program ID
    pub lending_program: AccountInfo<'info>,
    
    /// The loan token account of the arbitrageur
    #[account(mut)]
    pub loan_token_account: Account<'info, TokenAccount>,
    
    /// The lending protocol's reserve account
    #[account(mut)]
    pub loan_reserve_account: AccountInfo<'info>,
    
    /// The fee account for the lending protocol
    #[account(mut)]
    pub lending_fee_account: AccountInfo<'info>,
    
    // === DEX A Accounts ===
    
    /// The DEX A program ID
    pub dex_a_program: AccountInfo<'info>,
    
    /// The DEX A pool account
    #[account(mut)]
    pub dex_a_pool: AccountInfo<'info>,
    
    /// The DEX A authority account
    pub dex_a_authority: AccountInfo<'info>,
    
    /// The input token account for DEX A swap (loan token)
    #[account(mut)]
    pub dex_a_input_token_account: Account<'info, TokenAccount>,
    
    /// The output token account for DEX A swap (intermediate token)
    #[account(mut)]
    pub dex_a_output_token_account: Account<'info, TokenAccount>,
    
    /// The DEX A pool's token A account
    #[account(mut)]
    pub dex_a_token_a_account: Account<'info, TokenAccount>,
    
    /// The DEX A pool's token B account
    #[account(mut)]
    pub dex_a_token_b_account: Account<'info, TokenAccount>,
    
    // === DEX B Accounts ===
    
    /// The DEX B program ID
    pub dex_b_program: AccountInfo<'info>,
    
    /// The DEX B pool account
    #[account(mut)]
    pub dex_b_pool: AccountInfo<'info>,
    
    /// The DEX B authority account
    pub dex_b_authority: AccountInfo<'info>,
    
    /// The input token account for DEX B swap (intermediate token)
    #[account(mut)]
    pub dex_b_input_token_account: Account<'info, TokenAccount>,
    
    /// The output token account for DEX B swap (loan token)
    #[account(mut)]
    pub dex_b_output_token_account: Account<'info, TokenAccount>,
    
    /// The DEX B pool's token A account
    #[account(mut)]
    pub dex_b_token_a_account: Account<'info, TokenAccount>,
    
    /// The DEX B pool's token B account
    #[account(mut)]
    pub dex_b_token_b_account: Account<'info, TokenAccount>,
} 