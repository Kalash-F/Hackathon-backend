#!/bin/bash

# Kill any running validators
pkill solana-test-validator

# Start a fresh validator in the background
echo "Starting fresh validator..."
solana-test-validator --reset &
VALIDATOR_PID=$!

# Wait for validator to start
echo "Waiting for validator to start..."
sleep 10

# Deploy the program
echo "Deploying program..."
anchor deploy

# Navigate to UI directory and install dependencies
echo "Setting up the UI..."
cd flash-loan-ui
npm install

# Start the UI in the background
echo "Starting the UI server..."
npm start &
UI_PID=$!

echo "⚡️ Flash Loan Arbitrage UI is running at http://localhost:3000"
echo "⚡️ Connect your wallet and test the interface"
echo "⚡️ Press CTRL+C to stop both the UI and validator"

# Wait for user to press CTRL+C
trap "kill $VALIDATOR_PID $UI_PID; exit" INT
wait 