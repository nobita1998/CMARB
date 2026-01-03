import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { HttpsProxyAgent } from 'https-proxy-agent'

// Proxy agent for Clash
const CLASH_PROXY = 'http://127.0.0.1:7890'
const proxyAgent = new HttpsProxyAgent(CLASH_PROXY)
console.log('Vite proxy agent configured:', CLASH_PROXY)

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Opinion API proxy
      '/api/opinion': {
        target: 'https://proxy.opinion.trade:8443',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api\/opinion/, '/openapi'),
        agent: proxyAgent,
      },
      // Polymarket Data API proxy (positions) - MUST be before /api/poly
      '/api/poly-positions': {
        target: 'https://data-api.polymarket.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api\/poly-positions/, '/positions'),
        agent: proxyAgent,
      },
      // Polymarket CLOB API proxy
      '/api/poly': {
        target: 'https://clob.polymarket.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api\/poly/, ''),
        agent: proxyAgent,
      },
      // Polymarket Gamma API proxy (market metadata)
      '/api/gamma': {
        target: 'https://gamma-api.polymarket.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api\/gamma/, ''),
        agent: proxyAgent,
      },
    },
  },
})
