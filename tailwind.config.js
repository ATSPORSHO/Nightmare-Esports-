/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Accent colour is controlled from the Admin Panel (stored as "r g b" in --accent)
        accent: 'rgb(var(--accent) / <alpha-value>)',
        ink: {
          950: '#060a1c',
          900: '#0a1030',
          850: '#0d1438',
          800: '#111a45',
          700: '#1b2558',
          600: '#27336f',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Rajdhani', 'Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
