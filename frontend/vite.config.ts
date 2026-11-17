import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  server: {
    port: 5183,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:4114',
        changeOrigin: true,
      },
    },
  },
  import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  server: {
    port: 5183,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:4114',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom')) return 'vendor-react';
            if (id.includes('axios')) return 'vendor-axios';
            if (id.includes('recharts')) return 'vendor-recharts';
            if (id.includes('lucide-react')) return 'vendor-lucide';
            if (id.includes('react-hook-form')) return 'vendor-forms';
            if (id.includes('react-router-dom')) return 'vendor-router';
            if (id.includes('jalaali-js')) return 'vendor-jalaali';
            if (id.includes('clsx')) return 'vendor-utils';
            return 'vendor-other';
          }
        },
        chunkFileNames: (chunkInfo) => {
          const facadeModuleId = chunkInfo.facadeModuleId ? chunkInfo.facadeModuleId.split('/').pop() : 'chunk';
          return `js/${facadeModuleId}-[hash].js`;
        },
      },
    },
  },
});
});
