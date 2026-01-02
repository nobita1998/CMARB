import { formatPct } from '../utils/format';
import { calcOpinionTradeFee, MIN_FEE_USD } from '../utils/fees';

/**
 * Calculate days until settlement date
 * @param {string} settlementDate - YYYY-MM-DD format
 * @returns {number|null} Days to settlement, or null if invalid/past
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
 * Calculate annualized return
 * @param {number} profitPct - Profit percentage (e.g., 0.05 = 5%)
 * @param {number} daysToSettlement - Days until settlement
 * @returns {number|null} Annualized return percentage
 */
function calcAnnualizedReturn(profitPct, daysToSettlement) {
  if (!daysToSettlement || daysToSettlement <= 0) return null;
  return profitPct * (365 / daysToSettlement);
}

/**
 * Format price as cents
 */
function formatPrice(p) {
  if (!p || isNaN(p)) return '—';
  return (p * 100).toFixed(1);
}

/**
 * Format shares count with 2 decimal places
 */
function formatShares(shares) {
  if (!shares || shares === 0) return '—';
  if (shares >= 1000) {
    return `${(shares / 1000).toFixed(2)}k`;
  }
  return shares.toFixed(2);
}

/**
 * Format USD value
 */
function formatUsd(usd) {
  if (!usd || usd === 0) return '—';
  if (usd >= 1000) {
    return `${(usd / 1000).toFixed(2)}k`;
  }
  return usd.toFixed(2);
}

/**
 * Calculate Opinion fee for a trade (with $0.5 minimum)
 * Returns fee in USD for given price and shares
 */
function calcOpinionFee(price, shares) {
  const fee = calcOpinionTradeFee(price, shares);
  return fee.actualFee;
}

/**
 * Polymarket has no trading fees
 */
function calcPolyFee(price, shares) {
  return 0;
}

/**
 * Main market table showing orderbook style
 */
export function MarketTable({ opportunities, totalCount = 0, profitableOnly = false }) {
  if (opportunities.length === 0) {
    const message = profitableOnly && totalCount > 0
      ? `No profitable opportunities found. (${totalCount} markets loaded)`
      : 'No markets configured or no data available.';

    return (
      <div className="card rounded-lg p-8 text-center">
        <div className="text-slate-500 text-sm">
          {message}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {opportunities.map((opp) => (
        <OrderbookCard key={`${opp.eventId}-${opp.outcome}`} opp={opp} />
      ))}
    </div>
  );
}

/**
 * Orderbook style card for each outcome
 */
function OrderbookCard({ opp }) {
  // Get orderbook data
  const opinionYes = opp.opinion || {};
  const opinionNo = opp.opinionNo || {};
  const polyYes = opp.poly || {};
  const polyNo = opp.polyNo || {};

  // Best prices
  const opinionYesAsk = opinionYes.ask || 0;
  const opinionNoAsk = opinionNo.ask || 0;
  const polyYesAsk = polyYes.ask || 0;
  const polyNoAsk = polyNo.ask || 0;

  // Get shares at best ask
  const opinionYesShares = opinionYes.asks?.[0]?.size || opinionYes.shares || 0;
  const opinionNoShares = opinionNo.asks?.[0]?.size || opinionNo.shares || 0;
  const polyYesShares = polyYes.asks?.[0]?.size || polyYes.shares || 0;
  const polyNoShares = polyNo.asks?.[0]?.size || polyNo.shares || 0;

  // Calculate available shares for each strategy
  const availShares1 = Math.min(opinionYesShares, polyNoShares);
  const availShares2 = Math.min(polyYesShares, opinionNoShares);

  // Strategy 1: Buy Opinion YES + Buy Poly NO (using actual available shares)
  const cost1 = opinionYesAsk + polyNoAsk;
  const fee1 = calcOpinionFee(opinionYesAsk, availShares1) + calcPolyFee(polyNoAsk, availShares1);
  const totalCost1 = cost1 * availShares1;
  const payout1 = availShares1; // If either wins, you get 1 per share
  const profit1 = payout1 - totalCost1 - fee1;
  const profitPct1 = totalCost1 > 0 ? profit1 / totalCost1 : 0;

  // Strategy 2: Buy Poly YES + Buy Opinion NO (using actual available shares)
  const cost2 = polyYesAsk + opinionNoAsk;
  const fee2 = calcPolyFee(polyYesAsk, availShares2) + calcOpinionFee(opinionNoAsk, availShares2);
  const totalCost2 = cost2 * availShares2;
  const payout2 = availShares2;
  const profit2 = payout2 - totalCost2 - fee2;
  const profitPct2 = totalCost2 > 0 ? profit2 / totalCost2 : 0;

  // Determine best strategy (by profit percentage)
  const isBuyOpinionYes = profitPct1 >= profitPct2;
  const bestProfit = isBuyOpinionYes ? profit1 : profit2;
  const bestProfitPct = isBuyOpinionYes ? profitPct1 : profitPct2;
  const bestFee = isBuyOpinionYes ? fee1 : fee2;
  const bestCost = isBuyOpinionYes ? cost1 : cost2;
  const bestTotalCost = isBuyOpinionYes ? totalCost1 : totalCost2;
  const bestAvailShares = isBuyOpinionYes ? availShares1 : availShares2;

  // Calculate annualized return if settlement date is available
  const daysToSettlement = getDaysToSettlement(opp.settlementDate);
  const annualizedReturn = calcAnnualizedReturn(bestProfitPct, daysToSettlement);

  // Determine signal based on profit percentage
  let signal = null;
  if (bestProfitPct > 0.05) {
    signal = 'HOT';
  } else if (bestProfitPct > 0.02) {
    signal = 'GO';
  }

  const cardBorder = signal === 'HOT'
    ? 'border-orange-400'
    : signal === 'GO'
    ? 'border-green-400'
    : 'border-slate-200';

  return (
    <div className={`rounded-lg overflow-hidden border-2 ${cardBorder} bg-white shadow-sm`}>
      {/* Header */}
      <div className="px-4 py-2 bg-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-bold text-white">{opp.outcome}</span>
          <span className="text-slate-400 text-xs">{opp.eventName}</span>
          {daysToSettlement !== null && (
            <span className="text-slate-500 text-xs bg-slate-700 px-1.5 py-0.5 rounded">
              {opp.settlementDate} ({daysToSettlement}d)
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {signal && (
            <span className={signal === 'HOT'
              ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white px-2 py-0.5 rounded text-xs font-bold animate-pulse'
              : 'border border-green-400 text-green-400 px-2 py-0.5 rounded text-xs font-bold'
            }>
              {signal}
            </span>
          )}
          <span className={`text-sm font-mono font-bold ${bestProfitPct > 0 ? 'text-green-400' : 'text-red-400'}`}>
            {formatPct(bestProfitPct)}
          </span>
          {annualizedReturn !== null && bestProfitPct > 0 && (
            <span className="text-sm font-mono font-bold text-purple-400" title={`${daysToSettlement} days to settlement`}>
              APY: {formatPct(annualizedReturn)}
            </span>
          )}
        </div>
      </div>

      {/* Orderbook Grid */}
      <div className="grid grid-cols-2">
        {/* Opinion Side - Orange Theme */}
        <div className="bg-gradient-to-b from-orange-50 to-orange-100/50 p-3 border-r-2 border-orange-200">
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-orange-500"></div>
            {opp.opinionUrl ? (
              <a href={opp.opinionUrl} target="_blank" rel="noopener noreferrer"
                 className="text-sm font-bold text-orange-700 hover:text-orange-500 hover:underline">
                OPINION ↗
              </a>
            ) : (
              <span className="text-sm font-bold text-orange-700">OPINION</span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {/* YES Column */}
            <OrderbookColumn
              title="YES"
              data={opinionYes}
              highlight={isBuyOpinionYes}
              theme="orange"
            />
            {/* NO Column */}
            <OrderbookColumn
              title="NO"
              data={opinionNo}
              highlight={!isBuyOpinionYes}
              theme="orange"
            />
          </div>
        </div>

        {/* Poly Side - Blue Theme */}
        <div className="bg-gradient-to-b from-blue-50 to-blue-100/50 p-3">
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-blue-500"></div>
            {opp.polyUrl ? (
              <a href={opp.polyUrl} target="_blank" rel="noopener noreferrer"
                 className="text-sm font-bold text-blue-700 hover:text-blue-500 hover:underline">
                POLYMARKET ↗
              </a>
            ) : (
              <span className="text-sm font-bold text-blue-700">POLYMARKET</span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {/* YES Column */}
            <OrderbookColumn
              title="YES"
              data={polyYes}
              highlight={!isBuyOpinionYes}
              theme="blue"
            />
            {/* NO Column */}
            <OrderbookColumn
              title="NO"
              data={polyNo}
              highlight={isBuyOpinionYes}
              theme="blue"
            />
          </div>
        </div>
      </div>

      {/* Strategy Summary - only show if profitable */}
      {bestProfit > 0 ? (
        <div className="px-4 py-2 bg-green-50 border-t border-green-200 text-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-green-600 font-bold">Strategy:</span>
              <span className="text-slate-700 font-medium">
                {isBuyOpinionYes
                  ? <>Buy <span className="text-orange-600">Opinion YES</span> {formatShares(bestAvailShares)} @ {formatPrice(opinionYesAsk)}¢ + Buy <span className="text-blue-600">Poly NO</span> {formatShares(bestAvailShares)} @ {formatPrice(polyNoAsk)}¢</>
                  : <>Buy <span className="text-blue-600">Poly YES</span> {formatShares(bestAvailShares)} @ {formatPrice(polyYesAsk)}¢ + Buy <span className="text-orange-600">Opinion NO</span> {formatShares(bestAvailShares)} @ {formatPrice(opinionNoAsk)}¢</>
                }
              </span>
            </div>
            <div className="flex items-center gap-3 font-mono">
              <span className="text-slate-500">
                Cost: <span className="text-slate-700">${bestTotalCost.toFixed(2)}</span>
              </span>
              <span className="text-amber-600">
                Fee: ${bestFee.toFixed(2)}
              </span>
              <span className="font-bold text-green-600">
                Profit: ${bestProfit.toFixed(2)} ({formatPct(bestProfitPct)})
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="px-4 py-2 bg-slate-100 border-t border-slate-200 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">No arbitrage opportunity</span>
            <div className="flex items-center gap-3 font-mono">
              <span className="text-slate-400">
                Best cost: <span className="text-slate-500">{(bestCost * 100).toFixed(1)}¢</span>
              </span>
              <span className="text-red-500">
                {formatPct(bestProfitPct)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Orderbook column showing asks and bids with depth
 */
function OrderbookColumn({ title, data, highlight, theme }) {
  const asks = data.asks || [];
  const bids = data.bids || [];

  const borderColor = theme === 'orange' ? 'border-orange-200' : 'border-blue-200';
  const titleColor = theme === 'orange' ? 'text-orange-600' : 'text-blue-600';
  const titleBorder = theme === 'orange' ? 'border-orange-100' : 'border-blue-100';

  return (
    <div className={`bg-white/80 rounded-lg p-2 border ${borderColor}`}>
      <div className={`text-center ${titleColor} font-bold text-xs mb-2 pb-1 border-b ${titleBorder}`}>{title}</div>
      <div className="space-y-0.5 font-mono text-[10px]">
        {/* Header */}
        <div className="grid grid-cols-3 gap-1 text-slate-400 px-1 text-center">
          <span className="text-left">Price</span>
          <span>Size</span>
          <span className="text-right">USDT</span>
        </div>

        {/* Asks (sell orders) - show in reverse so lowest is at bottom */}
        <div className="border-b border-slate-100 pb-1 mb-1">
          {asks.slice(0, 3).reverse().map((level, i) => (
            <div
              key={`ask-${i}`}
              className={`grid grid-cols-3 gap-1 px-1 py-0.5 rounded ${
                i === asks.slice(0, 3).length - 1 && highlight
                  ? 'bg-green-100 text-green-700 font-bold ring-1 ring-green-300'
                  : 'text-red-600'
              }`}
            >
              <span className="text-left">{formatPrice(level.price)}¢</span>
              <span className="text-center text-slate-500">{formatShares(level.size)}</span>
              <span className="text-right text-slate-500">{formatUsd(level.size * level.price)}</span>
            </div>
          ))}
          {asks.length === 0 && (
            <div className="text-center text-slate-300 py-1">—</div>
          )}
        </div>

        {/* Bids (buy orders) */}
        <div>
          {bids.slice(0, 3).map((level, i) => (
            <div
              key={`bid-${i}`}
              className="grid grid-cols-3 gap-1 px-1 py-0.5 text-green-600"
            >
              <span className="text-left">{formatPrice(level.price)}¢</span>
              <span className="text-center text-slate-500">{formatShares(level.size)}</span>
              <span className="text-right text-slate-500">{formatUsd(level.size * level.price)}</span>
            </div>
          ))}
          {bids.length === 0 && (
            <div className="text-center text-slate-300 py-1">—</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default MarketTable;
