# Solana Flash Loan Arbitrage Smart Contract

A Rust-based Solana smart contract that executes flash loan arbitrage strategies across multiple DEXes using the Anchor framework.

## Overview

This smart contract allows users to execute arbitrage trades between two different decentralized exchanges (DEXes) on Solana by using a flash loan. The contract follows these steps:

1. Borrow tokens from a lending protocol using a flash loan
2. Execute a swap on DEX A to obtain intermediate tokens
3. Execute a reverse swap on DEX B to obtain more of the original tokens
4. Repay the flash loan plus fees
5. Keep the profit

## Features

- Parameterized design allowing for different token pairs, DEXes, and loan amounts
- Cross-Program Invocations (CPIs) to interact with lending protocols and DEXes
- Profit validation to ensure transactions are profitable
- Robust error handling
- Security best practices

## Project Structure

- `src/lib.rs`: Main program module and entry point
- `src/accounts.rs`: Account structures for instruction contexts
- `src/errors.rs`: Custom error definitions
- `src/instructions/`: Instruction implementations
  - `flash_loan.rs`: Main flash loan and arbitrage instruction
- `tests/`: Integration tests

## Installation and Setup

1. Install Rust, Solana CLI, and Anchor:
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   sh -c "$(curl -sSfL https://release.solana.com/v1.16.0/install)"
   npm install -g @coral-xyz/anchor-cli
   ```

2. Clone the repository
3. Build the program:
   ```bash
   anchor build
   ```

## Usage

### Flash Loan and Arbitrage Instruction

To execute a flash loan and arbitrage:

```rust
flash_loan_and_arbitrage(
    ctx: Context<FlashLoanAndArbitrage>,
    loan_amount: u64,
    min_profit_amount: u64,
)
```

Parameters:
- `loan_amount`: The amount of SOL (or other token) to borrow for the flash loan
- `min_profit_amount`: The minimum profit required for the transaction to succeed

Required accounts:
- Lending protocol accounts
- DEX A accounts
- DEX B accounts
- Token accounts for both the loan token and intermediate token

## Customization

The contract can be customized for specific DEXes and lending protocols by modifying:

1. The account structures in `accounts.rs`
2. The instruction data construction in the helper functions within `flash_loan.rs`
3. The specific CPI logic for interacting with external programs

## Security Considerations

This contract implements several security measures:
- Token amount validation
- Profit threshold validation
- Error handling for all external calls
- Check-Effect-Interaction pattern

## Testing

Run the tests with:

```bash
anchor test
```

The test suite includes setup for token mints, accounts, and transaction simulation.

## License

MIT 