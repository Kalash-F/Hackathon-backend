use anchor_lang::prelude::*;
use thiserror::Error;

#[error_code]
pub enum FlashLoanArbitrageError {
    #[msg("Flash loan initialization failed")]
    FlashLoanInitFailed,
    
    #[msg("Flash loan repayment failed")]
    FlashLoanRepaymentFailed,
    
    #[msg("DEX swap failed")]
    DexSwapFailed,
    
    #[msg("Insufficient profit from arbitrage")]
    InsufficientProfit,
    
    #[msg("Invalid token account")]
    InvalidTokenAccount,
    
    #[msg("Invalid pool account")]
    InvalidPoolAccount,
    
    #[msg("Invalid loan amount")]
    InvalidLoanAmount,
    
    #[msg("Math operation overflow")]
    MathOverflow,
    
    #[msg("Unauthorized access")]
    Unauthorized,
} 