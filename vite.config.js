import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
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
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,ico}'],
      },
    }),
  ],
})
