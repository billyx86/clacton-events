import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The app has historically used CRA-style REACT_APP_* environment variables
// (see README). Keeping that prefix means existing .env files keep working
// unchanged; Vite exposes them as import.meta.env.REACT_APP_*.
export default defineConfig({
  plugins: [react()],
  envPrefix: 'REACT_APP_',
  server: { port: 3000 },
  build: {
    rollupOptions: {
      output: {
        // issue #18: after route-level splitting, the remaining initial
        // chunk is dominated by the Firebase SDKs (auth + firestore +
        // storage), which as one chunk still exceed Vite's 500 kB warning
        // threshold. Split each SDK into its own chunk — and react/react
        // -router into a vendor chunk — so no single chunk trips the
        // warning and each chunk can be cached independently.
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('@firebase') || id.includes('firebase/')) {
            if (id.includes('firestore')) return 'firebase-firestore';
            if (id.includes('storage')) return 'firebase-storage';
            if (id.includes('auth')) return 'firebase-auth';
            return 'firebase-app';
          }
          if (
            id.includes('react-router') ||
            id.includes('/react/') ||
            id.includes('react-dom') ||
            id.includes('scheduler')
          ) {
            return 'react-vendor';
          }
        },
      },
    },
  },
  test: {
    // Vitest picks up *.test.js(x) in src/. globals: true keeps the
    // existing describe/test/expect style (ported from Jest) unchanged.
    // The Firestore rules tests (firebase/) run against the emulator, not
    // here — see firebase/firestore.rules.test.js.
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.{js,jsx}'],
    setupFiles: './src/setupTests.js',
  },
});
