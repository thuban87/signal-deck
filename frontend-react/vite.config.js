import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/static/',
  build: {
    outDir: '../frontend-build',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8005',
        changeOrigin: true,
      },
    },
  },
});
