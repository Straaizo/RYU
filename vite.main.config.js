import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      external: ['electron', 'electron-store', '@anthropic-ai/sdk', 'path', 'fs', 'os'],
    },
  },
});
