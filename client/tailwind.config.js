/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    // Beim Drucken gelten alle Breakpoints bis xl, damit z. B. der Charakterbogen im Desktop-Layout
    // (statt in der schmalen Handy-Anordnung) gedruckt und anschließend auf die Seitenbreite skaliert wird.
    screens: {
      sm: { raw: '(min-width: 640px), print' },
      md: { raw: '(min-width: 768px), print' },
      lg: { raw: '(min-width: 1024px), print' },
      xl: { raw: '(min-width: 1280px), print' },
      '2xl': '1536px',
    },
    extend: {
      fontFamily: {
        display: ['Cinzel', 'Georgia', 'serif'],
        serif: ['"EB Garamond"', 'Georgia', 'serif'],
      },
      colors: {
        parchment: {
          50: '#fdf9f0',
          100: '#f8efdc',
          200: '#f1e2c0',
          300: '#e6cf9c',
          400: '#d6b474',
          500: '#c09555',
          600: '#a27843',
          700: '#7f5c36',
          800: '#5c4229',
          900: '#3d2c1c',
        },
        ink: {
          DEFAULT: '#2b1d10',
          light: '#4a3520',
        },
        night: {
          700: '#2a2433',
          800: '#1e1a26',
          900: '#14111a',
          950: '#0d0b11',
        },
      },
      boxShadow: {
        card: '0 1px 2px rgba(60,40,10,.12), 0 6px 18px -6px rgba(60,40,10,.35)',
        cardhover: '0 2px 4px rgba(60,40,10,.15), 0 14px 30px -10px rgba(60,40,10,.5)',
      },
    },
  },
  plugins: [],
};
