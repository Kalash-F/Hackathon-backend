#!/bin/bash
set -e  # Exit immediately if a command exits with a non-zero status

echo "🚀 Starting persistent wallet deployment 🚀"

# Setting up directories - can be overridden by environment variables
WALLET_DIR="${WALLET_DIR:-./wallet}"
WALLET_FILE="${WALLET_FILE:-$WALLET_DIR/deployment-wallet.json}"
KEYS_DIR="${KEYS_DIR:-./keys}"
PROGRAM_KEYPAIR="${PROGRAM_KEYPAIR:-$KEYS_DIR/program-keypair.json}"
TARGET_PROGRAM_KEYPAIR="${TARGET_PROGRAM_KEYPAIR:-./target/deploy/flash_loan_arbitrage_program-keypair.json}"
UI_DIR="${UI_DIR:-./flash-loan-ui}"

# Use environment variable for cluster if set, default to testnet
SOLANA_CLUSTER="${SOLANA_CLUSTER:-testnet}"
SOLANA_RPC_URL="${SOLANA_RPC_URL:-https://api.$SOLANA_CLUSTER.solana.com}"

# Create directories if they don't exist
mkdir -p "$WALLET_DIR"
mkdir -p "$KEYS_DIR"

# Check if wallet exists, if not create one
if [ ! -f "$WALLET_FILE" ]; then
  echo "⏳ No deployment wallet found, creating a new one..."
  solana-keygen new --no-passphrase -o "$WALLET_FILE"
  
  # Display public key for funding
  WALLET_ADDRESS=$(solana-keygen pubkey "$WALLET_FILE")
  echo "✅ New wallet created! Public key: $WALLET_ADDRESS"
  echo "🔑 Wallet saved to: $WALLET_FILE"
  echo ""
  echo "⚠️ IMPORTANT: Fund this wallet from Solana $SOLANA_CLUSTER Faucet: https://faucet.solana.com/"
  echo "Enter the following address: $WALLET_ADDRESS"
  echo ""
  echo "Press any key to continue once funded..."
  read -n 1
else
  WALLET_ADDRESS=$(solana-keygen pubkey "$WALLET_FILE")
  echo "✅ Using existing wallet: $WALLET_ADDRESS"
fi

# Configure environment for anchor
export ANCHOR_WALLET="$WALLET_FILE"
export ANCHOR_PROVIDER_URL="$SOLANA_RPC_URL"

echo "⚙️ Configured anchor with wallet: $WALLET_ADDRESS"
echo "⚙️ Target network: Solana $SOLANA_CLUSTER"
echo "⚙️ RPC URL: $SOLANA_RPC_URL"

# Check if program keypair exists, if not copy from target
if [ ! -f "$PROGRAM_KEYPAIR" ]; then
  if [ -f "$TARGET_PROGRAM_KEYPAIR" ]; then
    echo "⏳ Copying program keypair from target/deploy..."
    cp "$TARGET_PROGRAM_KEYPAIR" "$PROGRAM_KEYPAIR"
    echo "✅ Program keypair saved to: $PROGRAM_KEYPAIR"
  else
    echo "⚠️ No program keypair found in target/deploy. Will be generated during build."
  fi
fi

# Build the program
echo "🏗️ Building the program..."
anchor build

# Make sure we have the program keypair
if [ ! -f "$PROGRAM_KEYPAIR" ] && [ -f "$TARGET_PROGRAM_KEYPAIR" ]; then
  echo "⏳ Copying newly generated program keypair..."
  cp "$TARGET_PROGRAM_KEYPAIR" "$PROGRAM_KEYPAIR"
fi

# Deploy the program
echo "🚀 Deploying program to $SOLANA_CLUSTER..."
anchor deploy --provider.cluster $SOLANA_CLUSTER --provider.wallet "$WALLET_FILE"

# Export the wallet for UI use
echo "🔑 Exporting wallet for UI..."
node export_wallet_for_ui.js

# Make the HTML file readable for browsers
chmod 644 "./wallet/import_wallet.html"

# Setup the UI
if [ -d "$UI_DIR" ]; then
  echo "💻 Setting up the UI..."
  
  # Make sure the utilities directory exists
  mkdir -p "$UI_DIR/src/utils"
  
  # Check if node modules are installed
  if [ ! -d "$UI_DIR/node_modules" ]; then
    echo "⏳ Installing dependencies for UI..."
    cd "$UI_DIR" && npm install --legacy-peer-deps
    cd ..
  fi

  # Kill any existing React processes
  pkill -f "react-app-rewired" || true
  
  echo "🚀 Starting the UI..."
  cd "$UI_DIR" && npm start &
  
  # Wait a bit for the server to start
  sleep 5
  echo "🌐 Opening browser..."
  open http://localhost:3000
else
  echo "⚠️ UI directory not found. Skipping UI setup."
fi

echo ""
echo "✅ Deployment completed!"
echo "📝 Your wallet is saved at: $WALLET_FILE"
echo "📝 Program ID: $(solana-keygen pubkey $PROGRAM_KEYPAIR)"
echo ""
echo "🌐 To use this wallet in the UI:"
echo "   1. Open the HTML file at ./wallet/import_wallet.html in your browser"
echo "   2. Click the 'Import Wallet' button"
echo "   3. In the UI, check 'Use deployment wallet' checkbox" 