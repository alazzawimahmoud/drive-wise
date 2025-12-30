import express from 'express';
import { router as apiRouter } from './routes/index.js';

export const app = express();

// Middleware
app.use(express.json());

// API Routes (includes /api/health, /api/docs, etc.)
app.use('/api', apiRouter);
