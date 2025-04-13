use anchor_lang::prelude::*;

// Replace this with your actual deployed program ID when you go to production
declare_id!("9chwqr3q9XBJnCs8euyFpyqzHamXpZk4mCAEzsfXjWCC");

pub mod accounts;
pub mod errors;
pub mod instructions;

#[program]
pub mod flash_loan_arbitrage {
    use super::*;
    use crate::accounts::*;

    /// The main instruction that performs flash loan arbitrage across two DEXes
    /// 
    /// # Arguments
    /// * `ctx` - The context containing all accounts needed for the operation
    /// * `loan_amount` - The amount of SOL tokens to borrow for the flash loan
    /// * `min_profit_amount` - The minimum profit required for the transaction to succeed
    ///
    /// # Returns
    /// * `Result<()>` - Result indicating success or an error code
    pub fn flash_loan_and_arbitrage(
        ctx: Context<FlashLoanAndArbitrage>,
        loan_amount: u64,
        min_profit_amount: u64,
    ) -> Result<()> {
        instructions::flash_loan::flash_loan_and_arbitrage(ctx, loan_amount, min_profit_amount)
    }
    
    /// Simulates a flash loan arbitrage to check if it would be profitable
    /// without actually executing any transactions
    /// 
    /// # Arguments
    /// * `ctx` - The context containing all accounts needed for the simulation
    /// * `loan_amount` - The amount of tokens to borrow for the flash loan
    /// * `min_profit_amount` - The minimum profit required for the transaction to succeed
    ///
    /// # Returns
    /// * `Result<u64>` - Result containing the estimated profit or an error code
    pub fn simulate_arbitrage(
        ctx: Context<FlashLoanAndArbitrage>,
        loan_amount: u64,
        min_profit_amount: u64,
    ) -> Result<u64> {
        instructions::flash_loan::simulate_arbitrage(&ctx, loan_amount, min_profit_amount)
    }
} 