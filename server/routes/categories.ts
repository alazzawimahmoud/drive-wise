import { Router } from 'express';
import { db } from '../db/index.js';
import { categories, categoryTranslations, questions, questionTranslations, assets, regions } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import type { CategoryWithTranslation } from '../types/index.js';

export const categoriesRouter = Router();

/**
 * @swagger
 * /api/categories:
 *   get:
 *     summary: List all categories
 *     tags: [Categories]
 *     parameters:
 *       - $ref: '#/components/parameters/locale'
 *     responses:
 *       200:
 *         description: List of categories with translations
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Category'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
categoriesRouter.get('/', async (req, res) => {
  try {
    const locale = (req.query.locale as string) || 'nl-BE';
    
    const result = await db
      .select({
        id: categories.id,
        slug: categories.slug,
        sortOrder: categories.sortOrder,
        title: categoryTranslations.title,
        description: categoryTranslations.description,
      })
      .from(categories)
      .leftJoin(
        categoryTranslations,
        and(
          eq(categoryTranslations.categoryId, categories.id),
          eq(categoryTranslations.locale, locale)
        )
      )
      .orderBy(categories.sortOrder);

    res.json(result satisfies CategoryWithTranslation[]);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

/**
 * @swagger
 * /api/categories/{slug}:
 *   get:
 *     summary: Get a single category by slug
 *     tags: [Categories]
 *     parameters:
 *       - name: slug
 *         in: path
 *         required: true
 *         description: Category slug
 *         schema:
 *           type: string
 *           example: verkeersborden
 *       - $ref: '#/components/parameters/locale'
 *     responses:
 *       200:
 *         description: Category details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Category'
 *       404:
 *         description: Category not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
categoriesRouter.get('/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const locale = (req.query.locale as string) || 'nl-BE';

    const result = await db
      .select({
        id: categories.id,
        slug: categories.slug,
        sortOrder: categories.sortOrder,
        title: categoryTranslations.title,
        description: categoryTranslations.description,
      })
      .from(categories)
      .leftJoin(
        categoryTranslations,
        and(
          eq(categoryTranslations.categoryId, categories.id),
          eq(categoryTranslations.locale, locale)
        )
      )
      .where(eq(categories.slug, slug))
      .limit(1);

    if (result.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    res.json(result[0]);
  } catch (error) {
    console.error('Error fetching category:', error);
    res.status(500).json({ error: 'Failed to fetch category' });
  }
});

/**
 * @swagger
 * /api/categories/{slug}/questions:
 *   get:
 *     summary: Get questions in a category
 *     tags: [Categories]
 *     parameters:
 *       - name: slug
 *         in: path
 *         required: true
 *         description: Category slug
 *         schema:
 *           type: string
 *       - $ref: '#/components/parameters/locale'
 *       - name: limit
 *         in: query
 *         description: Maximum number of questions to return
 *         schema:
 *           type: integer
 *           default: 50
 *           maximum: 100
 *       - name: offset
 *         in: query
 *         description: Number of questions to skip
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: List of questions in the category
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 category:
 *                   type: string
 *                 total:
 *                   type: integer
 *                 limit:
 *                   type: integer
 *                 offset:
 *                   type: integer
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Question'
 *       404:
 *         description: Category not found
 */
categoriesRouter.get('/:slug/questions', async (req, res) => {
  try {
    const { slug } = req.params;
    const locale = (req.query.locale as string) || 'nl-BE';
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    // First get the category
    const [category] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.slug, slug))
      .limit(1);

    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    // Get questions for this category
    const result = await db
      .select({
        id: questions.id,
        originalId: questions.originalId,
        answerType: questions.answerType,
        isMajorFault: questions.isMajorFault,
        questionText: questionTranslations.questionText,
        explanation: questionTranslations.explanation,
        regionCode: regions.code,
        regionName: regions.name,
        imageUuid: assets.uuid,
      })
      .from(questions)
      .leftJoin(
        questionTranslations,
        and(
          eq(questionTranslations.questionId, questions.id),
          eq(questionTranslations.locale, locale)
        )
      )
      .leftJoin(regions, eq(regions.id, questions.regionId))
      .leftJoin(assets, eq(assets.id, questions.imageAssetId))
      .where(eq(questions.categoryId, category.id))
      .limit(limit)
      .offset(offset);

    res.json({
      category: slug,
      total: result.length,
      limit,
      offset,
      data: result,
    });
  } catch (error) {
    console.error('Error fetching questions:', error);
    res.status(500).json({ error: 'Failed to fetch questions' });
  }
});
