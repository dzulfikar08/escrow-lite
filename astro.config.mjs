// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import path from 'path';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: cloudflare({
    platform: 'cloudflare',
  }),
  vite: {
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
    },
    resolve: {
      alias: {
        '@': path.resolve('./src'),
      },
    },
    ssr: {
      // Externalize problematic Node.js packages that don't work in Workers
      external: ['sharp', 'detect-libc'],
    },
  },
});
