import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

const mockDir = fileURLToPath(new URL('./src/mocks', import.meta.url))

// The injectable data-layer boundary: in mock/test mode these three modules
// resolve to in-memory mocks instead — real source files are never edited.
// Everything else (useProperty, useItems, facts, every page) runs real code
// against the mock store. Preview against fixtures: `npm run preview:mock`.
// The anchored `(\.\.?\/)+` only matches relative imports of our own modules,
// never bare package specifiers like "firebase/app".
const mockAliases = [
  { find: /^(\.\.?\/)+firebase(\.js)?$/, replacement: `${mockDir}/firebase.js` },
  { find: /^(\.\.?\/)+firestoreApi(\.js)?$/, replacement: `${mockDir}/firestoreApi.js` },
  { find: /^(\.\.?\/)+AuthGate(\.jsx)?$/, replacement: `${mockDir}/AuthGate.jsx` },
  { find: /^(\.\.?\/)+backendApi(\.js)?$/, replacement: `${mockDir}/backendApi.js` },
  { find: /^(\.\.?\/)+storageApi(\.js)?$/, replacement: `${mockDir}/storageApi.js` },
]

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  base: '/home-services/',
  plugins: [react()],
  resolve: {
    alias: mode === 'mock' || mode === 'test' ? mockAliases : [],
  },
  build: {
    rollupOptions: {
      output: {
        // Vendor code changes far less often than ours — separate chunks
        // mean returning browsers only re-download the app, not the SDKs.
        // (Rolldown accepts only the function form of manualChunks.)
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('firebase')) return 'firebase'
          if (id.includes('react') || id.includes('scheduler')) return 'react'
          return undefined
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
  },
}))
