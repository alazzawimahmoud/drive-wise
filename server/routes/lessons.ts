import { Router } from 'express';
import { db } from '../db/index.js';
import { lessons, lessonTranslations, questionLessons, questions, questionTranslations, choices, choiceTranslations, assets, regions, categories, categoryTranslations } from '../db/schema.js';
import { eq, and, sql, count } from 'drizzle-orm';
import type { ApiLesson, ApiQuestion, ApiChoice } from '../types/index.js';
import { getAssetUrl } from '../config.js';

export const lessonsRouter = Router();

/**
 * @swagger
 * /api/lessons:
 *   get:
 *     summary: Get all lessons
 *     tags: [Lessons]
 *     parameters:
 *       - $ref: '#/components/parameters/locale'
 *     responses:
 *       200:
 *         description: Array of all lessons with question counts
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Lesson'
 */
lessonsRouter.get('/', async (req, res) => {
  try {
    const locale = (req.query.locale as string) || 'nl-BE';

    // Get lessons with translations and question counts
    const result = await db
      .select({
        id: lessons.id,
        number: lessons.number,
        slug: lessons.slug,
        sortOrder: lessons.sortOrder,
        title: lessonTranslations.title,
        description: lessonTranslations.description,
      })
      .from(lessons)
      .leftJoin(
        lessonTranslations,
        and(
          eq(lessonTranslations.lessonId, lessons.id),
          eq(lessonTranslations.locale, locale)
        )
      )
      .orderBy(lessons.sortOrder);

    // Get question counts for each lesson
    const questionCounts = await db
      .select({
        lessonId: questionLessons.lessonId,
        count: count(questionLessons.questionId),
      })
      .from(questionLessons)
      .groupBy(questionLessons.lessonId);

    const countMap = new Map(questionCounts.map(c => [c.lessonId, Number(c.count)]));

    const lessonsWithCounts: ApiLesson[] = result.map(l => ({
      id: l.id,
      number: l.number,
      slug: l.slug,
      title: l.title,
      description: l.description,
      questionCount: countMap.get(l.id) || 0,
    }));

    res.json(lessonsWithCounts);
  } catch (error) {
    console.error('Error fetching lessons:', error);
    res.status(500).json({ error: 'Failed to fetch lessons' });
  }
});

/**
 * @swagger
 * /api/lessons/{slug}:
 *   get:
 *     summary: Get a single lesson by slug
 *     tags: [Lessons]
 *     parameters:
 *       - name: slug
 *         in: path
 *         required: true
 *         description: Lesson slug (e.g., les-12)
 *         schema:
 *           type: string
 *       - $ref: '#/components/parameters/locale'
 *     responses:
 *       200:
 *         description: Lesson details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Lesson'
 *       404:
 *         description: Lesson not found
 */
lessonsRouter.get('/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const locale = (req.query.locale as string) || 'nl-BE';

    const [lesson] = await db
      .select({
        id: lessons.id,
        number: lessons.number,
        slug: lessons.slug,
        sortOrder: lessons.sortOrder,
        title: lessonTranslations.title,
        description: lessonTranslations.description,
      })
      .from(lessons)
      .leftJoin(
        lessonTranslations,
        and(
          eq(lessonTranslations.lessonId, lessons.id),
          eq(lessonTranslations.locale, locale)
        )
      )
      .where(eq(lessons.slug, slug))
      .limit(1);

    if (!lesson) {
      return res.status(404).json({ error: 'Lesson not found' });
    }

    // Get question count
    const [countResult] = await db
      .select({ count: count(questionLessons.questionId) })
      .from(questionLessons)
      .where(eq(questionLessons.lessonId, lesson.id));

    const response: ApiLesson = {
      id: lesson.id,
      number: lesson.number,
      slug: lesson.slug,
      title: lesson.title,
      description: lesson.description,
      questionCount: Number(countResult?.count || 0),
    };

    res.json(response);
  } catch (error) {
    console.error('Error fetching lesson:', error);
    res.status(500).json({ error: 'Failed to fetch lesson' });
  }
});

/**
 * @swagger
 * /api/lessons/{slug}/questions:
 *   get:
 *     summary: Get questions for a specific lesson
 *     tags: [Lessons]
 *     parameters:
 *       - name: slug
 *         in: path
 *         required: true
 *         description: Lesson slug (e.g., les-12)
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
 *       - name: random
 *         in: query
 *         description: Randomize question order
 *         schema:
 *           type: boolean
 *           default: false
 *     responses:
 *       200:
 *         description: Array of questions for the lesson
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 lesson:
 *                   $ref: '#/components/schemas/Lesson'
 *                 questions:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Question'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     offset:
 *                       type: integer
 *       404:
 *         description: Lesson not found
 */
lessonsRouter.get('/:slug/questions', async (req, res) => {
  try {
    const { slug } = req.params;
    const locale = (req.query.locale as string) || 'nl-BE';
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;
    const random = req.query.random === 'true';

    // Get the lesson
    const [lesson] = await db
      .select({
        id: lessons.id,
        number: lessons.number,
        slug: lessons.slug,
        title: lessonTranslations.title,
        description: lessonTranslations.description,
      })
      .from(lessons)
      .leftJoin(
        lessonTranslations,
        and(
          eq(lessonTranslations.lessonId, lessons.id),
          eq(lessonTranslations.locale, locale)
        )
      )
      .where(eq(lessons.slug, slug))
      .limit(1);

    if (!lesson) {
      return res.status(404).json({ error: 'Lesson not found' });
    }

    // Get total count
    const [countResult] = await db
      .select({ count: count(questionLessons.questionId) })
      .from(questionLessons)
      .where(eq(questionLessons.lessonId, lesson.id));
    const total = Number(countResult?.count || 0);

    // Get question IDs for this lesson
    const questionIdsQuery = db
      .select({ questionId: questionLessons.questionId })
      .from(questionLessons)
      .where(eq(questionLessons.lessonId, lesson.id));

    // Build the main query
    let query = db
      .select({
        id: questions.id,
        originalId: questions.originalId,
        answerType: questions.answerType,
        answer: questions.answer,
        isMajorFault: questions.isMajorFault,
        questionText: questionTranslations.questionText,
        explanation: questionTranslations.explanation,
        categorySlug: categories.slug,
        categoryTitle: categoryTranslations.title,
        regionCode: regions.code,
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
      .leftJoin(categories, eq(categories.id, questions.categoryId))
      .leftJoin(
        categoryTranslations,
        and(
          eq(categoryTranslations.categoryId, categories.id),
          eq(categoryTranslations.locale, locale)
        )
      )
      .leftJoin(regions, eq(regions.id, questions.regionId))
      .leftJoin(assets, eq(assets.id, questions.imageAssetId))
      .where(sql`${questions.id} IN (${questionIdsQuery})`)
      .limit(limit)
      .offset(offset);

    // Apply ordering
    const result = random
      ? await query.orderBy(sql`RANDOM()`)
      : await query.orderBy(questions.id);

    // Fetch choices for each question
    const questionsWithChoices: ApiQuestion[] = await Promise.all(
      result.map(async (q) => {
        const questionChoices = await db
          .select({
            position: choices.position,
            text: choiceTranslations.text,
            imageUuid: assets.uuid,
          })
          .from(choices)
          .leftJoin(
            choiceTranslations,
            and(
              eq(choiceTranslations.choiceId, choices.id),
              eq(choiceTranslations.locale, locale)
            )
          )
          .leftJoin(assets, eq(assets.id, choices.imageAssetId))
          .where(eq(choices.questionId, q.id))
          .orderBy(choices.position);

        const choicesFormatted: ApiChoice[] = questionChoices.map(c => ({
          position: c.position,
          text: c.text,
          imageUrl: getAssetUrl(c.imageUuid),
        }));

        return {
          id: q.id,
          originalId: q.originalId,
          answerType: q.answerType as ApiQuestion['answerType'],
          answer: q.answer,
          isMajorFault: q.isMajorFault,
          questionText: q.questionText,
          explanation: q.explanation,
          category: {
            slug: q.categorySlug,
            title: q.categoryTitle,
          },
          region: q.regionCode ? { code: q.regionCode, name: null } : null,
          imageUrl: getAssetUrl(q.imageUuid),
          choices: choicesFormatted,
          lessons: [{
            number: lesson.number,
            slug: lesson.slug,
            title: lesson.title,
          }],
        };
      })
    );

    res.json({
      lesson: {
        id: lesson.id,
        number: lesson.number,
        slug: lesson.slug,
        title: lesson.title,
        description: lesson.description,
        questionCount: total,
      },
      questions: questionsWithChoices,
      pagination: {
        total,
        limit,
        offset,
      },
    });
  } catch (error) {
    console.error('Error fetching lesson questions:', error);
    res.status(500).json({ error: 'Failed to fetch lesson questions' });
  }
});

