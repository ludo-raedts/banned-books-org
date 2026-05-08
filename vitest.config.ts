import { defineConfig } from 'vitest/config'
import path from 'node:path'

// Vitest runs only when invoked via `pnpm test` / `pnpm test:watch` — it has
// no effect on `next build` or production runtime. Keep the config minimal.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    include: ['src/**/__tests__/**/*.test.ts', 'src/**/*.test.ts'],
    environment: 'node',
  },
})
