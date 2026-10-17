import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' lets the built site work on GitHub Pages (any repo name) with HashRouter.
export default defineConfig({
  base: './',
  plugins: [react()],
})
