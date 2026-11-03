// Vitest config for the Cloud Functions package (issue #28).
//
// The functions tests are plain unit tests: feedShaper.test.js is fully
// dependency-free, and feedHandler.test.js mocks only the
// firebase-admin/firestore surface. Neither test imports the
// firebase-functions framework (index.js), so no emulator, JVM or
// Firebase project is needed — they run in milliseconds on bare Node.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['*.test.js'],
  },
});
