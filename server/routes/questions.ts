import { Router } from 'express';
import { db } from '../db/index.js';
import { questions, questionTranslations, choices, choiceTranslations, assets, regions, categories, categoryTranslations } from '../db/schema.js';
import { eq, and, sql } from 'drizzle-orm';
import type { ApiQuestion, ApiChoice } from '../types/index.js';

export const questionsRouter = Router();

// Helper to build full asset URL
const ASSETS_BASE_URL = 'https://storage.googleapis.com/be-on-the-road.appspot.com/files_uuidNames';

function getAssetUrl(uuid: string | null, type: 'image' | 'video' = 'image'): string | null {
  if (!uuid) return null;
  if (type === 'video') return `https://www.youtube.com/watch?v=${uuid.replace('video-', '')}`;
  return `${ASSETS_BASE_URL}/${uuid}`;
}

/**
 * @swagger
 * /api/questions/random:
 *   get:
 *     summary: Get random questions
 *     tags: [Questions]
 *     parameters:
 *       - name: count
 *         in: query
 *         description: Number of random questions to return
 *         schema:
 *           type: integer
 *           default: 10
 *           maximum: 50
 *       - $ref: '#/components/parameters/locale'
 *       - name: category
 *         in: query
 *         description: Filter by category slug
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Array of random questions
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Question'
 */
questionsRouter.get('/random', async (req, res) => {
  try {
    const count = Math.min(parseInt(req.query.count as string) || 10, 50);
    const locale = (req.query.locale as string) || 'nl-BE';

    const result = await db
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
      .orderBy(sql`RANDOM()`)
      .limit(count);

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
        };
      })
    );

    res.json(questionsWithChoices);
  } catch (error) {
    console.error('Error fetching random questions:', error);
    res.status(500).json({ error: 'Failed to fetch questions' });
  }
});

/**
 * @swagger
 * /api/questions/{id}:
 *   get:
 *     summary: Get a single question by ID
 *     tags: [Questions]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Question ID
 *         schema:
 *           type: integer
 *       - $ref: '#/components/parameters/locale'
 *       - name: include_original
 *         in: query
 *         description: Include original text before rephrasing
 *         schema:
 *           type: boolean
 *           default: false
 *     responses:
 *       200:
 *         description: Question details with choices
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Question'
 *                 - type: object
 *                   properties:
 *                     questionTextOriginal:
 *                       type: string
 *                       description: Original text before rephrasing (if include_original=true)
 *                     explanationOriginal:
 *                       type: string
 *                       description: Original explanation before rephrasing (if include_original=true)
 *       400:
 *         description: Invalid question ID
 *       404:
 *         description: Question not found
 */
questionsRouter.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const locale = (req.query.locale as string) || 'nl-BE';
    const includeOriginal = req.query.include_original === 'true';

    const questionId = parseInt(id);
    if (isNaN(questionId)) {
      return res.status(400).json({ error: 'Invalid question ID' });
    }

    const [question] = await db
      .select({
        id: questions.id,
        originalId: questions.originalId,
        answerType: questions.answerType,
        answer: questions.answer,
        isMajorFault: questions.isMajorFault,
        source: questions.source,
        questionText: questionTranslations.questionText,
        questionTextOriginal: questionTranslations.questionTextOriginal,
        explanation: questionTranslations.explanation,
        explanationOriginal: questionTranslations.explanationOriginal,
        categorySlug: categories.slug,
        categoryTitle: categoryTranslations.title,
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
      .where(eq(questions.id, questionId))
      .limit(1);

    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    // Fetch choices
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
      .where(eq(choices.questionId, questionId))
      .orderBy(choices.position);

    const response: ApiQuestion & { questionTextOriginal?: string; explanationOriginal?: string } = {
      id: question.id,
      originalId: question.originalId,
      answerType: question.answerType as ApiQuestion['answerType'],
      answer: question.answer,
      isMajorFault: question.isMajorFault,
      questionText: question.questionText,
      explanation: question.explanation,
      category: {
        slug: question.categorySlug,
        title: question.categoryTitle,
      },
      region: question.regionCode ? {
        code: question.regionCode,
        name: question.regionName,
      } : null,
      imageUrl: getAssetUrl(question.imageUuid),
      choices: questionChoices.map(c => ({
        position: c.position,
        text: c.text,
        imageUrl: getAssetUrl(c.imageUuid),
      })),
    };

    if (includeOriginal) {
      response.questionTextOriginal = question.questionTextOriginal ?? undefined;
      response.explanationOriginal = question.explanationOriginal ?? undefined;
    }

    res.json(response);
  } catch (error) {
    console.error('Error fetching question:', error);
    res.status(500).json({ error: 'Failed to fetch question' });
  }
});
