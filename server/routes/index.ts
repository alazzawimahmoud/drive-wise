import { Router } from 'express';
import { categoriesRouter } from './categories.js';
import { questionsRouter } from './questions.js';
import { examRouter } from './exam.js';

export const router = Router();

// Mount route modules
router.use('/categories', categoriesRouter);
router.use('/questions', questionsRouter);
router.use('/exam', examRouter);

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
