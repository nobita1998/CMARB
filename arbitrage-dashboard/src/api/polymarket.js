/**
 * Polymarket API adapter
 *
 * CLOB API: https://clob.polymarket.com (orderbook)
 * Gamma API: https://gamma-api.polymarket.com (market metadata)
 */

// Use proxy paths in development
const CLOB_URL = '/api/poly';
const GAMMA_URL = '/api/gamma';

// Cache for market metadata (slug -> tokens)
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
 * Fetch event metadata by slug from Gamma API
 * Returns all markets (outcomes) for the event
 * @param {string} slug - Event slug (e.g., "okbet-arena-ai-trading-competition-winner")
 * @returns {Promise<{markets: Array<{name: string, yesTokenId: string, noTokenId: string}>}|null>}
 */
export async function fetchMarketBySlug(slug) {
  // Check cache first
  if (marketCache.has(slug)) {
    return marketCache.get(slug);
  }

  try {
    // Use /events endpoint for multi-outcome markets
    const res = await fetch(`${GAMMA_URL}/events?slug=${slug}`);

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const events = await res.json();

    if (!events || events.length === 0) {
      console.warn(`No event found for slug: ${slug}`);
      return null;
    }

    const event = events[0];

    // Check if this is a multi-outcome event (has markets array)
    if (event.markets && event.markets.length > 0) {
      const markets = event.markets.map(m => {
        // Parse clobTokenIds - it's a JSON string
        let tokens = [];
        try {
          tokens = typeof m.clobTokenIds === 'string'
            ? JSON.parse(m.clobTokenIds)
            : m.clobTokenIds;
        } catch (e) {
          console.warn(`Failed to parse clobTokenIds for ${m.groupItemTitle}`);
        }

        // For binary markets (single market with empty groupItemTitle), use 'Yes'
        const isBinaryMarket = event.markets.length === 1 && !m.groupItemTitle;
        return {
          name: isBinaryMarket ? 'Yes' : (m.groupItemTitle || m.question),
          yesTokenId: tokens[0],
          noTokenId: tokens[1],
          outcomePrices: m.outcomePrices
        };
      });

      const result = { markets, title: event.title };
      marketCache.set(slug, result);
      return result;
    }

    // Fallback for simple Yes/No markets
    const tokens = event.clobTokenIds;
    if (!tokens || tokens.length < 2) {
      console.warn(`No token IDs found for market: ${slug}`);
      return null;
    }

    const result = {
      markets: [{
        name: 'Yes',
        yesTokenId: tokens[0],
        noTokenId: tokens[1]
      }],
      title: event.title
    };

    marketCache.set(slug, result);
    return result;
  } catch (error) {
    console.error(`Failed to fetch market by slug ${slug}:`, error);
    return null;
  }
}

/**
 * Fetch prices for Polymarket markets
 * @param {Array} marketConfigs - Array of { eventId, slug } or { eventId, outcomeIds }
 * @returns {Promise<Map<string, PriceData>>}
 */
export async function fetchPrices(marketConfigs) {
  const results = new Map();
  const promises = [];

  for (const config of marketConfigs) {
    // If slug is provided, fetch token IDs first
    if (config.slug) {
      promises.push(
        fetchMarketBySlug(config.slug)
          .then(async (eventInfo) => {
            if (!eventInfo || !eventInfo.markets) return;

            // Filter markets if outcomeFilter is specified (for single-outcome polling)
            let marketsToFetch = eventInfo.markets;
            if (config.outcomeFilter) {
              marketsToFetch = eventInfo.markets.filter(m => m.name === config.outcomeFilter);
            }

            // Fetch data for each outcome in the event (both YES and NO)
            const fetchPromises = marketsToFetch.flatMap((market) => {
              const tasks = [];

              // Fetch YES token orderbook
              if (market.yesTokenId) {
                tasks.push(
                  fetchTokenBook(market.yesTokenId).then(data => {
                    if (data) {
                      results.set(`${config.eventId}-${market.name}`, { ...data, side: 'yes' });
                    }
                  })
                );
              }

              // Fetch NO token orderbook
              if (market.noTokenId) {
                tasks.push(
                  fetchTokenBook(market.noTokenId).then(data => {
                    if (data) {
                      results.set(`${config.eventId}-${market.name}-NO`, { ...data, side: 'no' });
                    }
                  })
                );
              }

              return tasks;
            });

            await Promise.allSettled(fetchPromises);
          })
          .catch(err => {
            console.error(`Polymarket fetch error for ${config.slug}:`, err);
          })
      );
    } else if (config.outcomeIds) {
      // Legacy: direct token IDs provided
      for (const [outcome, tokenId] of Object.entries(config.outcomeIds)) {
        if (!tokenId) continue;

        const key = `${config.eventId}-${outcome}`;

        promises.push(
          fetchTokenBook(tokenId)
            .then(data => {
              if (data) {
                results.set(key, data);
              }
            })
            .catch(err => {
              console.error(`Polymarket fetch error for ${key}:`, err);
            })
        );
      }
    }
  }

  await Promise.allSettled(promises);
  return results;
}

/**
 * Fetch orderbook for a single token
 */
async function fetchTokenBook(tokenId) {
  try {
    const res = await fetch(`${CLOB_URL}/book?token_id=${tokenId}`);

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const book = await res.json();

    // Sort bids descending (highest first) to get best bid
    const sortedBids = (book.bids || [])
      .map(formatLevel)
      .sort((a, b) => b.price - a.price);

    // Sort asks ascending (lowest first) to get best ask
    const sortedAsks = (book.asks || [])
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
    console.error(`Failed to fetch Polymarket token ${tokenId}:`, error);
    return null;
  }
}

/**
 * Test API connection
 */
export async function testConnection() {
  try {
    const res = await fetch(`${CLOB_URL}/tick-size`);
    return res.ok;
  } catch {
    return false;
  }
}

export default { fetchPrices, fetchMarketBySlug, testConnection };
