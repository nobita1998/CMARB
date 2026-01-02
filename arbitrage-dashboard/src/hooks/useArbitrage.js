import { useMemo } from 'react';
import { config, getMarketById } from '../config/markets';
import { calcOpinionTradeFee, MIN_FEE_USD } from '../utils/fees';

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

        // Get prices
        const opinionYesAsk = opinionYes.ask || opinionYes.price || 0;
        const opinionNoAsk = opinionNo?.ask || opinionNo?.price || 0;
        const polyYesAsk = polyYes.ask || polyYes.price || 0;
        const polyNoAsk = polyNo?.ask || polyNo?.price || 0;

        // Get available shares at best ask
        const opinionYesShares = opinionYes.asks?.[0]?.size || opinionYes.shares || 0;
        const opinionNoShares = opinionNo?.asks?.[0]?.size || opinionNo?.shares || 0;
        const polyYesShares = polyYes.asks?.[0]?.size || polyYes.shares || 0;
        const polyNoShares = polyNo?.asks?.[0]?.size || polyNo?.shares || 0;

        // Calculate available shares for each strategy
        const availShares1 = Math.min(opinionYesShares, polyNoShares);
        const availShares2 = Math.min(polyYesShares, opinionNoShares);

        // Helper to calculate Opinion fee with $0.5 minimum
        const calcOpinionFee = (price, shares) => {
          const fee = calcOpinionTradeFee(price, shares);
          return fee.actualFee;
        };
        const calcPolyFee = (price, shares) => price * shares * 0.005;

        // Strategy 1: Buy Opinion YES + Buy Poly NO
        const cost1 = opinionYesAsk + polyNoAsk;
        const fee1 = calcOpinionFee(opinionYesAsk, availShares1) + calcPolyFee(polyNoAsk, availShares1);
        const totalCost1 = cost1 * availShares1;
        const profit1 = availShares1 - totalCost1 - fee1;
        const profitPct1 = totalCost1 > 0 ? profit1 / totalCost1 : -999;

        // Strategy 2: Buy Poly YES + Buy Opinion NO
        const cost2 = polyYesAsk + opinionNoAsk;
        const fee2 = calcPolyFee(polyYesAsk, availShares2) + calcOpinionFee(opinionNoAsk, availShares2);
        const totalCost2 = cost2 * availShares2;
        const profit2 = availShares2 - totalCost2 - fee2;
        const profitPct2 = totalCost2 > 0 ? profit2 / totalCost2 : -999;

        // Choose the better option (higher profit percentage)
        const isBuyOpinionYes = profitPct1 >= profitPct2;
        const bestProfitPct = isBuyOpinionYes ? profitPct1 : profitPct2;
        const bestProfit = isBuyOpinionYes ? profit1 : profit2;
        const bestCost = isBuyOpinionYes ? cost1 : cost2;

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

        // Determine direction
        let direction = '';
        if (isBuyOpinionYes) {
          const opinionAsk = opinionYes.ask || opinionYes.price;
          const polyNoAsk = polyNo?.ask || polyNo?.price || (1 - polyYes.bid);
          direction = `Buy Opinion YES @ ${(opinionAsk * 100).toFixed(1)}¢ + Buy Poly NO @ ${(polyNoAsk * 100).toFixed(1)}¢`;
        } else {
          const polyAsk = polyYes.ask || polyYes.price;
          const opinionNoAsk = opinionNo?.ask || opinionNo?.price || (1 - opinionYes.bid);
          direction = `Buy Poly YES @ ${(polyAsk * 100).toFixed(1)}¢ + Buy Opinion NO @ ${(opinionNoAsk * 100).toFixed(1)}¢`;
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

        // Calculate effective fee per dollar for display
        const bestFee = isBuyOpinionYes ? fee1 : fee2;
        const bestTotalCost = isBuyOpinionYes ? totalCost1 : totalCost2;
        const effectiveFeeRate = bestTotalCost > 0 ? bestFee / bestTotalCost : 0;

        opportunities.push({
          eventId: market.id,
          eventName: market.name,
          eventType: market.type,
          outcome,
          opinion: opinionYes,
          opinionNo: opinionNo,
          poly: polyYes,
          polyNo: polyNo,
          spread: bestProfit,
          spreadPct: spreadPct,
          effectiveFee: effectiveFeeRate,
          netProfit: netProfit,
          signal,
          direction,
          minDepth,
          bestStrategy: isBuyOpinionYes ? 'opinion-yes' : 'poly-yes',
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
  const goCount = opportunities.filter(o => o.netProfit > settings.minSpreadAlert).length;
  const hotCount = opportunities.filter(o => o.netProfit > settings.hotSpreadThreshold).length;

  return {
    totalMarkets: config.markets.length,
    opportunities: goCount,
    hotCount,
    avgSpread: spreads.reduce((a, b) => a + b, 0) / spreads.length,
    maxSpread: Math.max(...spreads)
  };
}

/**
 * Sort opportunities
 * @param {Array} opportunities
 * @param {string} sortBy - 'spread', 'netProfit', or 'depth'
 * @returns {Array} Sorted array
 */
export function sortOpportunities(opportunities, sortBy = 'netProfit') {
  return [...opportunities].sort((a, b) => {
    let result;
    switch (sortBy) {
      case 'spread':
        result = Math.abs(b.spreadPct) - Math.abs(a.spreadPct);
        break;
      case 'netProfit':
        result = b.netProfit - a.netProfit;
        break;
      case 'depth':
        result = b.minDepth - a.minDepth;
        break;
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
