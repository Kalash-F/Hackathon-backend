use anchor_lang::prelude::*;

declare_id!("9chwqr3q9XBJnCs8euyFpyqzHamXpZk4mCAEzsfXjWCC");

pub mod instructions;
pub mod state;

use state::accounts::*;

#[program]
pub mod flash_loan_arbitrage {
    use super::*;

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
        instructions::flash_loan::process_flash_loan_and_arbitrage(ctx, loan_amount, min_profit_amount)
    }
}