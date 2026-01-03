/**
 * Positions API - Fetch user positions from Opinion and Polymarket
 *
 * Opinion API: GET /openapi/positions/user/{walletAddress}
 * Polymarket API: GET /positions?user={address}
 */

// Proxy paths
const OPINION_BASE = '/api/opinion';
const POLY_POSITIONS_BASE = '/api/poly-positions';

/**
 * Fetch Opinion positions for a wallet address (with pagination)
 * @param {string} walletAddress - User's wallet address
 * @param {string} apiKey - Opinion API key (for localhost)
 * @returns {Promise<Array>} Normalized positions
 */
export async function fetchOpinionPositions(walletAddress, apiKey) {
  if (!walletAddress) return [];

  const allPositions = [];
  const limit = 50;
  let page = 1;
  let hasMore = true;

  try {
    const headers = { 'Content-Type': 'application/json' };
    if (apiKey) headers['apikey'] = apiKey;

    while (hasMore) {
      const res = await fetch(
        `${OPINION_BASE}/positions/user/${walletAddress}?limit=${limit}&page=${page}`,
        { headers }
      );

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();

      // Check for API error
      const errorCode = data.errno ?? data.code;
      if (errorCode !== 0 && errorCode !== undefined) {
        throw new Error(data.errmsg || data.msg || 'API error');
      }

      const positions = data.result?.list || data.result || [];
      allPositions.push(...positions);

      // Check if there are more pages
      const total = data.result?.total || 0;
      if (allPositions.length >= total || positions.length < limit) {
        hasMore = false;
      } else {
        page++;
      }

      // Safety limit
      if (page > 20) {
        console.warn('Opinion positions: reached safety limit of 20 pages');
        break;
      }
    }

    console.log(`Fetched ${allPositions.length} Opinion positions`);
    // Debug: log raw position data to find avgPrice field
    if (allPositions.length > 0) {
      console.log('[Opinion] Raw position sample:', allPositions[0]);
    }

    // Normalize to common format
    return allPositions.map(pos => ({
      platform: 'opinion',
      marketId: pos.market_id || pos.marketId,
      marketTitle: pos.market_title || pos.marketTitle,
      tokenId: pos.token_id || pos.tokenId,
      side: (pos.outcome_side_enum || pos.outcomeSideEnum || pos.side || '').toLowerCase(),
      shares: parseFloat(pos.shares_owned || pos.sharesOwned || pos.shares || 0),
      avgPrice: parseFloat(pos.avgEntryPrice || pos.avg_entry_price || pos.avg_price || pos.avgPrice || 0),
      currentPrice: parseFloat(pos.current_price || pos.currentPrice || 0),
      currentValue: parseFloat(pos.current_value_in_quote_token || pos.currentValueInQuoteToken || pos.currentValue || 0),
      unrealizedPnl: parseFloat(pos.unrealized_pnl || pos.unrealizedPnl || 0),
      unrealizedPnlPct: parseFloat(pos.unrealized_pnl_percent || pos.unrealizedPnlPercent || 0),
      raw: pos
    }));
  } catch (error) {
    console.error('Failed to fetch Opinion positions:', error);
    return [];
  }
}

/**
 * Fetch Polymarket positions for a wallet address (with pagination)
 * @param {string} walletAddress - User's wallet address
 * @returns {Promise<Array>} Normalized positions
 */
export async function fetchPolyPositions(walletAddress) {
  if (!walletAddress) return [];

  const allPositions = [];
  const limit = 100; // Fetch 100 at a time
  let offset = 0;
  let hasMore = true;

  try {
    while (hasMore) {
      const res = await fetch(
        `${POLY_POSITIONS_BASE}?user=${walletAddress}&limit=${limit}&offset=${offset}`,
        { headers: { 'Content-Type': 'application/json' } }
      );

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const positions = await res.json();

      if (!Array.isArray(positions)) {
        console.warn('Polymarket positions response is not an array:', positions);
        break;
      }

      allPositions.push(...positions);

      // Check if there are more results
      if (positions.length < limit) {
        hasMore = false;
      } else {
        offset += limit;
      }

      // Safety limit to prevent infinite loops
      if (offset > 1000) {
        console.warn('Polymarket positions: reached safety limit of 1000');
        break;
      }
    }

    console.log(`Fetched ${allPositions.length} Polymarket positions`);
    // Debug: log raw position data to find avgPrice field
    if (allPositions.length > 0) {
      console.log('[Polymarket] Raw position sample:', allPositions[0]);
    }

    // Normalize to common format
    return allPositions.map(pos => ({
      platform: 'poly',
      marketId: pos.conditionId || pos.market,
      marketTitle: pos.title || '',
      marketSlug: pos.slug || '',
      eventSlug: pos.eventSlug || '',  // Parent event slug for matching
      tokenId: pos.asset || pos.tokenId,
      outcome: pos.outcome || '',
      side: (pos.outcome || '').toLowerCase() === 'no' ? 'no' : 'yes',
      shares: parseFloat(pos.size || pos.shares || 0),
      avgPrice: parseFloat(pos.avgPrice || pos.averagePrice || 0),
      currentPrice: parseFloat(pos.curPrice || pos.currentPrice || 0),
      currentValue: parseFloat(pos.currentValue || 0),
      initialValue: parseFloat(pos.initialValue || 0),
      cashPnl: parseFloat(pos.cashPnl || 0),
      percentPnl: parseFloat(pos.percentPnl || 0),
      raw: pos
    }));
  } catch (error) {
    console.error('Failed to fetch Polymarket positions:', error);
    return [];
  }
}

/**
 * Fetch all positions from both platforms
 * @param {Object} wallet - { opinion: string, poly: string }
 * @param {string} apiKey - Opinion API key
 * @returns {Promise<Object>} { opinion: Array, poly: Array }
 */
export async function fetchAllPositions(wallet, apiKey) {
  const [opinionPositions, polyPositions] = await Promise.all([
    fetchOpinionPositions(wallet.opinion, apiKey),
    fetchPolyPositions(wallet.poly)
  ]);

  return {
    opinion: opinionPositions,
    poly: polyPositions
  };
}

export default { fetchOpinionPositions, fetchPolyPositions, fetchAllPositions };
