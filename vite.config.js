import { defineConfig } from 'vite';
import { ViteImageOptimizer } from 'vite-plugin-image-optimizer';

export default defineConfig({
  plugins: [
    ViteImageOptimizer({
      png: {
        // Max compression without visible quality loss
        quality: 80,
      },
      jpeg: {
        quality: 80,
      },
      jpg: {
        quality: 80,
      },
      webp: {
        lossless: false,
        quality: 80,
        alphaQuality: 85,
        force: false,
      },
      svg: {
        multipass: true,
        plugins: [
          { name: 'preset-default', params: { overrides: { removeViewBox: false } } },
        ],
      },
    }),
  ],
  build: {
    // Split vendor chunks for better caching
    rollupOptions: {
      output: {
        manualChunks: {
          gsap: ['gsap'],
          lenis: ['lenis'],
          ogl: ['ogl'],
        },
      },
    },
    // Inline small assets (< 4KB) as base64
    assetsInlineLimit: 4096,
    // Generate sourcemaps for production debugging
    sourcemap: false,
    // Target modern browsers
    target: 'es2020',
    // Minify with esbuild (faster than terser)
    minify: 'esbuild',
  },
});
