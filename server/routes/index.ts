import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import { categoriesRouter } from './categories.js';
import { lessonsRouter } from './lessons.js';
import { questionsRouter } from './questions.js';
import { examRouter } from './exam.js';
import { authRouter } from './auth.js';
import { bookmarksRouter } from './bookmarks.js';
import { statsRouter } from './stats.js';
import { adminRouter } from './admin.js';
import { studyRouter } from './study.js';
import { swaggerSpec } from '../swagger.js';

export const router = Router();

// Swagger documentation
router.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'DriveWise API Documentation',
}));

// Serve OpenAPI spec as JSON
router.get('/docs.json', (_req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// Health check endpoint
router.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// Mount route modules
router.use('/auth', authRouter);
router.use('/categories', categoriesRouter);
router.use('/lessons', lessonsRouter);
router.use('/questions', questionsRouter);
router.use('/exam', examRouter);
router.use('/bookmarks', bookmarksRouter);
router.use('/stats', statsRouter);
router.use('/admin', adminRouter);
router.use('/study', studyRouter);

/**
 * @swagger
 * /api/locales:
 *   get:
 *     summary: List available locales
 *     tags: [Localization]
 *     responses:
 *       200:
 *         description: List of supported locales
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Locale'
 */
router.get('/locales', (_req, res) => {
  res.json([
    { code: 'nl-BE', name: 'Nederlands (België)', isDefault: true },
    { code: 'fr-BE', name: 'Français (Belgique)', isDefault: false },
    { code: 'de-BE', name: 'Deutsch (Belgien)', isDefault: false },
    { code: 'en', name: 'English', isDefault: false },
  ]);
});

/**
 * @swagger
 * /api/regions:
 *   get:
 *     summary: List Belgian regions
 *     tags: [Localization]
 *     responses:
 *       200:
 *         description: List of Belgian regions
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Region'
 */
router.get('/regions', (_req, res) => {
  res.json([
    { id: 1, code: 'national', name: 'Nationaal' },
    { id: 2, code: 'brussels', name: 'Brussels Hoofdstedelijk Gewest' },
    { id: 3, code: 'flanders', name: 'Vlaanderen' },
    { id: 4, code: 'wallonia', name: 'Wallonië' },
  ]);
});
