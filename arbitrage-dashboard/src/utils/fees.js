/**
 * Fee calculation utilities for Opinion platform
 *
 * Fee formula: 0.08 * p * (1 - p)
 * Minimum fee: $0.5 per fill (per price level in orderbook)
 *
 * Note: When eating multiple orderbook levels at different prices,
 * each price level is a separate fill with its own $0.5 minimum fee.
 * Same-price orders from different makers count as one fill.
 */

// Fee constant
const FEE_K = 0.08;

// Minimum fee in USD
const MIN_FEE_USD = 0.5;

/**
 * Calculate fee rate for a given price
 * @param {number} p - Price between 0 and 1
 * @returns {number} Fee rate
 */
export function nominalFee(p) {
  if (p <= 0 || p >= 1) return 0;
  return FEE_K * p * (1 - p);
}

/**
 * Calculate actual Opinion fee for a trade (with $0.5 minimum)
 * @param {number} price - Price between 0 and 1
 * @param {number} shares - Number of shares
 * @returns {object} { calculatedFee, actualFee, isMinFee, feeRate }
 */
export function calcOpinionTradeFee(price, shares) {
  if (!price || price <= 0 || price >= 1 || !shares || shares <= 0) {
    return { calculatedFee: 0, actualFee: 0, isMinFee: false, feeRate: 0 };
  }

  const feeRate = nominalFee(price);
  const notional = price * shares;
  const calculatedFee = notional * feeRate;
  const actualFee = Math.max(calculatedFee, MIN_FEE_USD);

  return {
    feeRate,
    calculatedFee,
    actualFee,
    isMinFee: calculatedFee < MIN_FEE_USD
  };
}

/**
 * Calculate net profit from arbitrage
 * @param {number} opinionPrice - Opinion price (0-1)
 * @param {number} polyPrice - Polymarket price (0-1)
 * @returns {object} { spread, spreadPct, feeRate, netProfit }
 */
export function calcNetProfit(opinionPrice, polyPrice) {
  const spread = opinionPrice - polyPrice;
  const spreadPct = spread;

  const avgPrice = (opinionPrice + polyPrice) / 2;
  const feeRate = nominalFee(avgPrice);
  const feeCost = avgPrice * feeRate;
  const netProfit = Math.abs(spreadPct) - feeCost;

  return {
    spread,
    spreadPct,
    feeRate,
    netProfit
  };
}

export { MIN_FEE_USD };
