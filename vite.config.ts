/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ command }) => ({
  // Project page is served from /xor0-multiplayer/. Override with PAGES_BASE
  // (e.g. set PAGES_BASE=/ when serving from a custom domain at the root).
  base: command === 'build' ? process.env.PAGES_BASE ?? '/xor0-multiplayer/' : '/',
  plugins: [react()],
  server: {
    // Don't let test-tool artifacts (Playwright snapshots/screenshots) trigger
    // HMR full-reloads while driving the app.
    watch: { ignored: ['**/.playwright-mcp/**', '**/*.png'] },
  },
  test: {
    globals: true,
    environment: 'node',
  },
}));
