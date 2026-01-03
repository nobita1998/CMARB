import { useState, useEffect, useCallback, useMemo } from 'react';
import { fetchAllPositions } from '../api/positions';
import { config } from '../config/markets';
import { calcOpinionTradeFee } from '../utils/fees';

// Polling interval for positions (30 seconds)
const POSITIONS_POLL_INTERVAL = 30000;

/**
 * Extract number from outcome string (e.g., ">$8m" -> "8", ">$15m" -> "15")
 */
function extractNumber(str) {
  const match = str.match(/(\d+)/);
  return match ? match[1] : null;
}

/**
 * Build a lookup map from tokenId to market/outcome info
 */
function buildTokenMap() {
  const map = new Map();

  for (const market of config.markets) {
    if (!market.opinion?.tokenIds) continue;

    for (const [outcome, tokens] of Object.entries(market.opinion.tokenIds)) {
      if (tokens.yes) {
        map.set(tokens.yes, {
          marketId: market.id,
          marketName: market.name,
          outcome,
          side: 'yes',
          platform: 'opinion'
        });
      }
      if (tokens.no) {
        map.set(tokens.no, {
          marketId: market.id,
          marketName: market.name,
          outcome,
          side: 'no',
          platform: 'opinion'
        });
      }
    }
  }

  return map;
}

/**
 * Hook for monitoring user positions and calculating exit profits
 *
 * @param {Object} wallet - { opinion: string, poly: string }
 * @param {string} apiKey - Opinion API key
 * @param {Object} prices - { opinion: Map, poly: Map } from usePolling
 * @param {number} exitThreshold - Minimum exit price sum (e.g., 0.98 = 98 cents)
 * @param {number} shareThreshold - Minimum shares to consider a position (default 10)
 * @returns {Object} { positions, arbitragePositions, loading, error, refresh }
 */
export function usePositions(wallet, apiKey, prices, exitThreshold = 0.98, shareThreshold = 10) {
  const [positions, setPositions] = useState({ opinion: [], poly: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);

  // Token lookup map
  const tokenMap = useMemo(() => buildTokenMap(), []);

  // Fetch positions
  const fetchPositions = useCallback(async () => {
    if (!wallet.opinion && !wallet.poly) {
      setPositions({ opinion: [], poly: [] });
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await fetchAllPositions(wallet, apiKey);
      setPositions(result);
      setLastUpdate(Date.now());
    } catch (e) {
      console.error('Failed to fetch positions:', e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [wallet, apiKey]);

  // Initial fetch and polling
  useEffect(() => {
    if (!wallet.opinion && !wallet.poly) return;

    fetchPositions();

    const interval = setInterval(fetchPositions, POSITIONS_POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchPositions, wallet.opinion, wallet.poly]);

  // Match positions to markets (filter by shareThreshold)
  const matchedPositions = useMemo(() => {
    const matched = new Map(); // key: "marketId-outcome"

    // Process Opinion positions
    for (const pos of positions.opinion) {
      // Skip positions below threshold
      if (pos.shares < shareThreshold) continue;

      const tokenInfo = tokenMap.get(pos.tokenId);
      if (!tokenInfo) continue;

      const key = `${tokenInfo.marketId}-${tokenInfo.outcome}`;
      if (!matched.has(key)) {
        matched.set(key, {
          marketId: tokenInfo.marketId,
          marketName: tokenInfo.marketName,
          outcome: tokenInfo.outcome,
          opinion: { yes: null, no: null },
          poly: { yes: null, no: null }
        });
      }

      const entry = matched.get(key);
      entry.opinion[tokenInfo.side] = {
        shares: pos.shares,
        avgPrice: pos.avgPrice,
        tokenId: pos.tokenId
      };
    }

    // Process Polymarket positions
    for (const pos of positions.poly) {
      // Skip positions below threshold
      if (pos.shares < shareThreshold) continue;

      // Try to match by event slug (API returns eventSlug for parent event)
      const market = config.markets.find(m =>
        m.poly?.slug && (
          pos.eventSlug === m.poly.slug ||
          pos.marketSlug?.includes(m.poly.slug)
        )
      );

      if (!market) {
        console.log('Poly position not matched to market:', pos.eventSlug, pos.marketSlug, pos.marketTitle);
        continue;
      }

      // Try to match outcome by title (e.g., "Will Grok win..." -> "Grok")
      const posTitle = pos.marketTitle?.toLowerCase() || '';
      const outcome = market.outcomes.find(o => {
        // Direct substring match
        if (posTitle.includes(o.toLowerCase())) return true;

        // Extract number for fuzzy match (e.g., ">$8m" matches "over $8 million")
        const num = extractNumber(o);
        if (num) {
          return posTitle.includes(`$${num}`) ||
                 posTitle.includes(`${num} million`);
        }
        return false;
      });

      if (!outcome) {
        console.log('Poly position outcome not matched:', posTitle, market.outcomes);
        continue;
      }

      console.log('Poly position matched:', market.id, outcome, pos.side, pos.shares);

      const key = `${market.id}-${outcome}`;
      if (!matched.has(key)) {
        matched.set(key, {
          marketId: market.id,
          marketName: market.name,
          outcome,
          opinion: { yes: null, no: null },
          poly: { yes: null, no: null }
        });
      }

      const entry = matched.get(key);
      entry.poly[pos.side] = {
        shares: pos.shares,
        avgPrice: pos.avgPrice,
        tokenId: pos.tokenId
      };
    }

    return matched;
  }, [positions, tokenMap, shareThreshold]);

  // Calculate exit profit for arbitrage pairs
  const arbitragePositions = useMemo(() => {
    const result = new Map();

    for (const [key, entry] of matchedPositions) {
      // Check for arbitrage pair: Opinion YES + Poly NO
      const hasArb1 = entry.opinion?.yes && entry.poly?.no;
      // Or: Poly YES + Opinion NO
      const hasArb2 = entry.poly?.yes && entry.opinion?.no;

      if (!hasArb1 && !hasArb2) continue;

      // Get current prices
      const priceKey = key;
      const priceKeyNo = `${key}-NO`;
      const opinionYesPrice = prices.opinion?.get(priceKey);
      const opinionNoPrice = prices.opinion?.get(priceKeyNo);
      const polyYesPrice = prices.poly?.get(priceKey);
      const polyNoPrice = prices.poly?.get(priceKeyNo);

      let exitProfit = null;

      if (hasArb1 && opinionYesPrice && polyNoPrice) {
        // Strategy 1: Sell Opinion YES + Sell Poly NO
        const opinionYesShares = entry.opinion.yes.shares;
        const polyNoShares = entry.poly.no.shares;
        const shares = Math.min(opinionYesShares, polyNoShares);

        // Entry prices (from position data)
        const opinionYesAvg = entry.opinion.yes.avgPrice || 0;
        const polyNoAvg = entry.poly.no.avgPrice || 0;

        // Entry cost = raw cost + Opinion buy fee
        const entryCost = (opinionYesAvg + polyNoAvg) * shares;
        const entryFee = calcOpinionTradeFee(opinionYesAvg, shares).actualFee;

        // Exit value (sell at bid prices)
        const opinionYesBid = opinionYesPrice.bid || opinionYesPrice.price || 0;
        const polyNoBid = polyNoPrice.bid || polyNoPrice.price || 0;
        const exitValue = (opinionYesBid + polyNoBid) * shares;
        const exitFee = calcOpinionTradeFee(opinionYesBid, shares).actualFee;

        // Net profit = exit - exitFee - entry - entryFee
        const netProfit = exitValue - exitFee - entryCost - entryFee;
        const profitPct = (entryCost + entryFee) > 0 ? netProfit / (entryCost + entryFee) : 0;

        // Entry and exit price sums (before fees, as percentage)
        const entryPriceSum = opinionYesAvg + polyNoAvg;
        const exitPriceSum = opinionYesBid + polyNoBid;
        // Can exit only if profitable AND exit price sum >= threshold
        const canExit = netProfit > 0 && exitPriceSum >= exitThreshold;

        console.log(`[Exit Calc] ${key} Strategy1:`, {
          shares,
          entry: { opinionYesAvg, polyNoAvg, entryPriceSum, entryCost, entryFee, total: entryCost + entryFee },
          exit: { opinionYesBid, polyNoBid, exitPriceSum, exitValue, exitFee, total: exitValue - exitFee },
          netProfit,
          canExit
        });

        exitProfit = {
          strategy: 'opinion-yes',
          shares,
          entryCost: entryCost + entryFee,
          exitValue: exitValue - exitFee,
          exitFee,
          netProfit,
          profitPct,
          entryPriceSum,
          exitPriceSum,
          canExit
        };
      }

      if (hasArb2 && polyYesPrice && opinionNoPrice) {
        // Strategy 2: Sell Poly YES + Sell Opinion NO
        const polyYesShares = entry.poly.yes.shares;
        const opinionNoShares = entry.opinion.no.shares;
        const shares = Math.min(polyYesShares, opinionNoShares);

        // Entry prices (from position data)
        const polyYesAvg = entry.poly.yes.avgPrice || 0;
        const opinionNoAvg = entry.opinion.no.avgPrice || 0;

        // Entry cost = raw cost + Opinion buy fee
        const entryCost = (polyYesAvg + opinionNoAvg) * shares;
        const entryFee = calcOpinionTradeFee(opinionNoAvg, shares).actualFee;

        // Exit value
        const polyYesBid = polyYesPrice.bid || polyYesPrice.price || 0;
        const opinionNoBid = opinionNoPrice.bid || opinionNoPrice.price || 0;
        const exitValue = (polyYesBid + opinionNoBid) * shares;
        const exitFee = calcOpinionTradeFee(opinionNoBid, shares).actualFee;

        // Net profit
        const netProfit = exitValue - exitFee - entryCost - entryFee;
        const profitPct = (entryCost + entryFee) > 0 ? netProfit / (entryCost + entryFee) : 0;

        // Entry and exit price sums (before fees, as percentage)
        const entryPriceSum = polyYesAvg + opinionNoAvg;
        const exitPriceSum = polyYesBid + opinionNoBid;
        // Can exit only if profitable AND exit price sum >= threshold
        const canExit = netProfit > 0 && exitPriceSum >= exitThreshold;

        console.log(`[Exit Calc] ${key} Strategy2:`, {
          shares,
          entry: { polyYesAvg, opinionNoAvg, entryPriceSum, entryCost, entryFee, total: entryCost + entryFee },
          exit: { polyYesBid, opinionNoBid, exitPriceSum, exitValue, exitFee, total: exitValue - exitFee },
          netProfit,
          canExit
        });

        // Use this if no arb1 or if this is better
        if (!exitProfit || netProfit > exitProfit.netProfit) {
          exitProfit = {
            strategy: 'poly-yes',
            shares,
            entryCost: entryCost + entryFee,
            exitValue: exitValue - exitFee,
            exitFee,
            netProfit,
            profitPct,
            entryPriceSum,
            exitPriceSum,
            canExit
          };
        }
      }

      if (exitProfit) {
        result.set(key, {
          ...entry,
          exitProfit
        });
      }
    }

    return result;
  }, [matchedPositions, prices, exitThreshold]);

  return {
    positions,
    matchedPositions,  // All positions matched to markets
    arbitragePositions,  // Only arbitrage pairs with exit profit calculated
    loading,
    error,
    lastUpdate,
    refresh: fetchPositions
  };
}

export default usePositions;
