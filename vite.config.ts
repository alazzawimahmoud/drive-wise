import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

export default defineConfig({
  plugins: [react()],
  
  server: {
    port: 3000,
    host: true, // Allow external connections
    allowedHosts: [
      'endocrinous-arline-abandonable.ngrok-free.dev',
      '.ngrok-free.dev', // Allow all ngrok free domains
      '.ngrok.io', // Allow all ngrok domains
    ],
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

