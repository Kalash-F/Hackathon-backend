#!/bin/bash
set -e  # Exit immediately if a command exits with a non-zero status

echo "=== Starting deployment process to Solana Testnet ==="

# Step 1: Update and build the Anchor program
echo "Building Anchor program..."
anchor build

# Step 2: Deploy to testnet
echo "Deploying to testnet..."
anchor deploy --provider.cluster testnet

# Step 3: Set up the UI with the correct polyfills
echo "Setting up the UI with polyfills..."
cd flash-loan-ui

# Install UI dependencies
echo "Installing dependencies..."
npm install --save-dev assert browserify-zlib buffer crypto-browserify https-browserify os-browserify process react-app-rewired stream-browserify stream-http url

# Start the UI
echo "Starting the UI..."
npm start

echo "=== Deployment complete! ===" 