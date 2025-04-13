#!/bin/bash

# Make sure validator isn't running
pkill solana-test-validator

# Start a fresh validator
echo "Starting fresh validator..."
solana-test-validator --reset &
VALIDATOR_PID=$!

# Wait for validator to start
echo "Waiting for validator to start..."
sleep 10

# Deploy the program
echo "Deploying program..."
anchor deploy

# Sleep a bit after deploy
sleep 2

# Set environment variables
export ANCHOR_PROVIDER_URL="http://localhost:8899"
export ANCHOR_WALLET="/Users/kalash/.config/solana/id.json"

# Run the test directly
echo "Running tests..."
npx ts-mocha -p ./tsconfig.json -t 1000000 tests/flash_loan_arbitrage.ts

# Clean up validator
kill $VALIDATOR_PID

echo "Tests completed!" 