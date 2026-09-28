import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Proxies API calls to the Worker so the browser only ever talks to one origin locally.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
    },
  },
});
