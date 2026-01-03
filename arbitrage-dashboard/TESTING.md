# Testing Guide

## Quick Verification

### 1. Verify Markets Configuration

```bash
node -e "
import('./src/config/markets.js').then(m => {
  const markets = m.config.markets;
  console.log('Total markets:', markets.length);
  markets.forEach(m => {
    console.log('  -', m.id, '|', m.outcomes?.length || 1, 'outcomes');
  });
})"
```

### 2. Check Token IDs Format

```bash
node -e "
import('./src/config/markets.js').then(m => {
  let errors = [];
  m.config.markets.forEach(market => {
    if (!market.opinion?.tokenIds) return;
    Object.entries(market.opinion.tokenIds).forEach(([outcome, tokens]) => {
      if (!tokens.yes || !tokens.no) {
        errors.push(market.id + ' - ' + outcome + ': missing yes/no token');
      }
      if (tokens.yes && !/^\d+$/.test(tokens.yes)) {
        errors.push(market.id + ' - ' + outcome + ': invalid yes token format');
      }
    });
  });
  if (errors.length) {
    console.log('Errors found:');
    errors.forEach(e => console.log('  -', e));
  } else {
    console.log('All token IDs valid!');
  }
})"
```

## API Testing

### 3. Test Opinion API Connection

```bash
# Replace YOUR_API_KEY with actual key
curl -s "https://proxy.opinion.trade:8443/openapi/market/200" \
  -H "apikey: YOUR_API_KEY" | jq '.result.title'
```

### 4. Test Polymarket API Connection

```bash
# Via proxy (if Clash is running on 7890)
curl -s -x http://127.0.0.1:7890 \
  "https://gamma-api.polymarket.com/events?slug=super-bowl-champion-2026-731" \
  | jq '.[0].title'
```

### 5. Verify Market Matching

```bash
# Check if Opinion market exists
curl -s "https://opinionhud.xyz/data.json" | jq '.markets["81"].title'

# Check if Polymarket market exists
curl -s -x http://127.0.0.1:7890 \
  "https://gamma-api.polymarket.com/events?slug=super-bowl-champion-2026-731" \
  | jq '.[0].title'
```

## Development Server Testing

### 6. Start Dev Server

```bash
cd arbitrage-dashboard
npm run dev
```

### 7. Check Browser Console

Open http://localhost:5173 and check for:
- No JavaScript errors in console
- Markets loading in the table
- Prices updating every few seconds

### 8. Verify Specific Market Prices

In browser console:
```javascript
// Check if prices are being fetched
localStorage.debug = 'arbitrage:*';
location.reload();
```

## Build Verification

### 9. Test Production Build

```bash
npm run build
npm run preview
```

## Troubleshooting

### Market Not Showing

1. Check if `outcomes` array matches between Opinion and Polymarket
2. Verify token IDs are correct (copy from opinionhud.xyz/data.json)
3. Check browser console for API errors

### Prices Not Loading

1. Verify API key is set in `.env`: `VITE_OPINION_API_KEY=xxx`
2. Check if Clash proxy is running (for Polymarket)
3. Look for CORS or network errors in console

### Position Not Matching

1. Check console for "Poly position not matched" logs
2. Verify `eventSlug` matches `poly.slug` in config
3. For binary markets, ensure outcome is named `'Yes'`
