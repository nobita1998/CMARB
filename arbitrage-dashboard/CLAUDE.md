# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Arbitrage dashboard for monitoring price differences between Opinion (opinion.trade) and Polymarket prediction markets. Displays real-time spreads, calculates net profit after fees, and tracks user positions.

## Commands

```bash
# Development (requires Clash proxy on port 7890 for Polymarket API)
npm run dev

# Build for production
npm run build

# Lint
npm run lint

# Verify markets config without starting server
node -e "import('./src/config/markets.js').then(m => console.log(m.config.markets.map(x => x.id)))"
```

## Architecture

### Data Flow

```
markets.js (config) → usePolling (fetch prices) → useArbitrage (calculate opportunities) → MarketTable (display)
                    → usePositions (fetch user holdings) ────────────────────────────────→ MarketTable (display)
```

### Key Files

- `src/config/markets.js` - Market pair configurations mapping Opinion to Polymarket markets. Each market has `outcomes` array with token IDs for both platforms.
- `src/hooks/useArbitrage.js` - Core arbitrage calculation logic. Finds best strategy across orderbook levels.
- `src/hooks/usePositions.js` - Matches user positions to configured markets using token ID lookup (Opinion) and slug/title matching (Polymarket).
- `src/utils/fees.js` - Opinion fee calculation: `0.08 * p * (1 - p)` with $0.50 minimum **per price level**. When eating multiple orderbook levels, each level is a separate fill with its own $0.50 minimum fee.

### API Proxies

Vite dev server proxies API requests through Clash (127.0.0.1:7890):
- `/api/opinion` → `proxy.opinion.trade:8443/openapi`
- `/api/poly` → `clob.polymarket.com` (orderbook)
- `/api/gamma` → `gamma-api.polymarket.com` (market metadata)
- `/api/poly-positions` → `data-api.polymarket.com/positions`

Vercel serverless functions in `/api/` folder handle production proxying.

### Adding New Markets

1. Get Opinion data from `opinionhud.xyz/data.json` (includes token IDs)
2. Get Polymarket data via API: `curl -x http://127.0.0.1:7890 "https://gamma-api.polymarket.com/events?slug=<slug>"`
3. Add config to `markets.js` with matching outcome names
4. For binary markets (single Yes/No), use `outcomes: ['Yes']` - Polymarket API returns empty `groupItemTitle` for these

### Per-Outcome Settlement Dates

If different outcomes have different settlement dates, use `outcomeSettings` to override:

```javascript
{
  id: 'megaeth-fdv',
  settlementDate: '2026-07-01',  // Default for all outcomes
  outcomes: ['>$1B', '>$2B', '>$4B', '>$6B'],
  outcomeSettings: {
    '>$6B': { settlementDate: '2026-09-01' }  // Override for specific outcome
  }
}
```
