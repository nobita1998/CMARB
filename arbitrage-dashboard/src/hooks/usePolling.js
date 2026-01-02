import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchPrices as fetchOpinionPrices, testConnection as testOpinion } from '../api/opinion';
import { fetchPrices as fetchPolyPrices, testConnection as testPoly } from '../api/polymarket';
import { getOpinionMarkets, getPolyMarkets, config } from '../config/markets';

/**
 * Build list of all outcomes to poll
 * Each outcome will be polled separately in rotation
 */
function buildOutcomeList() {
  const outcomes = [];

  for (const market of config.markets) {
    const marketOutcomes = market.outcomes || [];
    for (const outcome of marketOutcomes) {
      outcomes.push({
        eventId: market.id,
        eventName: market.name,
        outcome,
        opinionTokens: market.opinion?.tokenIds?.[outcome],
        polySlug: market.poly?.slug
      });
    }
  }

  return outcomes;
}

/**
 * Hook for polling price data from both platforms
 * Batches multiple markets per poll cycle to respect rate limits
 *
 * @returns {Object} { prices, loading, error, lastUpdate, connectionStatus, pollingInfo }
 */
export function usePolling() {
  const [prices, setPrices] = useState({
    opinion: new Map(),
    poly: new Map()
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState({
    opinion: 'connecting',
    poly: 'connecting'
  });
  const [pollingInfo, setPollingInfo] = useState({ current: 0, total: 0, markets: [] });

  const intervalRef = useRef(null);
  const isMountedRef = useRef(true);
  const outcomeIndexRef = useRef(0);
  const outcomesRef = useRef([]);

  // Get API key from environment
  const apiKey = import.meta.env.VITE_OPINION_API_KEY;

  // Calculate batch size based on rate limit
  // Each market needs ~4 requests (Opinion YES/NO + Poly YES/NO)
  const { maxRequestsPerBatch, requestsPerMarket, pollingInterval } = config.settings;
  const marketsPerBatch = Math.floor(maxRequestsPerBatch / requestsPerMarket); // 10/4 = 2 markets per batch

  // Fetch a batch of outcomes
  const fetchBatch = useCallback(async (outcomes) => {
    if (!isMountedRef.current || outcomes.length === 0) return;

    // Update polling info
    const marketNames = outcomes.map(o => o.outcome);
    setPollingInfo(prev => ({
      ...prev,
      markets: marketNames
    }));

    try {
      // Build configs for all outcomes in batch
      const opinionConfigs = [];
      const polyConfigs = [];

      for (const { eventId, outcome, opinionTokens, polySlug } of outcomes) {
        if (opinionTokens) {
          opinionConfigs.push({
            eventId,
            outcomeIds: { [outcome]: opinionTokens }
          });
        }
        if (polySlug) {
          polyConfigs.push({
            eventId,
            slug: polySlug,
            outcomeFilter: outcome
          });
        }
      }

      // Fetch from both platforms in parallel
      const [opinionResult, polyResult] = await Promise.allSettled([
        opinionConfigs.length > 0 ? fetchOpinionPrices(opinionConfigs, apiKey) : Promise.resolve(new Map()),
        polyConfigs.length > 0 ? fetchPolyPrices(polyConfigs) : Promise.resolve(new Map())
      ]);

      if (!isMountedRef.current) return;

      // Merge new prices with existing
      setPrices(prev => {
        const newOpinion = new Map(prev.opinion);
        const newPoly = new Map(prev.poly);

        if (opinionResult.status === 'fulfilled') {
          for (const [key, value] of opinionResult.value) {
            newOpinion.set(key, value);
          }
        }

        if (polyResult.status === 'fulfilled') {
          for (const [key, value] of polyResult.value) {
            newPoly.set(key, value);
          }
        }

        return { opinion: newOpinion, poly: newPoly };
      });

      // Update connection status
      const opinionOk = opinionResult.status === 'fulfilled' && opinionResult.value.size > 0;
      const polyOk = polyResult.status === 'fulfilled' && polyResult.value.size > 0;

      setConnectionStatus(prev => ({
        opinion: opinionOk ? 'connected' : prev.opinion,
        poly: polyOk ? 'connected' : prev.poly
      }));

      setLastUpdate(new Date());
      setError(null);

    } catch (err) {
      if (!isMountedRef.current) return;
      console.error('Batch polling error:', err);
    }
  }, [apiKey]);

  // Fetch all outcomes initially
  const fetchAllOutcomes = useCallback(async () => {
    if (!isMountedRef.current) return;

    const opinionMarkets = getOpinionMarkets();
    const polyMarkets = getPolyMarkets();

    if (opinionMarkets.length === 0 && polyMarkets.length === 0) {
      setLoading(false);
      setError('No markets configured. Please add market mappings to src/config/markets.js');
      return;
    }

    try {
      const [opinionResult, polyResult] = await Promise.allSettled([
        fetchOpinionPrices(opinionMarkets, apiKey),
        fetchPolyPrices(polyMarkets)
      ]);

      if (!isMountedRef.current) return;

      const newOpinionPrices = opinionResult.status === 'fulfilled'
        ? opinionResult.value
        : new Map();

      const newPolyPrices = polyResult.status === 'fulfilled'
        ? polyResult.value
        : new Map();

      setPrices({
        opinion: newOpinionPrices,
        poly: newPolyPrices
      });

      // Update connection status - only set error if request actually failed
      setConnectionStatus(prev => ({
        opinion: opinionResult.status === 'fulfilled'
          ? (newOpinionPrices.size > 0 ? 'connected' : prev.opinion)
          : 'error',
        poly: polyResult.status === 'fulfilled'
          ? (newPolyPrices.size > 0 ? 'connected' : prev.poly)
          : 'error'
      }));

      setLastUpdate(new Date());
      setError(null);
      setLoading(false);

    } catch (err) {
      if (!isMountedRef.current) return;
      console.error('Initial load error:', err);
      setError(err.message || 'Failed to fetch data');
      setLoading(false);
    }
  }, [apiKey]);

  // Poll next batch in rotation
  const pollNextBatch = useCallback(() => {
    const outcomes = outcomesRef.current;
    if (outcomes.length === 0) return;

    const startIndex = outcomeIndexRef.current;
    const endIndex = Math.min(startIndex + marketsPerBatch, outcomes.length);
    const batch = outcomes.slice(startIndex, endIndex);

    // Update index for next batch
    outcomeIndexRef.current = endIndex >= outcomes.length ? 0 : endIndex;

    // Update polling info
    setPollingInfo({
      current: startIndex,
      total: outcomes.length,
      markets: batch.map(o => o.outcome)
    });

    fetchBatch(batch);
  }, [fetchBatch, marketsPerBatch]);

  // Test connections on mount
  useEffect(() => {
    async function checkConnections() {
      const [opinionOk, polyOk] = await Promise.all([
        apiKey ? testOpinion(apiKey) : Promise.resolve(false),
        testPoly()
      ]);

      if (!isMountedRef.current) return;

      setConnectionStatus({
        opinion: opinionOk ? 'connected' : 'disconnected',
        poly: polyOk ? 'connected' : 'disconnected'
      });
    }

    checkConnections();
  }, [apiKey]);

  // Initial fetch and start polling
  useEffect(() => {
    isMountedRef.current = true;
    outcomesRef.current = buildOutcomeList();

    // Update total count
    setPollingInfo(prev => ({
      ...prev,
      total: outcomesRef.current.length
    }));

    // Fetch all outcomes initially
    fetchAllOutcomes();

    // Start batch polling after initial load
    const startPollingTimeout = setTimeout(() => {
      intervalRef.current = setInterval(pollNextBatch, pollingInterval);
    }, pollingInterval);

    // Cleanup
    return () => {
      isMountedRef.current = false;
      clearTimeout(startPollingTimeout);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchAllOutcomes, pollNextBatch, pollingInterval]);

  // Manual refetch function (fetches all)
  const refetch = useCallback(() => {
    setLoading(true);
    fetchAllOutcomes();
  }, [fetchAllOutcomes]);

  return {
    prices,
    loading,
    error,
    lastUpdate,
    connectionStatus,
    pollingInfo,
    refetch
  };
}

export default usePolling;
