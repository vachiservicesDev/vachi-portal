import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
    // These hit a real local Postgres and share state via truncation
    // between tests - concurrent files would race on the same rows.
    fileParallelism: false,
    testTimeout: 15000,
  },
});
