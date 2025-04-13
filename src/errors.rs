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

    #[msg("Token account mint mismatch")]
    TokenAccountMintMismatch,
    
    #[msg("Token account owner mismatch")]
    TokenAccountOwnerMismatch,
    
    #[msg("DEX pool account owner mismatch")]
    DexPoolOwnerMismatch,
    
    #[msg("Lending pool account owner mismatch")]
    LendingPoolOwnerMismatch,
    
    #[msg("Instruction timeout exceeded")]
    InstructionTimeoutExceeded,
    
    #[msg("Slippage tolerance exceeded")]
    SlippageToleranceExceeded,
    
    #[msg("First swap failed: insufficient output")]
    FirstSwapInsufficientOutput,
    
    #[msg("Second swap failed: insufficient output")]
    SecondSwapInsufficientOutput,
    
    #[msg("Loan amount too small")]
    LoanAmountTooSmall,
    
    #[msg("Loan amount too large")]
    LoanAmountTooLarge,
    
    #[msg("DEX A and DEX B cannot be the same")]
    SameDexError,
} 