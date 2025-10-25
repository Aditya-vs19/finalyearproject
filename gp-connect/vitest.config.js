import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
})