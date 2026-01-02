/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        mono: ["'JetBrains Mono'", "'SF Mono'", "'Consolas'", "monospace"],
      },
      colors: {
        'bg-primary': '#0a0a0f',
        'bg-secondary': '#1a1a2e',
        'card-bg': 'rgba(255,255,255,0.03)',
        'hot-bg': 'rgba(249,115,22,0.08)',
        'go-bg': 'rgba(34,197,94,0.05)',
      },
      animation: {
        'pulse-hot': 'pulse-hot 2s ease-in-out infinite',
      },
      keyframes: {
        'pulse-hot': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
      },
    },
  },
  plugins: [],
}
