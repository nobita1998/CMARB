/**
 * Opinion API adapter
 *
 * Base URL: https://proxy.opinion.trade:8443/openapi
 * Requires API key in 'apikey' header
 */

// Use proxy path in development
const BASE_URL = '/api/opinion';

// Cache for market metadata (topicId -> tokens)
const marketCache = new Map();

/**
 * Convert raw orderbook level to standardized format
 */
function formatLevel(raw) {
  const price = parseFloat(raw.price) || 0;
  const size = parseFloat(raw.size) || 0;
  return { price, size };
}

/**
 * Fetch market info by topicId
 * @param {number} topicId - Topic ID
 * @param {string} apiKey - API key
 * @returns {Promise<{outcomes: Array<{name: string, tokenId: string}>}|null>}
 */
export async function fetchMarketByTopicId(topicId, apiKey) {
  const cacheKey = `topic-${topicId}`;

  if (marketCache.has(cacheKey)) {
    return marketCache.get(cacheKey);
  }

  try {
    // Use /market/{marketId} endpoint to get market details (including childMarkets)
    const res = await fetch(`${BASE_URL}/market/${topicId}`, {
      headers: {
        'apikey': apiKey,
        'Content-Type': 'application/json'
      }
    });

    const text = await res.text();
    console.log('Opinion /market/200 raw response:', text.substring(0, 2000));

    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      throw new Error(`Invalid JSON: ${text.substring(0, 200)}`);
    }

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${data.message || JSON.stringify(data)}`);
    }

    // Opinion API uses 'errno' instead of 'code'
    const errorCode = data.errno ?? data.code;
    if (errorCode !== 0 && errorCode !== undefined) {
      throw new Error(data.errmsg || data.msg || 'API error');
    }

    if (!data.result) {
      throw new Error('No result in response');
    }

    const market = data.result;
    console.log('Opinion market childMarkets:', market.childMarkets);

    // Check if this is a multi-outcome market with childMarkets
    if (market.childMarkets && market.childMarkets.length > 0) {
      const outcomes = market.childMarkets.map(child => ({
        name: child.yesLabel || child.marketTitle || 'Unknown',
        tokenId: child.yesTokenId,
        noTokenId: child.noTokenId
      }));

      console.log('Opinion parsed outcomes:', outcomes);
      const result = { outcomes, raw: market };
      marketCache.set(cacheKey, result);
      return result;
    }

    // Fallback: Parse as simple market
    const markets = Array.isArray(data.result) ? data.result : [data.result];

    if (markets.length === 0) {
      console.warn(`No market found for topicId: ${topicId}`);
      return null;
    }

    // Extract outcomes and token IDs
    const outcomes = [];
    for (const market of markets) {
      if (market.tokenId || market.token_id) {
        outcomes.push({
          name: market.outcome || market.title || market.name || 'Unknown',
          tokenId: market.tokenId || market.token_id
        });
      }
      // Handle nested tokens structure
      if (market.tokens && Array.isArray(market.tokens)) {
        for (const token of market.tokens) {
          outcomes.push({
            name: token.outcome || token.name || 'Unknown',
            tokenId: token.tokenId || token.token_id || token.id
          });
        }
      }
    }

    const result = { outcomes, raw: markets };
    marketCache.set(cacheKey, result);

    return result;
  } catch (error) {
    console.error(`Failed to fetch Opinion market by topicId ${topicId}:`, error);
    return null;
  }
}

/**
 * Fetch prices for Opinion markets
 * @param {Array} marketConfigs - Array of market configurations
 * @param {string} apiKey - Opinion API key
 * @returns {Promise<Map<string, PriceData>>}
 */
export async function fetchPrices(marketConfigs, apiKey) {
  const results = new Map();

  if (!apiKey) {
    console.warn('Opinion API key not provided');
    return results;
  }

  const promises = [];

  for (const config of marketConfigs) {
    // If topicId is provided, fetch token IDs first
    if (config.topicId) {
      promises.push(
        fetchMarketByTopicId(config.topicId, apiKey)
          .then(async (marketInfo) => {
            if (!marketInfo || !marketInfo.outcomes) return;

            for (const outcome of marketInfo.outcomes) {
              const data = await fetchTokenData(outcome.tokenId, apiKey);
              if (data) {
                results.set(`${config.eventId}-${outcome.name}`, data);
              }
            }
          })
          .catch(err => {
            console.error(`Opinion fetch error for topicId ${config.topicId}:`, err);
          })
      );
    } else if (config.outcomeIds) {
      // Direct token IDs provided (YES and NO)
      for (const [outcome, tokens] of Object.entries(config.outcomeIds)) {
        if (!tokens) continue;

        // Handle both old format (string) and new format ({yes, no})
        const yesTokenId = typeof tokens === 'string' ? tokens : tokens.yes;
        const noTokenId = typeof tokens === 'object' ? tokens.no : null;

        // Fetch YES token
        if (yesTokenId) {
          const keyYes = `${config.eventId}-${outcome}`;
          promises.push(
            fetchTokenData(yesTokenId, apiKey)
              .then(data => {
                if (data) {
                  results.set(keyYes, { ...data, side: 'yes' });
                }
              })
              .catch(err => {
                console.error(`Opinion fetch error for ${keyYes}:`, err);
              })
          );
        }

        // Fetch NO token
        if (noTokenId) {
          const keyNo = `${config.eventId}-${outcome}-NO`;
          promises.push(
            fetchTokenData(noTokenId, apiKey)
              .then(data => {
                if (data) {
                  results.set(keyNo, { ...data, side: 'no' });
                }
              })
              .catch(err => {
                console.error(`Opinion fetch error for ${keyNo}:`, err);
              })
          );
        }
      }
    }
  }

  await Promise.allSettled(promises);
  return results;
}

/**
 * Fetch data for a single token
 */
async function fetchTokenData(tokenId, apiKey) {
  try {
    const orderbookRes = await fetch(
      `${BASE_URL}/token/orderbook?token_id=${tokenId}`,
      {
        headers: {
          'apikey': apiKey,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!orderbookRes.ok) {
      throw new Error(`HTTP ${orderbookRes.status}`);
    }

    const orderbookData = await orderbookRes.json();

    // Opinion API uses 'errno' instead of 'code'
    const errorCode = orderbookData.errno ?? orderbookData.code;
    if (errorCode !== 0 && errorCode !== undefined) {
      throw new Error(orderbookData.errmsg || orderbookData.msg || 'API error');
    }

    const orderbook = orderbookData.result;

    // Sort bids descending (highest first) to get best bid
    const sortedBids = (orderbook.bids || [])
      .map(formatLevel)
      .sort((a, b) => b.price - a.price);

    // Sort asks ascending (lowest first) to get best ask
    const sortedAsks = (orderbook.asks || [])
      .map(formatLevel)
      .sort((a, b) => a.price - b.price);

    const bid = sortedBids[0]?.price || 0;
    const ask = sortedAsks[0]?.price || 0;
    const price = bid && ask ? (bid + ask) / 2 : (bid || ask || 0);

    // Return full orderbook with all levels
    return {
      price,
      bid,
      ask,
      bids: sortedBids.slice(0, 5),  // Top 5 bid levels
      asks: sortedAsks.slice(0, 5),  // Top 5 ask levels
      shares: sortedAsks[0]?.size || 0,  // Best ask size for backward compat
      timestamp: Date.now()
    };
  } catch (error) {
    console.error(`Failed to fetch Opinion token ${tokenId}:`, error);
    return null;
  }
}

/**
 * Test API connection
 */
export async function testConnection(apiKey) {
  if (!apiKey) return false;

  try {
    const res = await fetch(`${BASE_URL}/market?limit=1`, {
      headers: {
        'apikey': apiKey,
        'Content-Type': 'application/json'
      }
    });

    return res.ok;
  } catch {
    return false;
  }
}

export default { fetchPrices, fetchMarketByTopicId, testConnection };
