import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/daemon/services/**', 'src/daemon/repositories/**'],
      exclude: ['**/*.test.ts', '**/index.ts'],
    },
    testTimeout: 10000,
  },
});
