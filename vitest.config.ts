import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'miniflare',
    environmentOptions: {
      modules: true,
      bindings: {
        // D1 database will be created by Miniflare automatically
        // Integration tests access it via globalThis.Miniflare.env.DB
      },
      d1Databases: {
        // Create an in-memory D1 database for tests
        DB: ':memory:',
      },
    },
    poolOptions: {
      threads: {
        singleThread: true,
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.test.ts',
        '**/*.astro',
      ],
    },
    setupFiles: [],
  },
});
