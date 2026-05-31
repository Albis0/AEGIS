/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        jarvis: {
          bg: '#04070d',
          cyan: '#22d3ee',
          glow: '#38bdf8',
          dim: '#0e7490',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Consolas', 'monospace'],
        display: ['Orbitron', 'Segoe UI', 'sans-serif'],
      },
      keyframes: {
        'spin-slow': { to: { transform: 'rotate(360deg)' } },
        'spin-reverse': { to: { transform: 'rotate(-360deg)' } },
        'core-pulse': {
          '0%, 100%': { transform: 'scale(1)', opacity: '0.9' },
          '50%': { transform: 'scale(1.06)', opacity: '1' },
        },
        'core-think': {
          '0%, 100%': { transform: 'scale(0.96)' },
          '50%': { transform: 'scale(1.12)' },
        },
        flicker: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.4' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        scan: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
      },
      animation: {
        'spin-slow': 'spin-slow 18s linear infinite',
        'spin-med': 'spin-slow 9s linear infinite',
        'spin-reverse': 'spin-reverse 12s linear infinite',
        'spin-fast-reverse': 'spin-reverse 4s linear infinite',
        'core-pulse': 'core-pulse 3s ease-in-out infinite',
        'core-think': 'core-think 0.9s ease-in-out infinite',
        flicker: 'flicker 1.4s ease-in-out infinite',
        'fade-up': 'fade-up 0.35s ease-out',
        scan: 'scan 4s linear infinite',
      },
    },
  },
  plugins: [],
}
