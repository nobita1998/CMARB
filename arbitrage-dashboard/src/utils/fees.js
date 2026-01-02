/**
 * Fee calculation utilities for Opinion platform
 *
 * Fee formula: 0.08 * p * (1 - p)
 * With points rebate, effective fee = nominal fee * 0.5
 * Minimum fee: $0.5 per trade
 */

// Fee constant
const FEE_K = 0.08;

// Minimum fee in USD
const MIN_FEE_USD = 0.5;

// Points system
const POINT_COST = 20;    // 20U = 1 point
const POINT_VALUE = 10;   // 1 point = 10U
const REBATE_RATE = POINT_VALUE / POINT_COST; // 0.5

/**
 * Calculate nominal fee rate for a given price
 * @param {number} p - Price between 0 and 1
 * @returns {number} Nominal fee rate
 */
export function nominalFee(p) {
  if (p <= 0 || p >= 1) return 0;
  return FEE_K * p * (1 - p);
}

/**
 * Calculate effective fee rate after points rebate
 * @param {number} p - Price between 0 and 1
 * @returns {number} Effective fee rate
 */
export function effectiveFee(p) {
  return nominalFee(p) * (1 - REBATE_RATE);
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

  const feeRate = effectiveFee(price);
  const notional = price * shares;  // 名义价值 = 价格 * 数量
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
 * @returns {object} { spread, spreadPct, effectiveFeeRate, netProfit }
 */
export function calcNetProfit(opinionPrice, polyPrice) {
  const spread = opinionPrice - polyPrice;
  const spreadPct = spread; // Already in decimal form

  // Use the average price for fee calculation
  const avgPrice = (opinionPrice + polyPrice) / 2;
  const feeRate = effectiveFee(avgPrice);

  // 实际手续费 = 名义价值 * 费率 = 价格 * 费率
  // 相对于每股的手续费成本
  const effectiveFeeRate = avgPrice * feeRate;

  const netProfit = Math.abs(spreadPct) - effectiveFeeRate;

  return {
    spread,
    spreadPct,
    effectiveFeeRate,
    netProfit
  };
}

/**
 * Get fee reference table for common price points
 * @returns {Array} Array of { price, nominalFee, effectiveFee }
 */
export function getFeeReferenceTable() {
  const prices = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
  return prices.map(p => ({
    price: p,
    nominalFee: nominalFee(p),
    effectiveFee: effectiveFee(p)
  }));
}

export { POINT_COST, POINT_VALUE, REBATE_RATE, MIN_FEE_USD };
