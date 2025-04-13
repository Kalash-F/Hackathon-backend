# Flash Loan Arbitrage UI

This is a simple web interface for interacting with the Solana Flash Loan Arbitrage smart contract.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm start
```

3. Open [http://localhost:3000](http://localhost:3000) to view the app in your browser.

## Usage

1. Connect your wallet using the "Connect Wallet" button.
2. Enter the loan amount and minimum profit amount.
3. Click "Execute Flash Loan Arbitrage" to simulate the transaction.

## Note

This UI is a simulation and doesn't execute actual transactions since you would need:

1. A lending protocol that supports flash loans (like Solend or Jet Protocol)
2. Two DEXs with sufficient liquidity (like Orca, Raydium, etc.)
3. Price discrepancy between the DEXs

In a production environment, you would need to set up and provide real accounts for these services.

## Smart Contract Details

The smart contract being used is deployed at:
```
9chwqr3q9XBJnCs8euyFpyqzHamXpZk4mCAEzsfXjWCC
```

This contract implements flash loan arbitrage functionality between two decentralized exchanges. 