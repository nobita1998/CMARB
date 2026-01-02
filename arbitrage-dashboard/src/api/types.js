/**
 * Unified data type definitions for API responses
 */

/**
 * @typedef {Object} PriceData
 * @property {number} price - Latest price, 0-1
 * @property {number} bid - Best bid price
 * @property {number} ask - Best ask price
 * @property {number} depth - Available depth in USD
 * @property {number} timestamp - Update timestamp
 */

/**
 * @typedef {Object} MarketConfig
 * @property {string} eventId - Event identifier
 * @property {string} marketId - Platform-specific market ID
 * @property {Object<string, string>} outcomeIds - Outcome name to token ID mapping
 */

/**
 * @typedef {Object} ArbitrageOpportunity
 * @property {string} eventId - Event identifier
 * @property {string} eventName - Display name
 * @property {string} eventType - Market type (LOL, AI, Politics, Crypto)
 * @property {string} outcome - Outcome name
 * @property {PriceData} opinion - Opinion platform price data
 * @property {PriceData} poly - Polymarket price data
 * @property {number} spread - Opinion price - Poly price
 * @property {number} spreadPct - Spread as percentage
 * @property {number} effectiveFee - Effective fee after rebate
 * @property {number} netProfit - |spreadPct| - effectiveFee
 * @property {'HOT'|'GO'|'NONE'} signal - Trading signal
 * @property {string} direction - Direction description
 */

/**
 * @typedef {Object} Stats
 * @property {number} totalMarkets - Total number of markets
 * @property {number} opportunities - Count where netProfit > minSpreadAlert
 * @property {number} hotCount - Count where netProfit > hotSpreadThreshold
 * @property {number} avgSpread - Average absolute spread
 * @property {number} maxSpread - Maximum absolute spread
 */

/**
 * @typedef {Object} ConnectionStatus
 * @property {'connected'|'disconnected'|'error'} opinion
 * @property {'connected'|'disconnected'|'error'} poly
 */

// Export empty object for module compatibility
export default {};
