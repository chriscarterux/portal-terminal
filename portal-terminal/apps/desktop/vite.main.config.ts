import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  mode: process.env.NODE_ENV,
  root: './src/main',
  build: {
    outDir: '../../dist/main',
    emptyOutDir: true,
    lib: {
      entry: resolve(__dirname, 'src/main/main.ts'),
      formats: ['cjs'],
      fileName: 'main',
    },
    rollupOptions: {
      external: ['electron', 'node-pty', 'fs', 'path', 'os', 'child_process'],
    },
    minify: false,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@shared': resolve(__dirname, 'src/shared'),
    },
  },
});