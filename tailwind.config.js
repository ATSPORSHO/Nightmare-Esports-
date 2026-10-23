/** @type {import('tailwindcss').Config} */
// Colours are CSS variables (see src/index.css) so the site can switch between a light and a dark theme.
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Accent colour is controlled from the Admin Panel (stored as "r g b" in --accent)
        accent: 'rgb(var(--accent) / <alpha-value>)',
        white: v('c-white'),
        ink: {
          950: v('ink-950'), 900: v('ink-900'), 850: v('ink-850'),
          800: v('ink-800'), 700: v('ink-700'), 600: v('ink-600'),
        },
        slate: { 200: v('slate-200'), 300: v('slate-300'), 400: v('slate-400'), 500: v('slate-500'), 600: v('slate-600') },
        red: {
          100: v('red-100'), 200: v('red-200'), 300: v('red-300'), 400: v('red-400'),
          700: v('red-700'), 900: v('red-900'), 950: v('red-950'),
        },
        amber: { 100: v('amber-100'), 300: v('amber-300') },
        emerald: { 300: v('emerald-300'), 400: v('emerald-400') },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Montserrat', 'Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
