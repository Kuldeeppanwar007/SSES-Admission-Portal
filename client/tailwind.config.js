/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'var(--color-primary)',
          light: 'var(--color-primary-light)',
          dark: 'var(--color-primary-dark)',
        },
        hud: {
          bg:      '#0b0f19',
          surface: '#111827',
          card:    'rgba(17,24,39,0.7)',
          border:  'rgba(255,255,255,0.08)',
          cyan:    '#06b6d4',
          blue:    '#3b82f6',
          emerald: '#10b981',
          purple:  '#8b5cf6',
          red:     '#ef4444',
          amber:   '#f59e0b',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Plus Jakarta Sans', 'system-ui', 'sans-serif'],
      },
      backdropBlur: {
        xs: '2px',
      },
      boxShadow: {
        'glow-cyan':    '0 0 20px rgba(6,182,212,0.25)',
        'glow-blue':    '0 0 20px rgba(59,130,246,0.25)',
        'glow-emerald': '0 0 20px rgba(16,185,129,0.25)',
        'glow-purple':  '0 0 20px rgba(139,92,246,0.25)',
        'glow-primary': '0 0 20px var(--color-primary-glow)',
        'card':         '0 4px 24px rgba(0,0,0,0.4)',
      },
      animation: {
        'fade-in':    'fadeIn 0.2s ease-out',
        'slide-in':   'slideIn 0.25s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4,0,0.6,1) infinite',
      },
      keyframes: {
        fadeIn:  { from: { opacity: '0', transform: 'translateY(-6px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        slideIn: { from: { opacity: '0', transform: 'translateX(-12px)' }, to: { opacity: '1', transform: 'translateX(0)' } },
      },
    },
  },
  plugins: [],
};
