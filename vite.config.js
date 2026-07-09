import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // Switched from the default "generateSW" strategy to "injectManifest"
      // so our own src/sw.js can handle Web Push notifications (see that
      // file for why) — everything else (precaching the app shell for
      // offline use, auto-update behavior) still works exactly as before.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'autoUpdate',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,ico}'],
      },
      manifest: {
        name: 'Fintly AI Agent',
        short_name: 'Fintly AI',
        description: 'A multi-model AI agent for research, coding, and image generation.',
        theme_color: '#0F1115',
        background_color: '#0F1115',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: '/logo.svg', sizes: '192x192', type: 'image/svg+xml' },
          { src: '/logo.svg', sizes: '512x512', type: 'image/svg+xml' },
          { src: '/logo.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
