import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.test.ts'],
    exclude: ['node_modules/**', 'dist/**'],
    testTimeout: 10_000,
    hookTimeout: 10_000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      include: ['src/server/**/*.ts'],
      exclude: [
        'src/server/types.ts',
        'src/server/**/*.d.ts',
      ],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 60,
        statements: 70,
      },
    },
  },
});