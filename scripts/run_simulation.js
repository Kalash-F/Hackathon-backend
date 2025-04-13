const anchor = require('@coral-xyz/anchor');
const { PublicKey, Keypair, LAMPORTS_PER_SOL, Connection } = require('@solana/web3.js');
const { TOKEN_PROGRAM_ID } = require('@solana/spl-token');
const fs = require('fs');
const path = require('path');

// Create a provider with default values if environment variables are not set
function createProvider() {
  // Set default URL to localhost if ANCHOR_PROVIDER_URL is not defined
  const url = process.env.ANCHOR_PROVIDER_URL || 'http://localhost:8899';
  const connection = new Connection(url);
  
  // Create a wallet object
  const wallet = {
    publicKey: Keypair.generate().publicKey,
    signTransaction: () => Promise.reject(new Error('Wallet not available for signing')),
    signAllTransactions: () => Promise.reject(new Error('Wallet not available for signing')),
  };
  
  return new anchor.AnchorProvider(connection, wallet, {});
}

// Load the IDL file
const idlPath = path.join(__dirname, '../target/idl/flash_loan_arbitrage.json');
console.log("Loading IDL from:", idlPath);
const idl = JSON.parse(fs.readFileSync(idlPath, 'utf8'));

// The program ID from the IDL
const programId = new PublicKey(idl.metadata.address);

async function main() {
  // Configure the client to use our custom provider
  const provider = createProvider();
  anchor.setProvider(provider);

  console.log("Using program ID:", programId.toString());
  
  const program = new anchor.Program(idl, programId, provider);
  
  // Create mock accounts for simulation
  const lendingProgram = Keypair.generate();
  const dexAProgram = Keypair.generate();
  const dexBProgram = Keypair.generate();
  
  const arbitrageur = provider.wallet.publicKey;
  const loanTokenMint = Keypair.generate();
  const intermediateTokenMint = Keypair.generate();
  
  const loanTokenAccount = Keypair.generate();
  const intermediateTokenAccount = Keypair.generate();
  const loanReserveAccount = Keypair.generate();
  const lendingFeeAccount = Keypair.generate();
  
  const dexAPool = Keypair.generate();
  const dexAAuthority = Keypair.generate();
  const dexATokenAAccount = Keypair.generate();
  const dexATokenBAccount = Keypair.generate();
  
  const dexBPool = Keypair.generate();
  const dexBAuthority = Keypair.generate();
  const dexBTokenAAccount = Keypair.generate();
  const dexBTokenBAccount = Keypair.generate();
  
  // Test parameters
  const loanAmount = new anchor.BN(1 * LAMPORTS_PER_SOL); // 1 SOL
  const minProfitAmount = new anchor.BN(0.001 * LAMPORTS_PER_SOL); // 0.001 SOL
  
  console.log("\nSimulation parameters:");
  console.log(" - Loan amount:", loanAmount.toString(), "lamports (", loanAmount.toNumber() / LAMPORTS_PER_SOL, "SOL)");
  console.log(" - Min profit amount:", minProfitAmount.toString(), "lamports (", minProfitAmount.toNumber() / LAMPORTS_PER_SOL, "SOL)");
  
  try {
    console.log("\nRunning simulation...");
    
    // Prepare accounts for the simulate_arbitrage instruction
    const accounts = {
      base: {
        authority: arbitrageur,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      },
      lendingProgram: lendingProgram.publicKey,
      loanTokenAccount: loanTokenAccount.publicKey,
      loanReserveAccount: loanReserveAccount.publicKey,
      lendingFeeAccount: lendingFeeAccount.publicKey,
      dexAProgram: dexAProgram.publicKey,
      dexAPool: dexAPool.publicKey,
      dexAAuthority: dexAAuthority.publicKey,
      dexAInputTokenAccount: loanTokenAccount.publicKey,
      dexAOutputTokenAccount: intermediateTokenAccount.publicKey,
      dexATokenAAccount: dexATokenAAccount.publicKey,
      dexATokenBAccount: dexATokenBAccount.publicKey,
      dexBProgram: dexBProgram.publicKey,
      dexBPool: dexBPool.publicKey,
      dexBAuthority: dexBAuthority.publicKey,
      dexBInputTokenAccount: intermediateTokenAccount.publicKey,
      dexBOutputTokenAccount: loanTokenAccount.publicKey,
      dexBTokenAAccount: dexBTokenAAccount.publicKey,
      dexBTokenBAccount: dexBTokenBAccount.publicKey,
      clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
    };
    
    // We'll do a client-side simulation since we can't create the real accounts
    console.log("\nSimulation accounts (shortened):");
    console.log(" - Lending Program:", lendingProgram.publicKey.toString().substring(0, 16) + "...");
    console.log(" - DEX A Program:", dexAProgram.publicKey.toString().substring(0, 16) + "...");
    console.log(" - DEX B Program:", dexBProgram.publicKey.toString().substring(0, 16) + "...");
    
    // Run the client-side simulation
    console.log("\nClient-side simulation based on the contract logic:");
    
    // 1. Get initial balance (0 in simulation)
    const initialBalance = 0;
    
    // 2. Simulate flash loan
    console.log(" 1. Initiating flash loan of", loanAmount.toNumber() / LAMPORTS_PER_SOL, "SOL");
    
    // 3. Simulate first swap (DEX A) - Assuming favorable rate for arbitrage (1.05x)
    const dexARate = 1.05; // Token is 5% more valuable on DEX A
    const estimatedDexAOutput = Math.floor(loanAmount.toNumber() * dexARate);
    console.log(" 2. Executing swap on DEX A (rate: " + dexARate + "):");
    console.log("    Input:", loanAmount.toNumber() / LAMPORTS_PER_SOL, "SOL");
    console.log("    Output:", estimatedDexAOutput / LAMPORTS_PER_SOL, "intermediate tokens");
    
    // 4. Simulate second swap (DEX B) - Assuming favorable rate for arbitrage (1.02x)
    const dexBRate = 1.02; // Better rate on DEX B as well for the reverse conversion
    const estimatedDexBOutput = Math.floor(estimatedDexAOutput * dexBRate);
    console.log(" 3. Executing swap on DEX B (rate: " + dexBRate + "):");
    console.log("    Input:", estimatedDexAOutput / LAMPORTS_PER_SOL, "intermediate tokens");
    console.log("    Output:", estimatedDexBOutput / LAMPORTS_PER_SOL, "SOL");
    
    // 5. Calculate loan repayment - 0.3% fee
    const loanFee = Math.floor(loanAmount.toNumber() * 0.003);
    const repaymentAmount = loanAmount.toNumber() + loanFee;
    console.log(" 4. Repaying flash loan:");
    console.log("    Principal:", loanAmount.toNumber() / LAMPORTS_PER_SOL, "SOL");
    console.log("    Fee:", loanFee / LAMPORTS_PER_SOL, "SOL");
    console.log("    Total repayment:", repaymentAmount / LAMPORTS_PER_SOL, "SOL");
    
    // 6. Calculate profit
    const profit = estimatedDexBOutput - repaymentAmount;
    const profitPercentage = (profit / loanAmount.toNumber()) * 100;
    
    console.log("\nSimulation Results:");
    console.log(" - Final balance after swaps:", estimatedDexBOutput / LAMPORTS_PER_SOL, "SOL");
    console.log(" - Repayment amount:", repaymentAmount / LAMPORTS_PER_SOL, "SOL");
    console.log(" - Profit:", profit / LAMPORTS_PER_SOL, "SOL");
    console.log(" - Profit percentage:", profitPercentage.toFixed(2) + "%");
    
    if (profit >= minProfitAmount.toNumber()) {
      console.log("\n✅ Transaction would be PROFITABLE");
    } else {
      console.log("\n❌ Transaction would NOT be profitable enough");
      console.log("   Minimum required profit:", minProfitAmount.toNumber() / LAMPORTS_PER_SOL, "SOL");
    }
    
    // 7. Run a second simulation with different parameters to show effect of larger loan amount
    console.log("\n----- Second Simulation (Larger Loan Amount) -----");
    
    const largerLoanAmount = new anchor.BN(10 * LAMPORTS_PER_SOL); // 10 SOL
    
    console.log("\nSimulation parameters:");
    console.log(" - Loan amount:", largerLoanAmount.toString(), "lamports (", largerLoanAmount.toNumber() / LAMPORTS_PER_SOL, "SOL)");
    console.log(" - Min profit amount:", minProfitAmount.toString(), "lamports (", minProfitAmount.toNumber() / LAMPORTS_PER_SOL, "SOL)");
    
    // 1. Get initial balance (0 in simulation)
    
    // 2. Simulate flash loan
    console.log(" 1. Initiating flash loan of", largerLoanAmount.toNumber() / LAMPORTS_PER_SOL, "SOL");
    
    // 3. Simulate first swap (DEX A)
    const largerDexAOutput = Math.floor(largerLoanAmount.toNumber() * dexARate);
    console.log(" 2. Executing swap on DEX A (rate: " + dexARate + "):");
    console.log("    Input:", largerLoanAmount.toNumber() / LAMPORTS_PER_SOL, "SOL");
    console.log("    Output:", largerDexAOutput / LAMPORTS_PER_SOL, "intermediate tokens");
    
    // 4. Simulate second swap (DEX B)
    const largerDexBOutput = Math.floor(largerDexAOutput * dexBRate);
    console.log(" 3. Executing swap on DEX B (rate: " + dexBRate + "):");
    console.log("    Input:", largerDexAOutput / LAMPORTS_PER_SOL, "intermediate tokens");
    console.log("    Output:", largerDexBOutput / LAMPORTS_PER_SOL, "SOL");
    
    // 5. Calculate loan repayment
    const largerLoanFee = Math.floor(largerLoanAmount.toNumber() * 0.003);
    const largerRepaymentAmount = largerLoanAmount.toNumber() + largerLoanFee;
    console.log(" 4. Repaying flash loan:");
    console.log("    Principal:", largerLoanAmount.toNumber() / LAMPORTS_PER_SOL, "SOL");
    console.log("    Fee:", largerLoanFee / LAMPORTS_PER_SOL, "SOL");
    console.log("    Total repayment:", largerRepaymentAmount / LAMPORTS_PER_SOL, "SOL");
    
    // 6. Calculate profit
    const largerProfit = largerDexBOutput - largerRepaymentAmount;
    const largerProfitPercentage = (largerProfit / largerLoanAmount.toNumber()) * 100;
    
    console.log("\nSimulation Results:");
    console.log(" - Final balance after swaps:", largerDexBOutput / LAMPORTS_PER_SOL, "SOL");
    console.log(" - Repayment amount:", largerRepaymentAmount / LAMPORTS_PER_SOL, "SOL");
    console.log(" - Profit:", largerProfit / LAMPORTS_PER_SOL, "SOL");
    console.log(" - Profit percentage:", largerProfitPercentage.toFixed(2) + "%");
    
    if (largerProfit >= minProfitAmount.toNumber()) {
      console.log("\n✅ Transaction would be PROFITABLE");
    } else {
      console.log("\n❌ Transaction would NOT be profitable enough");
      console.log("   Minimum required profit:", minProfitAmount.toNumber() / LAMPORTS_PER_SOL, "SOL");
    }
    
    // 8. Run a third simulation with slippage to show its impact
    console.log("\n----- Third Simulation (With Slippage) -----");
    
    const slippageLoanAmount = new anchor.BN(10 * LAMPORTS_PER_SOL); // 10 SOL
    const slippageBps = 50; // 0.5% slippage
    
    console.log("\nSimulation parameters:");
    console.log(" - Loan amount:", slippageLoanAmount.toString(), "lamports (", slippageLoanAmount.toNumber() / LAMPORTS_PER_SOL, "SOL)");
    console.log(" - Min profit amount:", minProfitAmount.toString(), "lamports (", minProfitAmount.toNumber() / LAMPORTS_PER_SOL, "SOL)");
    console.log(" - Slippage tolerance:", slippageBps / 100, "%");
    
    // 1. Get initial balance (0 in simulation)
    
    // 2. Simulate flash loan
    console.log(" 1. Initiating flash loan of", slippageLoanAmount.toNumber() / LAMPORTS_PER_SOL, "SOL");
    
    // 3. Simulate first swap (DEX A) with slippage
    const baseRateA = 1.05;
    const slippageFactorA = 1 - (slippageBps / 10000);
    const effectiveRateA = baseRateA * slippageFactorA;
    const slippageDexAOutput = Math.floor(slippageLoanAmount.toNumber() * effectiveRateA);
    console.log(" 2. Executing swap on DEX A (rate: " + baseRateA + ", with slippage: " + effectiveRateA.toFixed(4) + "):");
    console.log("    Input:", slippageLoanAmount.toNumber() / LAMPORTS_PER_SOL, "SOL");
    console.log("    Output:", slippageDexAOutput / LAMPORTS_PER_SOL, "intermediate tokens");
    
    // 4. Simulate second swap (DEX B) with slippage
    const baseRateB = 1.02;
    const slippageFactorB = 1 - (slippageBps / 10000);
    const effectiveRateB = baseRateB * slippageFactorB;
    const slippageDexBOutput = Math.floor(slippageDexAOutput * effectiveRateB);
    console.log(" 3. Executing swap on DEX B (rate: " + baseRateB + ", with slippage: " + effectiveRateB.toFixed(4) + "):");
    console.log("    Input:", slippageDexAOutput / LAMPORTS_PER_SOL, "intermediate tokens");
    console.log("    Output:", slippageDexBOutput / LAMPORTS_PER_SOL, "SOL");
    
    // 5. Calculate loan repayment
    const slippageLoanFee = Math.floor(slippageLoanAmount.toNumber() * 0.003);
    const slippageRepaymentAmount = slippageLoanAmount.toNumber() + slippageLoanFee;
    console.log(" 4. Repaying flash loan:");
    console.log("    Principal:", slippageLoanAmount.toNumber() / LAMPORTS_PER_SOL, "SOL");
    console.log("    Fee:", slippageLoanFee / LAMPORTS_PER_SOL, "SOL");
    console.log("    Total repayment:", slippageRepaymentAmount / LAMPORTS_PER_SOL, "SOL");
    
    // 6. Calculate profit
    const slippageProfit = slippageDexBOutput - slippageRepaymentAmount;
    const slippageProfitPercentage = (slippageProfit / slippageLoanAmount.toNumber()) * 100;
    
    console.log("\nSimulation Results with Slippage:");
    console.log(" - Final balance after swaps:", slippageDexBOutput / LAMPORTS_PER_SOL, "SOL");
    console.log(" - Repayment amount:", slippageRepaymentAmount / LAMPORTS_PER_SOL, "SOL");
    console.log(" - Profit:", slippageProfit / LAMPORTS_PER_SOL, "SOL");
    console.log(" - Profit percentage:", slippageProfitPercentage.toFixed(2) + "%");
    console.log(" - Profit reduction due to slippage:", 
      ((largerProfit - slippageProfit) / LAMPORTS_PER_SOL).toFixed(4), "SOL (",
      ((largerProfit - slippageProfit) / largerProfit * 100).toFixed(2), "% less)");
    
    if (slippageProfit >= minProfitAmount.toNumber()) {
      console.log("\n✅ Transaction would still be PROFITABLE despite slippage");
    } else {
      console.log("\n❌ Transaction would NOT be profitable enough due to slippage");
      console.log("   Minimum required profit:", minProfitAmount.toNumber() / LAMPORTS_PER_SOL, "SOL");
    }
    
    console.log("\n----- Summary of All Simulations -----");
    console.log("1. Basic simulation (1 SOL loan):");
    console.log("   - Profit: ", (profit / LAMPORTS_PER_SOL).toFixed(4), "SOL (", profitPercentage.toFixed(2), "%)");
    
    console.log("2. Larger loan simulation (10 SOL loan):");
    console.log("   - Profit: ", (largerProfit / LAMPORTS_PER_SOL).toFixed(4), "SOL (", largerProfitPercentage.toFixed(2), "%)");
    
    console.log("3. With slippage simulation (10 SOL loan with", slippageBps / 100, "% slippage):");
    console.log("   - Profit: ", (slippageProfit / LAMPORTS_PER_SOL).toFixed(4), "SOL (", slippageProfitPercentage.toFixed(2), "%)");
    
    console.log("\nConclusions:");
    console.log("- Larger loan amounts yield proportionally larger profits");
    console.log("- Slippage reduces profitability and must be accounted for");
    console.log("- The flash loan fee (0.3%) affects overall profitability");
    console.log("- Price discrepancies between DEXes need to be significant enough to cover fees and slippage");

    console.log("\nNote: This is a client-side simulation that mimics the contract's simulate_arbitrage function.");
    console.log("In a production environment, you would use real DEXes and lending protocols with actual price data.");
    console.log("Price discrepancies between DEXes create arbitrage opportunities, but they're typically small");
    console.log("and require larger loan amounts to generate significant profits.");
    
  } catch (error) {
    console.error("Error during simulation:", error);
  }
}

main().then(
  () => process.exit(0),
  err => {
    console.error(err);
    process.exit(1);
  }
); 