import express from 'express';
import { router as apiRouter } from './routes/index.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

export const app = express();

// Middleware
app.use(express.json());

// API Routes (includes /api/health, /api/docs, etc.)
app.use('/api', apiRouter);

// 404 handler for unmatched API routes
app.use('/api', notFoundHandler);

// Global error handler - must be last
app.use(errorHandler);
