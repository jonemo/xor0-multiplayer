/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
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
});
