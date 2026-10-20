/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Accent colour is controlled from the Admin Panel (stored as "r g b" in --accent)
        accent: 'rgb(var(--accent) / <alpha-value>)',
        ink: {
          950: '#070405',
          900: '#0e0809',
          850: '#140b0c',
          800: '#1c0e10',
          700: '#2a1214',
          600: '#431c20',
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
