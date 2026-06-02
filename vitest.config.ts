import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const abs = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      // Next.js `server-only` throws at import time; in the vitest (Node)
      // environment that guard is irrelevant — swap it for a no-op stub so
      // server modules (e.g. lib/wanted/anthropic.ts) can be imported in tests.
      { find: 'server-only', replacement: abs('./apps/web/tests/__stubs__/server-only.ts') },
      // Mirror the apps/web `@/*` -> `./*` tsconfig path so test files and the
      // modules they import (e.g. eval/refiner/*) resolve `@/lib/...`.
      // Regex avoids clobbering workspace packages like `@hatch/shared`.
      { find: /^@\/(.*)$/, replacement: `${abs('./apps/web')}/$1` },
    ],
  },
  test: {
    include: [
      'apps/web/lib/**/*.test.ts',
      'apps/web/app/**/*.test.ts',
      'apps/web/eval/**/*.test.ts',
      'packages/shared/src/**/*.test.ts',
    ],
    environment: 'node',
  },
});
