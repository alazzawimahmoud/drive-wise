import 'dotenv/config';
import ViteExpress from 'vite-express';
import { app } from './app.js';

const PORT = parseInt(process.env.PORT || '3000', 10);

ViteExpress.listen(app, PORT, () => {
  console.log(`🚗 DriveWise server running at http://localhost:${PORT}`);
  console.log(`📚 API available at http://localhost:${PORT}/api`);
});

