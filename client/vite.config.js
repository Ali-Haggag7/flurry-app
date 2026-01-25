import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { visualizer } from "rollup-plugin-visualizer";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    visualizer({
      open: true,
      gzipSize: true,
      brotliSize: true,
      filename: "stats.html",
    })
  ],
  build: {
    sourcemap: false,
    minify: 'esbuild',
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('@clerk')) {
              return 'auth';
            }

            if (id.includes('framer-motion')) {
              return 'animation';
            }

            if (id.includes('emoji-picker-react')) {
              return 'emoji-picker';
            }

            if (id.includes('lucide-react')) {
              return 'icons';
            }

            return 'vendor';
          }
        },
      },
    },
  },
});