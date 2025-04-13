#!/bin/bash

# Ensure we're using the external validator
export ANCHOR_PROVIDER_URL="http://127.0.0.1:8899"
export ANCHOR_WALLET="/Users/kalash/.config/solana/id.json"

# Run mocha tests directly instead of using anchor test
npx ts-mocha -p ./tsconfig.json -t 1000000 tests/**/*.ts 