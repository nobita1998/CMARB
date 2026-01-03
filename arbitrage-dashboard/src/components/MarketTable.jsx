import { formatPct } from '../utils/format';

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
 * Main market table showing orderbook style
 */
export function MarketTable({ opportunities, totalCount = 0, profitableOnly = false, matchedPositions, arbitragePositions, currentPage = 1, totalPages = 1, onPageChange }) {
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
      {opportunities.map((opp) => {
        const positionKey = `${opp.eventId}-${opp.outcome}`;
        const userPosition = matchedPositions?.get(positionKey);
        const arbPosition = arbitragePositions?.get(positionKey);
        return (
          <OrderbookCard
            key={positionKey}
            opp={opp}
            userPosition={userPosition}
            arbPosition={arbPosition}
          />
        );
      })}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 py-4">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            className={`px-3 py-1 text-sm rounded border transition-colors ${
              currentPage <= 1
                ? 'bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed'
                : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
            }`}
          >
            ← Prev
          </button>
          <span className="text-sm text-slate-600">
            Page <span className="font-bold">{currentPage}</span> of <span className="font-bold">{totalPages}</span>
            <span className="text-slate-400 ml-2">({totalCount} total)</span>
          </span>
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            className={`px-3 py-1 text-sm rounded border transition-colors ${
              currentPage >= totalPages
                ? 'bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed'
                : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
            }`}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Orderbook style card for each outcome
 */
function OrderbookCard({ opp, userPosition, arbPosition }) {
  // Get orderbook data
  const opinionYes = opp.opinion || {};
  const opinionNo = opp.opinionNo || {};
  const polyYes = opp.poly || {};
  const polyNo = opp.polyNo || {};

  // Use pre-calculated strategy details from useArbitrage
  const sd = opp.strategyDetails || {};
  const isBuyOpinionYes = sd.isBuyOpinionYes ?? true;
  const bestProfit = sd.profit || 0;
  const bestProfitPct = sd.profitPct || 0;
  const bestFee = sd.fee || 0;
  const bestCost = sd.costPerShare || 0;
  const bestTotalCost = sd.totalCost || 0;
  const bestAvailShares = sd.shares || 0;

  // Levels used in the strategy (for highlighting)
  const opinionLevels = sd.opinionLevels || 1;
  const polyLevels = sd.polyLevels || 1;

  // Use pre-calculated values from opportunity
  const daysToSettlement = opp.daysToSettlement;
  const annualizedReturn = opp.apy;

  // Determine signal based on profit percentage
  let signal = null;
  if (bestProfitPct > 0.05) {
    signal = 'HOT';
  } else if (bestProfitPct > 0.02) {
    signal = 'GO';
  }

  // User position info
  const hasUserPosition = userPosition && (
    userPosition.opinion?.yes || userPosition.opinion?.no ||
    userPosition.poly?.yes || userPosition.poly?.no
  );

  // Arbitrage position exit status
  const hasArbPosition = !!arbPosition?.exitProfit;
  const canExit = arbPosition?.exitProfit?.canExit;

  const cardBorder = canExit
    ? 'border-purple-500 ring-2 ring-purple-300'
    : signal === 'HOT'
    ? 'border-orange-400'
    : signal === 'GO'
    ? 'border-green-400'
    : hasUserPosition
    ? 'border-purple-300'
    : 'border-slate-200';

  return (
    <div className={`rounded-lg overflow-hidden border-2 ${cardBorder} bg-white shadow-sm`}>
      {/* Header */}
      <div className={`px-4 py-2 flex items-center justify-between ${hasUserPosition ? 'bg-purple-900' : 'bg-slate-800'}`}>
        <div className="flex items-center gap-2">
          <span className="font-bold text-white">{opp.outcome}</span>
          <span className="text-slate-400 text-xs">{opp.eventName}</span>
          {daysToSettlement !== null && (
            <span className="text-slate-200 text-xs bg-slate-600 px-1.5 py-0.5 rounded">
              {opp.settlementDate} ({daysToSettlement}d)
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {canExit && (
            <span className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-2 py-0.5 rounded text-xs font-bold animate-pulse">
              EXIT NOW
            </span>
          )}
          {signal && !canExit && (
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
          {annualizedReturn > 0 && (
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
          <div className="flex items-center justify-center gap-2 mb-2">
            {opp.isLowVolume && (
              <span className="text-yellow-600 text-xs" title="Volume < $1M">
                ✨ low vol
              </span>
            )}
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
          {/* User Holdings */}
          {(userPosition?.opinion?.yes || userPosition?.opinion?.no) && (
            <div className="mb-2 px-2 py-1 bg-purple-100 rounded text-xs text-center">
              <span className="text-purple-700 font-medium">My Holdings: </span>
              {userPosition.opinion.yes && (
                <span className="text-green-600 mr-2">YES {formatShares(userPosition.opinion.yes.shares)}</span>
              )}
              {userPosition.opinion.no && (
                <span className="text-red-600">NO {formatShares(userPosition.opinion.no.shares)}</span>
              )}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            {/* YES Column */}
            <OrderbookColumn
              title="YES"
              data={opinionYes}
              highlightLevels={isBuyOpinionYes ? opinionLevels : 0}
              theme="orange"
              userHolding={!!userPosition?.opinion?.yes}
            />
            {/* NO Column */}
            <OrderbookColumn
              title="NO"
              data={opinionNo}
              highlightLevels={!isBuyOpinionYes ? opinionLevels : 0}
              theme="orange"
              userHolding={!!userPosition?.opinion?.no}
            />
          </div>
        </div>

        {/* Poly Side - Blue Theme */}
        <div className="bg-gradient-to-b from-blue-50 to-blue-100/50 p-3">
          <div className="flex items-center justify-center gap-2 mb-2">
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
          {/* User Holdings */}
          {(userPosition?.poly?.yes || userPosition?.poly?.no) && (
            <div className="mb-2 px-2 py-1 bg-purple-100 rounded text-xs text-center">
              <span className="text-purple-700 font-medium">My Holdings: </span>
              {userPosition.poly.yes && (
                <span className="text-green-600 mr-2">YES {formatShares(userPosition.poly.yes.shares)}</span>
              )}
              {userPosition.poly.no && (
                <span className="text-red-600">NO {formatShares(userPosition.poly.no.shares)}</span>
              )}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            {/* YES Column */}
            <OrderbookColumn
              title="YES"
              data={polyYes}
              highlightLevels={!isBuyOpinionYes ? polyLevels : 0}
              theme="blue"
              userHolding={!!userPosition?.poly?.yes}
            />
            {/* NO Column */}
            <OrderbookColumn
              title="NO"
              data={polyNo}
              highlightLevels={isBuyOpinionYes ? polyLevels : 0}
              theme="blue"
              userHolding={!!userPosition?.poly?.no}
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
                  ? <>Buy <span className="text-orange-600">Opinion YES</span> <span className="text-orange-400">(L1{opinionLevels > 1 ? `-${opinionLevels}` : ''})</span> {formatShares(bestAvailShares)} @ {formatPrice(sd.opinionAvgPrice)}¢ + Buy <span className="text-blue-600">Poly NO</span> <span className="text-blue-400">(L1{polyLevels > 1 ? `-${polyLevels}` : ''})</span> @ {formatPrice(sd.polyAvgPrice)}¢</>
                  : <>Buy <span className="text-blue-600">Poly YES</span> <span className="text-blue-400">(L1{polyLevels > 1 ? `-${polyLevels}` : ''})</span> {formatShares(bestAvailShares)} @ {formatPrice(sd.polyAvgPrice)}¢ + Buy <span className="text-orange-600">Opinion NO</span> <span className="text-orange-400">(L1{opinionLevels > 1 ? `-${opinionLevels}` : ''})</span> @ {formatPrice(sd.opinionAvgPrice)}¢</>
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

      {/* Position Exit Summary - show when user has arbitrage position */}
      {hasArbPosition && (
        <div className={`px-4 py-2 border-t text-xs ${canExit ? 'bg-purple-100 border-purple-300' : 'bg-slate-100 border-slate-200'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`font-bold ${canExit ? 'text-purple-700' : 'text-slate-600'}`}>Arbitrage Position:</span>
              <span className="text-slate-600">
                {arbPosition.exitProfit.strategy === 'opinion-yes'
                  ? 'Opinion YES + Poly NO'
                  : 'Poly YES + Opinion NO'
                }
                <span className="ml-1 text-slate-500">({formatShares(arbPosition.exitProfit.shares)} shares)</span>
              </span>
            </div>
            <div className="flex items-center gap-3 font-mono">
              <span className="text-slate-500">
                Entry: <span className="text-slate-700">${arbPosition.exitProfit.entryCost.toFixed(2)}</span>
                <span className="text-slate-400 ml-1">({(arbPosition.exitProfit.entryPriceSum * 100).toFixed(1)}%)</span>
              </span>
              <span className="text-slate-500">
                Exit: <span className="text-slate-700">${arbPosition.exitProfit.exitValue.toFixed(2)}</span>
                <span className={`ml-1 ${arbPosition.exitProfit.exitPriceSum >= 1 ? 'text-green-500' : 'text-amber-500'}`}>
                  ({(arbPosition.exitProfit.exitPriceSum * 100).toFixed(1)}%)
                </span>
              </span>
              <span className="text-amber-600">
                Fee: ${arbPosition.exitProfit.exitFee.toFixed(2)}
              </span>
              <span className={`font-bold ${canExit ? 'text-purple-600' : arbPosition.exitProfit.netProfit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                P/L: {arbPosition.exitProfit.netProfit >= 0 ? '+' : ''}${arbPosition.exitProfit.netProfit.toFixed(2)} ({formatPct(arbPosition.exitProfit.profitPct)})
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
 * @param {number} highlightLevels - Number of ask levels to highlight (1-3, 0 = none)
 * @param {boolean} userHolding - Whether user holds this side (to highlight exit bid price)
 */
function OrderbookColumn({ title, data, highlightLevels = 0, theme, userHolding }) {
  const asks = data.asks || [];
  const bids = data.bids || [];

  const borderColor = theme === 'orange' ? 'border-orange-200' : 'border-blue-200';
  const titleColor = theme === 'orange' ? 'text-orange-600' : 'text-blue-600';
  const titleBorder = theme === 'orange' ? 'border-orange-100' : 'border-blue-100';

  // Asks are displayed in reverse order (lowest at bottom)
  // To highlight first N levels, we highlight the last N items in reversed array
  const displayAsks = asks.slice(0, 3).reverse();
  const displayLen = displayAsks.length;

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
          {displayAsks.map((level, i) => {
            // Highlight if this row is within the highlighted levels (from the bottom)
            const isHighlighted = highlightLevels > 0 && i >= displayLen - highlightLevels;
            return (
              <div
                key={`ask-${i}`}
                className={`grid grid-cols-3 gap-1 px-1 py-0.5 rounded ${
                  isHighlighted
                    ? 'bg-green-100 text-green-700 font-bold ring-1 ring-green-300'
                    : 'text-red-600'
                }`}
              >
                <span className="text-left">{formatPrice(level.price)}¢</span>
                <span className={`text-center ${isHighlighted ? 'text-green-600' : 'text-slate-500'}`}>{formatShares(level.size)}</span>
                <span className={`text-right ${isHighlighted ? 'text-green-600' : 'text-slate-500'}`}>{formatUsd(level.size * level.price)}</span>
              </div>
            );
          })}
          {asks.length === 0 && (
            <div className="text-center text-slate-300 py-1">—</div>
          )}
        </div>

        {/* Bids (buy orders) - highlight first row if user holds this side */}
        <div>
          {bids.slice(0, 3).map((level, i) => (
            <div
              key={`bid-${i}`}
              className={`grid grid-cols-3 gap-1 px-1 py-0.5 rounded ${
                i === 0 && userHolding
                  ? 'bg-purple-100 text-purple-700 font-bold ring-1 ring-purple-300'
                  : 'text-green-600'
              }`}
            >
              <span className="text-left">{formatPrice(level.price)}¢</span>
              <span className={`text-center ${i === 0 && userHolding ? 'text-purple-500' : 'text-slate-500'}`}>{formatShares(level.size)}</span>
              <span className={`text-right ${i === 0 && userHolding ? 'text-purple-500' : 'text-slate-500'}`}>{formatUsd(level.size * level.price)}</span>
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
