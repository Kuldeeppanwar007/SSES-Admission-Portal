/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#f97316', light: '#fb923c', dark: '#ea580c' },
      },
    },
  },
  plugins: [],
};
