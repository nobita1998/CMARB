import { useMemo } from 'react';
import { config, getMarketById } from '../config/markets';
import { calcOpinionTradeFee, MIN_FEE_USD } from '../utils/fees';
import { getMarketVolume } from '../api/opinion';

// Low volume threshold: 1M USD
const LOW_VOLUME_THRESHOLD = 1_000_000;

/**
 * Calculate days until settlement date
 */
function getDaysToSettlement(settlementDate) {
  if (!settlementDate) return null;
  const settlement = new Date(settlementDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  settlement.setHours(0, 0, 0, 0);
  const diffTime = settlement.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : null;
}

/**
 * Calculate annualized return (APY)
 */
function calcAPY(profitPct, daysToSettlement) {
  if (!daysToSettlement || daysToSettlement <= 0 || profitPct <= 0) return 0;
  return profitPct * (365 / daysToSettlement);
}

/**
 * Calculate cumulative orderbook level data (weighted average price and total size)
 * @param {Array} asks - Array of { price, size }
 * @param {number} levels - Number of levels to include (1-3)
 * @returns {Object} { avgPrice, totalSize, levelDetails }
 */
function calcCumulativeLevel(asks, levels) {
  if (!asks || asks.length === 0) return { avgPrice: 0, totalSize: 0, levelDetails: [] };

  let totalSize = 0;
  let totalValue = 0;
  const levelDetails = [];

  for (let i = 0; i < levels && i < asks.length; i++) {
    const level = asks[i];
    if (!level || !level.size) continue;
    totalSize += level.size;
    totalValue += level.price * level.size;
    levelDetails.push({ price: level.price, size: level.size });
  }

  return {
    avgPrice: totalSize > 0 ? totalValue / totalSize : 0,
    totalSize,
    levelDetails
  };
}

/**
 * Calculate Opinion fee for multiple orderbook levels
 * Each price level is a separate fill with its own $0.5 minimum fee
 * @param {Array} levelDetails - Array of { price, size } for each level consumed
 * @param {number} sharesToUse - Actual shares to use (may be limited by other side)
 * @param {function} calcFee - Fee calculation function
 * @returns {number} Total fee across all levels
 */
function calcMultiLevelFee(levelDetails, sharesToUse, calcFee) {
  if (!levelDetails || levelDetails.length === 0 || sharesToUse <= 0) return 0;

  let totalFee = 0;
  let remainingShares = sharesToUse;

  for (const level of levelDetails) {
    if (remainingShares <= 0) break;

    // Use min of level size and remaining shares
    const sharesFromThisLevel = Math.min(level.size, remainingShares);
    if (sharesFromThisLevel <= 0) continue;

    // Each level's fee has its own $0.5 minimum
    const levelFee = calcFee(level.price, sharesFromThisLevel);
    totalFee += levelFee;
    remainingShares -= sharesFromThisLevel;
  }

  return totalFee;
}

/**
 * Find the best arbitrage strategy by searching all level combinations
 * @param {Object} params - { opinionAsks, polyAsks, calcFee }
 * @returns {Object|null} Best strategy or null
 */
function findBestStrategy(opinionAsks, polyAsks, calcFee) {
  let bestStrategy = null;
  let bestProfitPct = -Infinity;

  const maxLevels = 3;

  // Enumerate all combinations
  for (let opLevels = 1; opLevels <= maxLevels; opLevels++) {
    for (let polyLevels = 1; polyLevels <= maxLevels; polyLevels++) {
      const opCum = calcCumulativeLevel(opinionAsks, opLevels);
      const polyCum = calcCumulativeLevel(polyAsks, polyLevels);

      // Skip if no data
      if (opCum.totalSize <= 0 || polyCum.totalSize <= 0) continue;

      // Available shares = min of both sides
      const shares = Math.min(opCum.totalSize, polyCum.totalSize);

      // Combined cost per share
      const costPerShare = opCum.avgPrice + polyCum.avgPrice;
      const totalCost = costPerShare * shares;

      // Calculate fee per price level (each level has $0.5 minimum)
      const fee = calcMultiLevelFee(opCum.levelDetails, shares, calcFee);

      // Profit = payout (1 per share) - cost - fee
      const profit = shares - totalCost - fee;
      const profitPct = totalCost > 0 ? profit / totalCost : -999;

      if (profitPct > bestProfitPct) {
        bestProfitPct = profitPct;
        bestStrategy = {
          opinionLevels: opLevels,
          polyLevels: polyLevels,
          opinionAvgPrice: opCum.avgPrice,
          polyAvgPrice: polyCum.avgPrice,
          shares,
          costPerShare,
          totalCost,
          fee,
          profit,
          profitPct
        };
      }
    }
  }

  return bestStrategy;
}

/**
 * Hook for calculating arbitrage opportunities
 *
 * @param {Object} prices - { opinion: Map, poly: Map }
 * @returns {Object} { opportunities, stats }
 */
export function useArbitrage(prices) {
  const { opinion: opinionPrices, poly: polyPrices } = prices;
  const { settings } = config;

  const result = useMemo(() => {
    const opportunities = [];

    // Process each market
    for (const market of config.markets) {
      // Process each outcome
      for (const outcome of market.outcomes || []) {
        const yesKey = `${market.id}-${outcome}`;
        const noKey = `${market.id}-${outcome}-NO`;

        // Get YES and NO prices for both platforms
        const opinionYes = opinionPrices?.get(yesKey);
        const opinionNo = opinionPrices?.get(noKey);
        const polyYes = polyPrices?.get(yesKey);
        const polyNo = polyPrices?.get(noKey);

        // Skip if missing critical data
        if (!opinionYes || !polyYes) continue;

        // Helper to calculate Opinion fee with $0.5 minimum
        const calcFee = (price, shares) => {
          const fee = calcOpinionTradeFee(price, shares);
          return fee.actualFee;
        };

        // Get orderbook data
        const opinionYesAsks = opinionYes.asks || [];
        const opinionNoAsks = opinionNo?.asks || [];
        const polyYesAsks = polyYes.asks || [];
        const polyNoAsks = polyNo?.asks || [];

        // Strategy 1: Buy Opinion YES + Buy Poly NO (multi-level search)
        const strategy1 = findBestStrategy(opinionYesAsks, polyNoAsks, calcFee);

        // Strategy 2: Buy Poly YES + Buy Opinion NO (multi-level search)
        const strategy2 = findBestStrategy(opinionNoAsks, polyYesAsks, calcFee);

        // Choose the better option (higher profit percentage)
        let isBuyOpinionYes = true;
        let bestStrategy = strategy1;

        if (strategy2 && (!strategy1 || strategy2.profitPct > strategy1.profitPct)) {
          isBuyOpinionYes = false;
          bestStrategy = strategy2;
        }

        // Skip if no valid strategy found
        if (!bestStrategy) continue;

        const bestProfitPct = bestStrategy.profitPct;
        const bestProfit = bestStrategy.profit;
        const bestCost = bestStrategy.costPerShare;

        // For sorting and display
        const spreadPct = 1 - bestCost;
        const netProfit = bestProfitPct;

        // Determine signal
        let signal = 'NONE';
        if (netProfit > settings.hotSpreadThreshold) {
          signal = 'HOT';
        } else if (netProfit > settings.minSpreadAlert) {
          signal = 'GO';
        }

        // Determine direction with level info
        let direction = '';
        const formatLevels = (n) => n === 1 ? 'L1' : `L1-${n}`;
        if (isBuyOpinionYes) {
          direction = `Buy Opinion YES (${formatLevels(bestStrategy.opinionLevels)}) @ ${(bestStrategy.opinionAvgPrice * 100).toFixed(1)}¢ + Buy Poly NO (${formatLevels(bestStrategy.polyLevels)}) @ ${(bestStrategy.polyAvgPrice * 100).toFixed(1)}¢`;
        } else {
          direction = `Buy Poly YES (${formatLevels(bestStrategy.polyLevels)}) @ ${(bestStrategy.polyAvgPrice * 100).toFixed(1)}¢ + Buy Opinion NO (${formatLevels(bestStrategy.opinionLevels)}) @ ${(bestStrategy.opinionAvgPrice * 100).toFixed(1)}¢`;
        }

        // Get minimum depth (use YES token depths as primary)
        const minDepth = Math.min(
          opinionYes.depth || 0,
          polyYes.depth || 0
        );

        // Get IDs for links
        const opinionTopicId = market.opinion?.topicId;
        const opinionType = market.opinion?.type || 'single';
        const polySlug = market.poly?.slug;

        // Calculate fee rate per dollar for display
        const feeRate = bestStrategy.totalCost > 0 ? bestStrategy.fee / bestStrategy.totalCost : 0;

        // Calculate APY (support per-outcome settlement date override)
        const outcomeSettlementDate = market.outcomeSettings?.[outcome]?.settlementDate || market.settlementDate;
        const daysToSettlement = getDaysToSettlement(outcomeSettlementDate);
        const apy = calcAPY(netProfit, daysToSettlement);

        // Check volume (low volume = < 1M)
        const topicId = market.opinion?.topicId;
        const volume = topicId ? getMarketVolume(topicId) : null;
        const isLowVolume = volume !== null && volume < LOW_VOLUME_THRESHOLD;

        opportunities.push({
          eventId: market.id,
          eventName: market.name,
          eventType: market.type,
          settlementDate: outcomeSettlementDate || null,
          daysToSettlement,
          apy,
          volume,
          isLowVolume,
          outcome,
          opinion: opinionYes,
          opinionNo: opinionNo,
          poly: polyYes,
          polyNo: polyNo,
          spread: bestProfit,
          spreadPct: spreadPct,
          feeRate,
          netProfit: netProfit,
          signal,
          direction,
          minDepth,
          bestStrategyType: isBuyOpinionYes ? 'opinion-yes' : 'poly-yes',
          // Multi-level strategy details
          strategyDetails: {
            isBuyOpinionYes,
            opinionLevels: bestStrategy.opinionLevels,
            polyLevels: bestStrategy.polyLevels,
            opinionAvgPrice: bestStrategy.opinionAvgPrice,
            polyAvgPrice: bestStrategy.polyAvgPrice,
            shares: bestStrategy.shares,
            costPerShare: bestStrategy.costPerShare,
            totalCost: bestStrategy.totalCost,
            fee: bestStrategy.fee,
            profit: bestStrategy.profit,
            profitPct: bestStrategy.profitPct
          },
          // Links
          opinionUrl: opinionTopicId ? `https://app.opinion.trade/detail?topicId=${opinionTopicId}&type=${opinionType}` : null,
          polyUrl: polySlug ? `https://polymarket.com/event/${polySlug}` : null
        });
      }
    }

    // Calculate stats
    const stats = calculateStats(opportunities, settings);

    return { opportunities, stats };
  }, [opinionPrices, polyPrices, settings]);

  return result;
}

/**
 * Calculate statistics from opportunities
 */
function calculateStats(opportunities, settings) {
  if (opportunities.length === 0) {
    return {
      totalMarkets: config.markets.length,
      opportunities: 0,
      hotCount: 0,
      avgSpread: 0,
      maxSpread: 0
    };
  }

  const spreads = opportunities.map(o => Math.abs(o.spreadPct));
  const profitableCount = opportunities.filter(o => o.netProfit > 0).length;
  const goCount = opportunities.filter(o => o.netProfit > settings.minSpreadAlert).length;
  const hotCount = opportunities.filter(o => o.netProfit > settings.hotSpreadThreshold).length;

  return {
    totalMarkets: config.markets.length,
    opportunities: profitableCount,
    goCount,
    hotCount,
    avgSpread: spreads.reduce((a, b) => a + b, 0) / spreads.length,
    maxSpread: Math.max(...spreads)
  };
}

/**
 * Sort opportunities
 * @param {Array} opportunities
 * @param {string} sortBy - 'netProfit' or 'apy'
 * @returns {Array} Sorted array
 */
export function sortOpportunities(opportunities, sortBy = 'netProfit') {
  return [...opportunities].sort((a, b) => {
    let result;
    switch (sortBy) {
      case 'apy':
        // Sort by APY descending (0 APY goes to the bottom)
        result = (b.apy || 0) - (a.apy || 0);
        break;
      case 'netProfit':
      default:
        result = b.netProfit - a.netProfit;
    }
    // Stable sort: use outcome name as tiebreaker
    if (result === 0) {
      return a.outcome.localeCompare(b.outcome);
    }
    return result;
  });
}

/**
 * Filter opportunities by type
 * @param {Array} opportunities
 * @param {string} type - Market type or 'ALL'
 * @returns {Array} Filtered array
 */
export function filterOpportunities(opportunities, type = 'ALL') {
  if (type === 'ALL') return opportunities;
  return opportunities.filter(o => o.eventType === type);
}

export default useArbitrage;
