import { defineConfig } from 'vite';

export default defineConfig({
  // Ready for React: just add @vitejs/plugin-react to plugins array
  plugins: [],
  
  server: {
    port: 3000,
  },
  
  build: {
    outDir: 'dist/client',
    emptyOutDir: true,
  },
  
  resolve: {
    alias: {
      '@': '/src',
    },
  },
});

