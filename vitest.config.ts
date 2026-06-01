import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['apps/web/lib/**/*.test.ts', 'packages/shared/src/**/*.test.ts'],
    environment: 'node',
  },
});
