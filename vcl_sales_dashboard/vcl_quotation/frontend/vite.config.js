import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Build output is written directly into the Frappe www route so that
// `bench build` / commit picks it up without a separate copy step.
const wwwQuotation = path.resolve(__dirname, '../../www/quotation')

// In dev, FRAPPE_DEV_URL lets you proxy /api and /assets against a running
// Frappe bench (e.g. `FRAPPE_DEV_URL=http://localhost:8000 npm run dev`).
// When unset, the proxy is disabled and the page expects to be served
// from a Frappe site.
const FRAPPE_DEV_URL = process.env.FRAPPE_DEV_URL || ''

export default defineConfig({
  base: '/quotation/',
  plugins: [react()],
  build: {
    outDir: wwwQuotation,
    // Don't wipe the www folder on rebuild — the Frappe page controller
    // (index.py) and any other non-Vite files live alongside the build
    // output and must survive `npm run build`.
    emptyOutDir: false,
    assetsDir: 'assets',
  },
  server: {
    port: 5173,
    open: false,
    proxy: FRAPPE_DEV_URL
      ? {
          '/api': { target: FRAPPE_DEV_URL, changeOrigin: true },
          '/assets': { target: FRAPPE_DEV_URL, changeOrigin: true },
        }
      : undefined,
  },
})
