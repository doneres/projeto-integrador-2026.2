import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    // Os testes do seed criam um banco e semeiam a massa inteira: levam alguns segundos.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    globalSetup: ['./test/support/global-setup.ts'],
  },
})
