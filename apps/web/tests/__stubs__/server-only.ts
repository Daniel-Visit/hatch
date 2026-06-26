// Vitest stub for the `server-only` package.
// Next.js's real `server-only` throws at import time to prevent client
// component usage. In the vitest (Node) environment that guard is irrelevant,
// so we replace it with a no-op stub via the `resolve.alias` in vitest.config.ts.
export {};
