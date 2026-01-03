import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'arbitrage-wallets';

/**
 * Hook for managing wallet addresses (localStorage)
 * Supports separate addresses for Opinion and Polymarket
 */
export function useWallet() {
  const [wallet, setWalletState] = useState({
    opinion: '',
    poly: ''
  });

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setWalletState({
          opinion: parsed.opinion || '',
          poly: parsed.poly || ''
        });
      }
    } catch (e) {
      console.error('Failed to load wallet from localStorage:', e);
    }
  }, []);

  // Save to localStorage
  const setWallet = useCallback((updates) => {
    setWalletState(prev => {
      const next = { ...prev, ...updates };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch (e) {
        console.error('Failed to save wallet to localStorage:', e);
      }
      return next;
    });
  }, []);

  // Clear wallet addresses
  const clearWallet = useCallback(() => {
    setWalletState({ opinion: '', poly: '' });
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.error('Failed to clear wallet from localStorage:', e);
    }
  }, []);

  // Check if wallets are configured
  const isConfigured = wallet.opinion || wallet.poly;

  return {
    wallet,
    setWallet,
    clearWallet,
    isConfigured
  };
}

export default useWallet;
