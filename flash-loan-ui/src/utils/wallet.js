import { Keypair } from '@solana/web3.js';
import { useEffect, useState } from 'react';

// Constants
const STORAGE_KEY = 'deploymentWallet';

/**
 * Load a wallet from local storage
 * @returns {Keypair|null} The Keypair object if found, or null
 */
export const loadPersistedWallet = () => {
  try {
    const storedWallet = localStorage.getItem(STORAGE_KEY);
    if (!storedWallet) return null;
    
    const secretKey = JSON.parse(storedWallet);
    return Keypair.fromSecretKey(
      Uint8Array.from(Object.values(secretKey))
    );
  } catch (error) {
    console.error('Error loading wallet from localStorage:', error);
    return null;
  }
};

/**
 * Custom hook to use a persisted wallet
 * @returns {Object} Wallet state and functions
 */
export const usePersistedWallet = () => {
  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load wallet on component mount
  useEffect(() => {
    try {
      const loadedWallet = loadPersistedWallet();
      setWallet(loadedWallet);
    } catch (error) {
      console.error('Error in usePersistedWallet:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Create and persist a new wallet
  const createAndPersistWallet = () => {
    try {
      const newWallet = Keypair.generate();
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(Array.from(newWallet.secretKey))
      );
      setWallet(newWallet);
      return newWallet;
    } catch (error) {
      console.error('Error creating wallet:', error);
      return null;
    }
  };

  return {
    wallet,
    loading,
    createAndPersistWallet
  };
};

/**
 * Persist an existing wallet keypair to localStorage
 * @param {Keypair} keypair - The Solana keypair to persist
 * @returns {boolean} Success flag
 */
export const persistExistingWallet = (keypair) => {
  try {
    if (!keypair) return false;
    
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(Array.from(keypair.secretKey))
    );
    return true;
  } catch (error) {
    console.error('Error persisting wallet:', error);
    return false;
  }
}; 