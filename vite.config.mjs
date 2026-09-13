import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The app has historically used CRA-style REACT_APP_* environment variables
// (see README). Keeping that prefix means existing .env files keep working
// unchanged; Vite exposes them as import.meta.env.REACT_APP_*.
export default defineConfig({
  plugins: [react()],
  envPrefix: 'REACT_APP_',
  server: { port: 3000 },
  test: {
    // Vitest picks up *.test.js in src/. globals: true keeps the existing
    // describe/test/expect style (ported from Jest) unchanged.
    // The Firestore rules tests (firebase/) run against the emulator, not
    // here — see firebase/firestore.rules.test.js.
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.js'],
    setupFiles: './src/setupTests.js',
  },
});
