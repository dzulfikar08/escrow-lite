import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    watch: null,
  },
  test: {
    // Use happy-dom for all tests that need DOM
    environment: 'happy-dom',
    watch: false,
    pool: 'vmThreads',
    include: [
      'tests/**/*.test.ts',
      'src/lib/**/*.test.ts',
    ],
    poolOptions: {
      vmThreads: {
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
