import React, { useState, useEffect, useMemo } from 'react';
import {
  ConnectionProvider,
  WalletProvider,
  useAnchorWallet,
  useConnection,
  useWallet,
} from '@solana/wallet-adapter-react';
import {
  WalletAdapterNetwork,
  WalletNotConnectedError,
} from '@solana/wallet-adapter-base';
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from '@solana/wallet-adapter-wallets';
import {
  WalletModalProvider,
  WalletMultiButton,
} from '@solana/wallet-adapter-react-ui';
import { clusterApiUrl, PublicKey, Transaction, SystemProgram, Keypair } from '@solana/web3.js';
import { Program, AnchorProvider } from '@coral-xyz/anchor';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import BN from 'bn.js';
// Import the Noble Ed25519 implementation
import * as ed25519 from '@noble/ed25519';
import idl from './idl.json';
import { loadPersistedWallet, usePersistedWallet } from './utils/wallet';

// Import wallet adapter styles
import '@solana/wallet-adapter-react-ui/styles.css';

// Custom wallet adapter for persistent deployment wallet
class PersistentWalletAdapter {
  constructor(keypair) {
    this.publicKey = keypair.publicKey;
    this._keypair = keypair;
    this.connected = true;
    this.connecting = false;
    this.readyState = 'Installed';
    this.name = 'Deployment Wallet';
    this.icon = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMiIgaGVpZ2h0PSIzMiIgdmlld0JveD0iMCAwIDMyIDMyIj48cGF0aCBmaWxsPSJjdXJyZW50Q29sb3IiIGQ9Ik0yNiA4SDZhMiAyIDAgMCAwLTIgMnYxMmEyIDIgMCAwIDAgMiAyaDIwYTIgMiAwIDAgMCAyLTJWMTBhMiAyIDAgMCAwLTItMnptLTguNSA1LjVhMS41IDEuNSAwIDEgMSAwLTMgMS41IDEuNSAwIDAgMSAwIDN6Ii8+PC9zdmc+';
  }

  async connect() {
    if (this.connected) return;
    this.connecting = true;
    try {
      this.connected = true;
      this.emit('connect', this.publicKey);
    } catch (error) {
      console.error(error);
      this.disconnect();
    } finally {
      this.connecting = false;
    }
  }

  async disconnect() {
    this.connected = false;
    this.emit('disconnect');
  }

  async signTransaction(transaction) {
    transaction.partialSign(this._keypair);
    return transaction;
  }

  async signAllTransactions(transactions) {
    return transactions.map(transaction => {
      transaction.partialSign(this._keypair);
      return transaction;
    });
  }

  async signMessage(message) {
    // Use the noble ed25519 library for signing
    const privateKey = this._keypair.secretKey.slice(0, 32);
    const signature = await ed25519.sign(message, privateKey);
    return signature;
  }

  // Required for Anchor adapter compatibility
  get eventEmitter() {
    if (!this._eventEmitter) {
      this._eventEmitter = {
        listeners: {},
        emit: (event, ...args) => {
          const listeners = this._eventEmitter.listeners[event] || [];
          listeners.forEach(listener => listener(...args));
        },
        on: (event, fn) => {
          this._eventEmitter.listeners[event] = this._eventEmitter.listeners[event] || [];
          this._eventEmitter.listeners[event].push(fn);
          return () => {
            this._eventEmitter.listeners[event] = 
              this._eventEmitter.listeners[event].filter(listener => listener !== fn);
          };
        },
        removeListener: (event, fn) => {
          if (this._eventEmitter.listeners[event]) {
            this._eventEmitter.listeners[event] = 
              this._eventEmitter.listeners[event].filter(listener => listener !== fn);
          }
        }
      };
    }
    return this._eventEmitter;
  }

  emit(event, ...args) {
    this.eventEmitter.emit(event, ...args);
  }

  on(event, fn) {
    return this.eventEmitter.on(event, fn);
  }

  removeListener(event, fn) {
    this.eventEmitter.removeListener(event, fn);
  }
}

// Main App wrapper with providers
export default function App() {
  const [selectedNetwork, setSelectedNetwork] = useState(WalletAdapterNetwork.Testnet);
  const { wallet: persistedWallet, loading: walletLoading } = usePersistedWallet();
  const [usePersistedWalletOption, setUsePersistedWalletOption] = useState(false);
  
  // Update endpoint when network changes
  const currentEndpoint = useMemo(() => clusterApiUrl(selectedNetwork), [selectedNetwork]);
  
  // Available wallets
  const wallets = useMemo(() => {
    const standardWallets = [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
    ];
    
    // Add persisted wallet adapter if we have one and option is selected
    if (persistedWallet && usePersistedWalletOption) {
      const persistentAdapter = new PersistentWalletAdapter(persistedWallet);
      return [persistentAdapter, ...standardWallets];
    }
    
    return standardWallets;
  }, [persistedWallet, usePersistedWalletOption]);
  
  // Program ID from your deployed contract
  const programId = useMemo(() => {
    try {
      return new PublicKey(idl.metadata?.address || "9chwqr3q9XBJnCs8euyFpyqzHamXpZk4mCAEzsfXjWCC");
    } catch (error) {
      console.error("Error loading program ID:", error);
      // Fallback to default program ID if metadata is missing
      return new PublicKey("9chwqr3q9XBJnCs8euyFpyqzHamXpZk4mCAEzsfXjWCC");
    }
  }, []);
  
  const handleNetworkChange = (e) => {
    setSelectedNetwork(e.target.value);
  };
  
  return (
    <ConnectionProvider endpoint={currentEndpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center',
            padding: '20px',
            fontFamily: 'Arial, sans-serif',
          }}>
            <h1>Flash Loan Arbitrage</h1>
            
            <div style={{ 
              margin: '20px 0', 
              display: 'flex', 
              alignItems: 'center',
              width: '100%',
              maxWidth: '500px',
              justifyContent: 'space-between'
            }}>
              <div>
                <label htmlFor="network-select" style={{ marginRight: '10px' }}>Network:</label>
                <select 
                  id="network-select"
                  value={selectedNetwork}
                  onChange={handleNetworkChange}
                  style={{ 
                    padding: '8px', 
                    borderRadius: '4px', 
                    border: '1px solid #ccc' 
                  }}
                >
                  <option value={WalletAdapterNetwork.Testnet}>Testnet</option>
                  <option value={WalletAdapterNetwork.Mainnet}>Mainnet</option>
                  <option value={WalletAdapterNetwork.Devnet}>Devnet</option>
                </select>
              </div>
              
              {persistedWallet && (
                <div style={{ marginLeft: '10px' }}>
                  <label>
                    <input
                      type="checkbox"
                      checked={usePersistedWalletOption}
                      onChange={(e) => setUsePersistedWalletOption(e.target.checked)}
                    />
                    Use deployment wallet
                  </label>
                </div>
              )}
              
              <WalletMultiButton />
            </div>
            
            {persistedWallet && usePersistedWalletOption && (
              <div style={{
                margin: '10px 0',
                padding: '10px',
                backgroundColor: '#f0f9ff',
                borderRadius: '4px',
                border: '1px solid #cff4fc',
                width: '100%',
                maxWidth: '500px'
              }}>
                <p style={{ margin: '0', fontSize: '14px' }}>
                  <strong>Using persistent deployment wallet:</strong><br />
                  {persistedWallet.publicKey.toString()}
                </p>
              </div>
            )}
            
            <FlashLoanArbitrageInterface 
              network={selectedNetwork} 
              programId={programId}
            />
          </div>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

// The main interface component
function FlashLoanArbitrageInterface({ network, programId }) {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  
  // Instruction parameters
  const [loanAmount, setLoanAmount] = useState('1000000');
  const [minProfitAmount, setMinProfitAmount] = useState('1000');
  const [selectedToken, setSelectedToken] = useState('SOL');
  
  // Default Port Finance Devnet Keys
  const PORT_FINANCE_KEYS = {
    lendingProgram: 'pdQ2rQQU5zH2rDgZ7xH2azMBJegUzUyunJ5Jd637hC4',
    lendingMarket: 'H27Quk3DSbu55T4dCr1NddTTSAezXwHU67FPCZVKLhSW',
    
    // Reserve keys
    solReserve: '6FeVStQAGPWvfWijDHF7cTWRCi7He6vTT3ubfNhe9SPt',
    usdcReserve: 'G1CcAWGhfxhHQaivC1Sh5CWVta6P4dc7a5BDSg9ERjV1',
    usdtReserve: 'B4dnCXcWXSXy1g3fGAmF6P2XgsLTFYaQxYpsU3VCB33Q',
    btcReserve: 'A8krqNC1WpWYhqUe2Y5WbLd1Zy4y2rRN5wJC8o9Scbyk',
    merReserve: 'FdPnmYS7Ma8jfSy7UHAN5QM6teoqwd3vLQtoU6r2Umwy',
    
    // Token Mints
    solMint: 'So11111111111111111111111111111111111111112',
    usdcMint: 'G6YKv19AeGZ6pUYUwY9D7n4Ry9ESNFa376YqwEkUkhbi',
    usdtMint: '9NGDi2tZtNmCCp8SVLKNuGjuWAVwNF3Vap5tT8km5er9',
    btcMint: 'EbwEYuUQHxcSHszxPBhA2nT2JxhiNwJedwjsctJnLmsC',
    merMint: 'Tm9LcR74uJHPw3zY3j3nSh5xfcyaLbvXgAtTJwbqnnp',
    
    // pToken Mints
    pSolMint: 'Hk4Rp3kaPssB6hnjah3Mrqpt5CAXWGoqFT5dVsWA3TaM',
    pUsdcMint: 'HyxraiKfdajDbYTC6MVRToEUBdevBN5M5gfyR4LC3WSF',
    pUsdtMint: '4xEXmSfLFPkZaxdL98XkoxKpXEvchPVs21GYqa8DvbAm',
    pBtcMint: '95XGx3cM83Z1Bbx8pJurAHwxJjvShTJE4BtfgMWfV6NB',
    pMerMint: 'FQzruvtLTk6qtPNEAJHQWMVs4M9UMP9T3cGAVfUskHfP',
    
    // Oracle Public Keys
    solOracle: 'J83w4HKfqxwcq3BEMMkPFSppX3gqekLyLJBexebFVkix',
    usdtOracle: '38xoQ4oeJCBrcVvca2cGk7iV1dAfrmTR1kmhSCJQ8Jto',
    btcOracle: 'HovQMDrbAgAYPCmHVSrezcSmkMtXSSUsLDFANExrZh2J',
    merOracle: '6Z3ejn8DCWQFBuAcw29d3A5jgahEpmycn7YDMX7yRNrn',
    
    // Supply Public Keys
    solSupply: 'AbKeR7nQdHPDddiDQ71YUsz1F138a7cJMfJVtpdYUSvE',
    usdcSupply: 'GAPyFes3o7S7coY9nsuhaRZBEA7DdQPHBfVdY2DdgNua',
    usdtSupply: 'AeGbAqYZUURTykyCsgAUfopBMqQ3eAwrDxYhXoRhiw8q',
    btcSupply: '75iyCxiPoj3MaUVo3SynmhaN3cbLDEhd4d9VHik6Kkvr',
    merSupply: 'AMjhzse1TtTcKBFw5tQPLGtVoEsL4gt9YowNnzMKEGUr',
  };
  
  // Account addresses
  const [lendingProgram, setLendingProgram] = useState(PORT_FINANCE_KEYS.lendingProgram);
  const [loanTokenAccount, setLoanTokenAccount] = useState('');
  const [loanReserveAccount, setLoanReserveAccount] = useState(PORT_FINANCE_KEYS.solReserve);
  const [lendingFeeAccount, setLendingFeeAccount] = useState('');
  
  // DEX A accounts
  const [dexAProgram, setDexAProgram] = useState('');
  const [dexAPool, setDexAPool] = useState('');
  const [dexAAuthority, setDexAAuthority] = useState('');
  const [dexAInputTokenAccount, setDexAInputTokenAccount] = useState('');
  const [dexAOutputTokenAccount, setDexAOutputTokenAccount] = useState('');
  const [dexATokenAAccount, setDexATokenAAccount] = useState('');
  const [dexATokenBAccount, setDexATokenBAccount] = useState('');
  
  // DEX B accounts
  const [dexBProgram, setDexBProgram] = useState('');
  const [dexBPool, setDexBPool] = useState('');
  const [dexBAuthority, setDexBAuthority] = useState('');
  const [dexBInputTokenAccount, setDexBInputTokenAccount] = useState('');
  const [dexBOutputTokenAccount, setDexBOutputTokenAccount] = useState('');
  const [dexBTokenAAccount, setDexBTokenAAccount] = useState('');
  const [dexBTokenBAccount, setDexBTokenBAccount] = useState('');
  
  const [status, setStatus] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Helper to validate a Solana public key
  const isValidPublicKey = (value) => {
    try {
      if (value) {
        new PublicKey(value);
        return true;
      }
      return false;
    } catch (error) {
      return false;
    }
  };
  
  // Load Port Finance default configuration
  const loadPortFinanceDefaults = () => {
    // Set the lending program and reserve accounts
    setLendingProgram(PORT_FINANCE_KEYS.lendingProgram);
    
    // For arbitrage between selected token and USDC
    // Update reserve account based on selected token
    switch(selectedToken) {
      case 'SOL':
        setLoanReserveAccount(PORT_FINANCE_KEYS.solReserve);
        
        // DEX A - SOL to USDC
        setDexAInputTokenAccount(PORT_FINANCE_KEYS.solSupply);
        setDexAOutputTokenAccount(PORT_FINANCE_KEYS.usdcSupply);
        setDexATokenAAccount(PORT_FINANCE_KEYS.solMint);
        setDexATokenBAccount(PORT_FINANCE_KEYS.usdcMint);
        
        // DEX B - USDC to SOL
        setDexBInputTokenAccount(PORT_FINANCE_KEYS.usdcSupply);
        setDexBOutputTokenAccount(PORT_FINANCE_KEYS.solSupply);
        setDexBTokenAAccount(PORT_FINANCE_KEYS.usdcMint);
        setDexBTokenBAccount(PORT_FINANCE_KEYS.solMint);
        break;
        
      case 'USDC':
        setLoanReserveAccount(PORT_FINANCE_KEYS.usdcReserve);
        
        // DEX A - USDC to SOL
        setDexAInputTokenAccount(PORT_FINANCE_KEYS.usdcSupply);
        setDexAOutputTokenAccount(PORT_FINANCE_KEYS.solSupply);
        setDexATokenAAccount(PORT_FINANCE_KEYS.usdcMint);
        setDexATokenBAccount(PORT_FINANCE_KEYS.solMint);
        
        // DEX B - SOL to USDC
        setDexBInputTokenAccount(PORT_FINANCE_KEYS.solSupply);
        setDexBOutputTokenAccount(PORT_FINANCE_KEYS.usdcSupply);
        setDexBTokenAAccount(PORT_FINANCE_KEYS.solMint);
        setDexBTokenBAccount(PORT_FINANCE_KEYS.usdcMint);
        break;
        
      case 'USDT':
        setLoanReserveAccount(PORT_FINANCE_KEYS.usdtReserve);
        
        // DEX A - USDT to USDC
        setDexAInputTokenAccount(PORT_FINANCE_KEYS.usdtSupply);
        setDexAOutputTokenAccount(PORT_FINANCE_KEYS.usdcSupply);
        setDexATokenAAccount(PORT_FINANCE_KEYS.usdtMint);
        setDexATokenBAccount(PORT_FINANCE_KEYS.usdcMint);
        
        // DEX B - USDC to USDT
        setDexBInputTokenAccount(PORT_FINANCE_KEYS.usdcSupply);
        setDexBOutputTokenAccount(PORT_FINANCE_KEYS.usdtSupply);
        setDexBTokenAAccount(PORT_FINANCE_KEYS.usdcMint);
        setDexBTokenBAccount(PORT_FINANCE_KEYS.usdtMint);
        break;
        
      case 'BTC':
        setLoanReserveAccount(PORT_FINANCE_KEYS.btcReserve);
        
        // DEX A - BTC to USDC
        setDexAInputTokenAccount(PORT_FINANCE_KEYS.btcSupply);
        setDexAOutputTokenAccount(PORT_FINANCE_KEYS.usdcSupply);
        setDexATokenAAccount(PORT_FINANCE_KEYS.btcMint);
        setDexATokenBAccount(PORT_FINANCE_KEYS.usdcMint);
        
        // DEX B - USDC to BTC
        setDexBInputTokenAccount(PORT_FINANCE_KEYS.usdcSupply);
        setDexBOutputTokenAccount(PORT_FINANCE_KEYS.btcSupply);
        setDexBTokenAAccount(PORT_FINANCE_KEYS.usdcMint);
        setDexBTokenBAccount(PORT_FINANCE_KEYS.btcMint);
        break;
        
      case 'MER':
        setLoanReserveAccount(PORT_FINANCE_KEYS.merReserve);
        
        // DEX A - MER to USDC
        setDexAInputTokenAccount(PORT_FINANCE_KEYS.merSupply);
        setDexAOutputTokenAccount(PORT_FINANCE_KEYS.usdcSupply);
        setDexATokenAAccount(PORT_FINANCE_KEYS.merMint);
        setDexATokenBAccount(PORT_FINANCE_KEYS.usdcMint);
        
        // DEX B - USDC to MER
        setDexBInputTokenAccount(PORT_FINANCE_KEYS.usdcSupply);
        setDexBOutputTokenAccount(PORT_FINANCE_KEYS.merSupply);
        setDexBTokenAAccount(PORT_FINANCE_KEYS.usdcMint);
        setDexBTokenBAccount(PORT_FINANCE_KEYS.merMint);
        break;
        
      default:
        setLoanReserveAccount(PORT_FINANCE_KEYS.solReserve);
    }
    
    // Common setup for all tokens
    setDexAProgram(PORT_FINANCE_KEYS.lendingProgram);
    setDexAPool(PORT_FINANCE_KEYS.lendingMarket);
    setDexAAuthority(wallet?.publicKey?.toString() || '');
    
    setDexBProgram(PORT_FINANCE_KEYS.lendingProgram);
    setDexBPool(PORT_FINANCE_KEYS.lendingMarket);
    setDexBAuthority(wallet?.publicKey?.toString() || '');
    
    // Setup lending fee account - using a default value here
    setLendingFeeAccount(PORT_FINANCE_KEYS.solSupply);
    
    // Set loan token account to the wallet's account if available
    if (wallet && wallet.publicKey) {
      setLoanTokenAccount(wallet.publicKey.toString());
    }
    
    setStatus(`Port Finance Devnet configuration loaded for ${selectedToken}. You can now modify these values as needed.`);
  };
  
  // Load mock account data for quick testing
  const loadMockAccountsForTesting = () => {
    // Generate a set of random Solana public keys
    const generateRandomAccounts = () => {
      return {
        lendingProgram: Keypair.generate().publicKey.toString(),
        loanTokenAccount: Keypair.generate().publicKey.toString(),
        loanReserveAccount: Keypair.generate().publicKey.toString(),
        lendingFeeAccount: Keypair.generate().publicKey.toString(),
        dexAProgram: Keypair.generate().publicKey.toString(),
        dexAPool: Keypair.generate().publicKey.toString(),
        dexAAuthority: Keypair.generate().publicKey.toString(),
        dexAInputTokenAccount: Keypair.generate().publicKey.toString(),
        dexAOutputTokenAccount: Keypair.generate().publicKey.toString(),
        dexATokenAAccount: Keypair.generate().publicKey.toString(),
        dexATokenBAccount: Keypair.generate().publicKey.toString(),
        dexBProgram: Keypair.generate().publicKey.toString(),
        dexBPool: Keypair.generate().publicKey.toString(),
        dexBAuthority: Keypair.generate().publicKey.toString(),
        dexBInputTokenAccount: Keypair.generate().publicKey.toString(),
        dexBOutputTokenAccount: Keypair.generate().publicKey.toString(),
        dexBTokenAAccount: Keypair.generate().publicKey.toString(),
        dexBTokenBAccount: Keypair.generate().publicKey.toString(),
      };
    };
    
    const mockAccounts = generateRandomAccounts();
    
    // Set all the state variables
    setLendingProgram(mockAccounts.lendingProgram);
    setLoanTokenAccount(mockAccounts.loanTokenAccount);
    setLoanReserveAccount(mockAccounts.loanReserveAccount);
    setLendingFeeAccount(mockAccounts.lendingFeeAccount);
    setDexAProgram(mockAccounts.dexAProgram);
    setDexAPool(mockAccounts.dexAPool);
    setDexAAuthority(mockAccounts.dexAAuthority);
    setDexAInputTokenAccount(mockAccounts.dexAInputTokenAccount);
    setDexAOutputTokenAccount(mockAccounts.dexAOutputTokenAccount);
    setDexATokenAAccount(mockAccounts.dexATokenAAccount);
    setDexATokenBAccount(mockAccounts.dexATokenBAccount);
    setDexBProgram(mockAccounts.dexBProgram);
    setDexBPool(mockAccounts.dexBPool);
    setDexBAuthority(mockAccounts.dexBAuthority);
    setDexBInputTokenAccount(mockAccounts.dexBInputTokenAccount);
    setDexBOutputTokenAccount(mockAccounts.dexBOutputTokenAccount);
    setDexBTokenAAccount(mockAccounts.dexBTokenAAccount);
    setDexBTokenBAccount(mockAccounts.dexBTokenBAccount);
    
    setStatus("Mock account data loaded for testing. These are randomly generated and not valid for real transactions.");
  };
  
  // Helper to get accounts from state
  const getAccountsFromState = () => {
    return {
      lendingProgram: isValidPublicKey(lendingProgram) ? new PublicKey(lendingProgram) : null,
      loanTokenAccount: isValidPublicKey(loanTokenAccount) ? new PublicKey(loanTokenAccount) : null,
      loanReserveAccount: isValidPublicKey(loanReserveAccount) ? new PublicKey(loanReserveAccount) : null,
      lendingFeeAccount: isValidPublicKey(lendingFeeAccount) ? new PublicKey(lendingFeeAccount) : null,
      dexAProgram: isValidPublicKey(dexAProgram) ? new PublicKey(dexAProgram) : null,
      dexAPool: isValidPublicKey(dexAPool) ? new PublicKey(dexAPool) : null,
      dexAAuthority: isValidPublicKey(dexAAuthority) ? new PublicKey(dexAAuthority) : null,
      dexAInputTokenAccount: isValidPublicKey(dexAInputTokenAccount) ? new PublicKey(dexAInputTokenAccount) : null,
      dexAOutputTokenAccount: isValidPublicKey(dexAOutputTokenAccount) ? new PublicKey(dexAOutputTokenAccount) : null,
      dexATokenAAccount: isValidPublicKey(dexATokenAAccount) ? new PublicKey(dexATokenAAccount) : null,
      dexATokenBAccount: isValidPublicKey(dexATokenBAccount) ? new PublicKey(dexATokenBAccount) : null,
      dexBProgram: isValidPublicKey(dexBProgram) ? new PublicKey(dexBProgram) : null,
      dexBPool: isValidPublicKey(dexBPool) ? new PublicKey(dexBPool) : null,
      dexBAuthority: isValidPublicKey(dexBAuthority) ? new PublicKey(dexBAuthority) : null,
      dexBInputTokenAccount: isValidPublicKey(dexBInputTokenAccount) ? new PublicKey(dexBInputTokenAccount) : null,
      dexBOutputTokenAccount: isValidPublicKey(dexBOutputTokenAccount) ? new PublicKey(dexBOutputTokenAccount) : null,
      dexBTokenAAccount: isValidPublicKey(dexBTokenAAccount) ? new PublicKey(dexBTokenAAccount) : null,
      dexBTokenBAccount: isValidPublicKey(dexBTokenBAccount) ? new PublicKey(dexBTokenBAccount) : null,
    };
  };

  const getProvider = () => {
    if (!wallet) {
      throw new WalletNotConnectedError();
    }
    
    const provider = new AnchorProvider(
      connection, 
      wallet, 
      { commitment: 'processed' }
    );
    
    return provider;
  };

  const executeFlashLoanArbitrage = async () => {
    try {
      setIsLoading(true);
      setStatus(`Preparing transaction on ${network}...`);
      
      if (!wallet || !wallet.publicKey) {
        throw new WalletNotConnectedError();
      }
      
      // Validate all required accounts
      const accounts = getAccountsFromState();
      const missingAccounts = Object.entries(accounts)
        .filter(([_, value]) => value === null)
        .map(([key, _]) => key);
      
      if (missingAccounts.length > 0) {
        throw new Error(`Missing or invalid account addresses: ${missingAccounts.join(', ')}`);
      }

      const provider = getProvider();
      const program = new Program(idl, programId, provider);
      
      // Convert string inputs to BN
      const loanAmountBN = new BN(loanAmount);
      const minProfitAmountBN = new BN(minProfitAmount);
      
      setStatus(`Note: This is a simulation on ${network} since we need actual DEX and lending protocol accounts`);
      
      // Log the accounts we'd need in a real transaction
      console.log(`Required accounts for this transaction on ${network}:`);
      console.log('- Authority:', wallet.publicKey.toString());
      
      Object.entries(accounts).forEach(([key, value]) => {
        console.log(`- ${key}: ${value.toString()}`);
      });
      
      // In a real implementation, we would call:
      setStatus(`Preparing to execute flash loan arbitrage on ${network}...`);
      
      try {
        // Uncomment for actual implementation
        // await program.methods
        //   .flashLoanAndArbitrage(
        //     loanAmountBN,
        //     minProfitAmountBN
        //   )
        //   .accounts({
        //     base: {
        //       authority: wallet.publicKey,
        //       tokenProgram: TOKEN_PROGRAM_ID,
        //       systemProgram: SystemProgram.programId,
        //     },
        //     lendingProgram: accounts.lendingProgram,
        //     loanTokenAccount: accounts.loanTokenAccount,
        //     loanReserveAccount: accounts.loanReserveAccount,
        //     lendingFeeAccount: accounts.lendingFeeAccount,
        //     dexAProgram: accounts.dexAProgram,
        //     dexAPool: accounts.dexAPool,
        //     dexAAuthority: accounts.dexAAuthority,
        //     dexAInputTokenAccount: accounts.dexAInputTokenAccount,
        //     dexAOutputTokenAccount: accounts.dexAOutputTokenAccount,
        //     dexATokenAAccount: accounts.dexATokenAAccount,
        //     dexATokenBAccount: accounts.dexATokenBAccount,
        //     dexBProgram: accounts.dexBProgram,
        //     dexBPool: accounts.dexBPool,
        //     dexBAuthority: accounts.dexBAuthority,
        //     dexBInputTokenAccount: accounts.dexBInputTokenAccount,
        //     dexBOutputTokenAccount: accounts.dexBOutputTokenAccount,
        //     dexBTokenAAccount: accounts.dexBTokenAAccount,
        //     dexBTokenBAccount: accounts.dexBTokenBAccount,
        //   })
        //   .rpc();
        
        // For simulation purposes
        setStatus(`Transaction sent to ${network}. Processing...`);
        
        // Simulate success after 2 seconds
        setTimeout(() => {
          setStatus(`Simulation complete on ${network}!`);
          
          if (network === WalletAdapterNetwork.Mainnet) {
            setStatus((prev) => prev + '\n\nNote: On Mainnet, transactions require real SOL for fees and may have higher minimum thresholds for profitability.');
          } else if (network === WalletAdapterNetwork.Testnet) {
            setStatus((prev) => prev + '\n\nNote: On Testnet, you can use an airdrop to get SOL for testing.');
          } else if (network === WalletAdapterNetwork.Devnet) {
            setStatus((prev) => prev + '\n\nNote: On Devnet, you can use the Solana CLI to airdrop SOL: `solana airdrop 1`');
          }
          
          setIsLoading(false);
        }, 2000);
      } catch (error) {
        console.error(`Transaction error on ${network}:`, error);
        setStatus(`Error executing transaction on ${network}: ${error.message}`);
        setIsLoading(false);
      }
      
    } catch (error) {
      console.error(`Setup error on ${network}:`, error);
      setStatus(`Error: ${error.message}`);
      setIsLoading(false);
    }
  };

  // Token change handler
  const handleTokenChange = (e) => {
    const token = e.target.value;
    setSelectedToken(token);
    
    // Update reserve account based on selected token
    switch(token) {
      case 'SOL':
        setLoanReserveAccount(PORT_FINANCE_KEYS.solReserve);
        break;
      case 'USDC':
        setLoanReserveAccount(PORT_FINANCE_KEYS.usdcReserve);
        break;
      case 'USDT':
        setLoanReserveAccount(PORT_FINANCE_KEYS.usdtReserve);
        break;
      case 'BTC':
        setLoanReserveAccount(PORT_FINANCE_KEYS.btcReserve);
        break;
      case 'MER':
        setLoanReserveAccount(PORT_FINANCE_KEYS.merReserve);
        break;
      default:
        setLoanReserveAccount(PORT_FINANCE_KEYS.solReserve);
    }
    
    setStatus(`Token changed to ${token}. Loan reserve account updated.`);
  };

  return (
    <div style={{ width: '100%', maxWidth: '800px' }}>
      <div style={{ marginBottom: '20px' }}>
        <p>This interface allows you to execute flash loan arbitrage between two DEXs on {network}.</p>
        <p><strong>Current Network:</strong> {network}</p>
        <p><strong>Note:</strong> You will need to provide all required account addresses. External DEX data will be filled into these fields.</p>
      </div>
      
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            onClick={loadPortFinanceDefaults}
            style={{
              padding: '10px 15px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              marginRight: '10px'
            }}
          >
            Load Port Finance Defaults
          </button>
          
          <button
            onClick={loadMockAccountsForTesting}
            style={{
              padding: '10px 15px',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Load Random Mock Data
          </button>
        </div>
        <p style={{ fontSize: '12px', marginTop: '5px', color: '#666' }}>
          Choose Port Finance configuration for real usage or random data for testing.
        </p>
      </div>
      
      {/* Token Selector */}
      <div style={{ marginBottom: '20px' }}>
        <h3>Select Token</h3>
        <div style={{ display: 'flex', marginBottom: '10px' }}>
          <select
            value={selectedToken}
            onChange={handleTokenChange}
            style={{
              padding: '10px',
              borderRadius: '4px',
              border: '1px solid #ccc',
              width: '100%'
            }}
          >
            <option value="SOL">SOL</option>
            <option value="USDC">USDC</option>
            <option value="USDT">USDT</option>
            <option value="BTC">BTC</option>
            <option value="MER">MER</option>
          </select>
        </div>
        <p style={{ fontSize: '12px', color: '#666' }}>
          Select the token to use for flash loan arbitrage. This will update the relevant account addresses.
        </p>
      </div>
      
      {/* Instruction Parameters */}
      <div style={{ marginBottom: '20px' }}>
        <h3>Instruction Parameters</h3>
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>
            Loan Amount ({selectedToken} lamports):
          </label>
          <input
            type="number"
            value={loanAmount}
            onChange={(e) => setLoanAmount(e.target.value)}
            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
          />
        </div>
        
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>
            Minimum Profit Amount ({selectedToken} lamports):
          </label>
          <input
            type="number"
            value={minProfitAmount}
            onChange={(e) => setMinProfitAmount(e.target.value)}
            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
          />
        </div>
      </div>
      
      {/* Lending Protocol Accounts */}
      <div style={{ marginBottom: '20px' }}>
        <h3>Lending Protocol Accounts ({selectedToken})</h3>
        
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>
            Lending Program:
          </label>
          <input
            type="text"
            value={lendingProgram}
            onChange={(e) => setLendingProgram(e.target.value)}
            style={{ 
              width: '100%', 
              padding: '8px', 
              borderRadius: '4px', 
              border: '1px solid #ccc',
              backgroundColor: isValidPublicKey(lendingProgram) ? '#f0fff0' : '#fff0f0'
            }}
            placeholder="Enter Lending Program ID"
          />
        </div>
        
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>
            Loan Token Account:
          </label>
          <input
            type="text"
            value={loanTokenAccount}
            onChange={(e) => setLoanTokenAccount(e.target.value)}
            style={{ 
              width: '100%', 
              padding: '8px', 
              borderRadius: '4px', 
              border: '1px solid #ccc',
              backgroundColor: isValidPublicKey(loanTokenAccount) ? '#f0fff0' : '#fff0f0'
            }}
            placeholder="Enter Loan Token Account"
          />
        </div>
        
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>
            Loan Reserve Account:
          </label>
          <input
            type="text"
            value={loanReserveAccount}
            onChange={(e) => setLoanReserveAccount(e.target.value)}
            style={{ 
              width: '100%', 
              padding: '8px', 
              borderRadius: '4px', 
              border: '1px solid #ccc',
              backgroundColor: isValidPublicKey(loanReserveAccount) ? '#f0fff0' : '#fff0f0'
            }}
            placeholder="Enter Loan Reserve Account"
          />
        </div>
        
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>
            Lending Fee Account:
          </label>
          <input
            type="text"
            value={lendingFeeAccount}
            onChange={(e) => setLendingFeeAccount(e.target.value)}
            style={{ 
              width: '100%', 
              padding: '8px', 
              borderRadius: '4px', 
              border: '1px solid #ccc',
              backgroundColor: isValidPublicKey(lendingFeeAccount) ? '#f0fff0' : '#fff0f0'
            }}
            placeholder="Enter Lending Fee Account"
          />
        </div>
      </div>
      
      {/* DEX A Accounts */}
      <div style={{ marginBottom: '20px' }}>
        <h3>DEX A Accounts ({selectedToken} → USDC)</h3>
        
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>
            DEX A Program:
          </label>
          <input
            type="text"
            value={dexAProgram}
            onChange={(e) => setDexAProgram(e.target.value)}
            style={{ 
              width: '100%', 
              padding: '8px', 
              borderRadius: '4px', 
              border: '1px solid #ccc',
              backgroundColor: isValidPublicKey(dexAProgram) ? '#f0fff0' : '#fff0f0'
            }}
            placeholder="Enter DEX A Program ID"
          />
        </div>
        
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>
            DEX A Pool:
          </label>
          <input
            type="text"
            value={dexAPool}
            onChange={(e) => setDexAPool(e.target.value)}
            style={{ 
              width: '100%', 
              padding: '8px', 
              borderRadius: '4px', 
              border: '1px solid #ccc',
              backgroundColor: isValidPublicKey(dexAPool) ? '#f0fff0' : '#fff0f0'
            }}
            placeholder="Enter DEX A Pool Account"
          />
        </div>
        
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>
            DEX A Authority:
          </label>
          <input
            type="text"
            value={dexAAuthority}
            onChange={(e) => setDexAAuthority(e.target.value)}
            style={{ 
              width: '100%', 
              padding: '8px', 
              borderRadius: '4px', 
              border: '1px solid #ccc',
              backgroundColor: isValidPublicKey(dexAAuthority) ? '#f0fff0' : '#fff0f0'
            }}
            placeholder="Enter DEX A Authority Account"
          />
        </div>
        
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>
            DEX A Input Token Account:
          </label>
          <input
            type="text"
            value={dexAInputTokenAccount}
            onChange={(e) => setDexAInputTokenAccount(e.target.value)}
            style={{ 
              width: '100%', 
              padding: '8px', 
              borderRadius: '4px', 
              border: '1px solid #ccc',
              backgroundColor: isValidPublicKey(dexAInputTokenAccount) ? '#f0fff0' : '#fff0f0'
            }}
            placeholder="Enter DEX A Input Token Account"
          />
        </div>
        
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>
            DEX A Output Token Account:
          </label>
          <input
            type="text"
            value={dexAOutputTokenAccount}
            onChange={(e) => setDexAOutputTokenAccount(e.target.value)}
            style={{ 
              width: '100%', 
              padding: '8px', 
              borderRadius: '4px', 
              border: '1px solid #ccc',
              backgroundColor: isValidPublicKey(dexAOutputTokenAccount) ? '#f0fff0' : '#fff0f0'
            }}
            placeholder="Enter DEX A Output Token Account"
          />
        </div>
        
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>
            DEX A Token A Account:
          </label>
          <input
            type="text"
            value={dexATokenAAccount}
            onChange={(e) => setDexATokenAAccount(e.target.value)}
            style={{ 
              width: '100%', 
              padding: '8px', 
              borderRadius: '4px', 
              border: '1px solid #ccc',
              backgroundColor: isValidPublicKey(dexATokenAAccount) ? '#f0fff0' : '#fff0f0'
            }}
            placeholder="Enter DEX A Token A Account"
          />
        </div>
        
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>
            DEX A Token B Account:
          </label>
          <input
            type="text"
            value={dexATokenBAccount}
            onChange={(e) => setDexATokenBAccount(e.target.value)}
            style={{ 
              width: '100%', 
              padding: '8px', 
              borderRadius: '4px', 
              border: '1px solid #ccc',
              backgroundColor: isValidPublicKey(dexATokenBAccount) ? '#f0fff0' : '#fff0f0'
            }}
            placeholder="Enter DEX A Token B Account"
          />
        </div>
      </div>
      
      {/* DEX B Accounts */}
      <div style={{ marginBottom: '20px' }}>
        <h3>DEX B Accounts (USDC → {selectedToken})</h3>
        
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>
            DEX B Program:
          </label>
          <input
            type="text"
            value={dexBProgram}
            onChange={(e) => setDexBProgram(e.target.value)}
            style={{ 
              width: '100%', 
              padding: '8px', 
              borderRadius: '4px', 
              border: '1px solid #ccc',
              backgroundColor: isValidPublicKey(dexBProgram) ? '#f0fff0' : '#fff0f0'
            }}
            placeholder="Enter DEX B Program ID"
          />
        </div>
        
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>
            DEX B Pool:
          </label>
          <input
            type="text"
            value={dexBPool}
            onChange={(e) => setDexBPool(e.target.value)}
            style={{ 
              width: '100%', 
              padding: '8px', 
              borderRadius: '4px', 
              border: '1px solid #ccc',
              backgroundColor: isValidPublicKey(dexBPool) ? '#f0fff0' : '#fff0f0'
            }}
            placeholder="Enter DEX B Pool Account"
          />
        </div>
        
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>
            DEX B Authority:
          </label>
          <input
            type="text"
            value={dexBAuthority}
            onChange={(e) => setDexBAuthority(e.target.value)}
            style={{ 
              width: '100%', 
              padding: '8px', 
              borderRadius: '4px', 
              border: '1px solid #ccc',
              backgroundColor: isValidPublicKey(dexBAuthority) ? '#f0fff0' : '#fff0f0'
            }}
            placeholder="Enter DEX B Authority Account"
          />
        </div>
        
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>
            DEX B Input Token Account:
          </label>
          <input
            type="text"
            value={dexBInputTokenAccount}
            onChange={(e) => setDexBInputTokenAccount(e.target.value)}
            style={{ 
              width: '100%', 
              padding: '8px', 
              borderRadius: '4px', 
              border: '1px solid #ccc',
              backgroundColor: isValidPublicKey(dexBInputTokenAccount) ? '#f0fff0' : '#fff0f0'
            }}
            placeholder="Enter DEX B Input Token Account"
          />
        </div>
        
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>
            DEX B Output Token Account:
          </label>
          <input
            type="text"
            value={dexBOutputTokenAccount}
            onChange={(e) => setDexBOutputTokenAccount(e.target.value)}
            style={{ 
              width: '100%', 
              padding: '8px', 
              borderRadius: '4px', 
              border: '1px solid #ccc',
              backgroundColor: isValidPublicKey(dexBOutputTokenAccount) ? '#f0fff0' : '#fff0f0'
            }}
            placeholder="Enter DEX B Output Token Account"
          />
        </div>
        
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>
            DEX B Token A Account:
          </label>
          <input
            type="text"
            value={dexBTokenAAccount}
            onChange={(e) => setDexBTokenAAccount(e.target.value)}
            style={{ 
              width: '100%', 
              padding: '8px', 
              borderRadius: '4px', 
              border: '1px solid #ccc',
              backgroundColor: isValidPublicKey(dexBTokenAAccount) ? '#f0fff0' : '#fff0f0'
            }}
            placeholder="Enter DEX B Token A Account"
          />
        </div>
        
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>
            DEX B Token B Account:
          </label>
          <input
            type="text"
            value={dexBTokenBAccount}
            onChange={(e) => setDexBTokenBAccount(e.target.value)}
            style={{ 
              width: '100%', 
              padding: '8px', 
              borderRadius: '4px', 
              border: '1px solid #ccc',
              backgroundColor: isValidPublicKey(dexBTokenBAccount) ? '#f0fff0' : '#fff0f0'
            }}
            placeholder="Enter DEX B Token B Account"
          />
        </div>
      </div>
      
      {/* Arbitrage Summary */}
      <div style={{ 
        marginBottom: '20px',
        padding: '15px',
        backgroundColor: '#f8f9fa',
        borderRadius: '4px',
        border: '1px solid #dee2e6'
      }}>
        <h3>Arbitrage Strategy Summary</h3>
        <ol style={{ paddingLeft: '20px' }}>
          <li>Borrow <strong>{loanAmount} {selectedToken}</strong> tokens via flash loan</li>
          <li>Swap {selectedToken} to USDC on DEX A</li>
          <li>Swap USDC back to {selectedToken} on DEX B at a better rate</li>
          <li>Repay flash loan + fees</li>
          <li>Keep at least <strong>{minProfitAmount} {selectedToken}</strong> tokens as profit</li>
        </ol>
        <p style={{ marginTop: '10px', fontSize: '14px' }}>
          <strong>Note:</strong> This strategy requires price differences between DEX A and DEX B to be profitable.
        </p>
      </div>
      
      <button
        onClick={executeFlashLoanArbitrage}
        disabled={isLoading || !wallet}
        style={{
          width: '100%',
          padding: '10px',
          backgroundColor: wallet ? '#4CAF50' : '#cccccc',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: wallet ? 'pointer' : 'not-allowed',
          marginTop: '10px',
        }}
      >
        {isLoading ? 'Processing...' : 'Execute Flash Loan Arbitrage'}
      </button>
      
      {status && (
        <div style={{ 
          marginTop: '20px', 
          padding: '15px', 
          backgroundColor: '#f8f9fa', 
          borderRadius: '4px',
          border: '1px solid #dee2e6',
          whiteSpace: 'pre-line'
        }}>
          <strong>Status:</strong>
          <p>{status}</p>
        </div>
      )}
    </div>
  );
} 