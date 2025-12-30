import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import { app } from './app.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '3000', 10);
const isProduction = process.env.NODE_ENV === 'production';

if (isProduction) {
  // In production, serve static files from dist/client
  const clientPath = path.join(__dirname, '../client');
  app.use(express.static(clientPath));

  // SPA fallback - only for non-API routes
  app.get('/{*splat}', (req, res, next) => {
    // Don't serve index.html for API routes
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(clientPath, 'index.html'));
  });

  app.listen(PORT, () => {
    console.log(`🚗 DriveWise server running at http://localhost:${PORT}`);
    console.log(`📚 API available at http://localhost:${PORT}/api`);
  });
} else {
  // In development, use ViteExpress for HMR
  const ViteExpress = await import('vite-express');
  ViteExpress.default.listen(app, PORT, () => {
    console.log(`🚗 DriveWise server running at http://localhost:${PORT}`);
    console.log(`📚 API available at http://localhost:${PORT}/api`);
  });
}

