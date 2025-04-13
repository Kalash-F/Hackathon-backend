#!/bin/bash
set -e  # Exit immediately if a command exits with a non-zero status

echo "=== Starting direct testnet deployment (bypassing local validator) ==="

# Set a different ledger directory to avoid conflicts
export ANCHOR_LEDGER_DIR=testnet-ledger

# Step 1: Build with different ledger directory
echo "Building with custom ledger directory..."
anchor build

# Step 2: Deploy directly to testnet
echo "Deploying to testnet..."
anchor deploy --provider.cluster testnet

# Step 3: Set up the UI with the correct polyfills
echo "Setting up the UI with polyfills..."
cd flash-loan-ui

# Install UI dependencies
echo "Installing dependencies..."
npm install --save-dev assert browserify-zlib buffer crypto-browserify https-browserify os-browserify process react-app-rewired stream-browserify stream-http url

# Make sure node_modules is up to date
rm -rf node_modules
npm install

# Start the UI
echo "Starting the UI..."
npm start

echo "=== Direct testnet deployment complete! ===" 