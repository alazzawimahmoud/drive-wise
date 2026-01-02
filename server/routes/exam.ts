import { Router } from 'express';
import { db } from '../db/index.js';
import { questions, questionTranslations, choices, choiceTranslations, assets, regions, categories, categoryTranslations, questionLessons, lessons, lessonTranslations } from '../db/schema.js';
import { eq, and, sql, inArray } from 'drizzle-orm';
import type { ExamConfig, ExamResult, AnswerSubmission, ApiQuestionLesson } from '../types/index.js';

export const examRouter = Router();

// Belgian driving theory exam configuration
const EXAM_CONFIG: ExamConfig = {
  totalQuestions: 50,
  passThreshold: 41,
  majorFaultPenalty: 5,
  minorFaultPenalty: 1,
  maxScore: 50,
  timeLimitMinutes: 90,
};

const ASSETS_BASE_URL = 'https://storage.googleapis.com/be-on-the-road.appspot.com/files_uuidNames';

function getAssetUrl(uuid: string | null): string | null {
  if (!uuid) return null;
  return `${ASSETS_BASE_URL}/${uuid}`;
}

/**
 * @swagger
 * /api/exam/config:
 *   get:
 *     summary: Get exam configuration
 *     description: Returns the Belgian driving theory exam rules and configuration
 *     tags: [Exam]
 *     responses:
 *       200:
 *         description: Exam configuration
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ExamConfig'
 */
examRouter.get('/config', (_req, res) => {
  res.json(EXAM_CONFIG);
});

/**
 * @swagger
 * /api/exam/generate:
 *   post:
 *     summary: Generate a new exam
 *     description: Generates 50 random questions for a complete driving theory exam
 *     tags: [Exam]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               locale:
 *                 type: string
 *                 enum: [nl-BE, fr-BE, de-BE, en]
 *                 default: nl-BE
 *     responses:
 *       200:
 *         description: Generated exam with questions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 config:
 *                   $ref: '#/components/schemas/ExamConfig'
 *                 generatedAt:
 *                   type: string
 *                   format: date-time
 *                 questions:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Question'
 */
examRouter.post('/generate', async (req, res) => {
  try {
    const locale = (req.body.locale as string) || 'nl-BE';

    // Generate 50 random questions for the exam
    const examQuestions = await db
      .select({
        id: questions.id,
        originalId: questions.originalId,
        answerType: questions.answerType,
        isMajorFault: questions.isMajorFault,
        questionText: questionTranslations.questionText,
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
      .limit(EXAM_CONFIG.totalQuestions);

    // Fetch choices and lessons for each question
    const questionsWithChoices = await Promise.all(
      examQuestions.map(async (q) => {
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
          .where(eq(choices.questionId, q.id))
          .orderBy(choices.position);

        // Fetch lessons
        const questionLessonsList = await db
          .select({
            number: lessons.number,
            slug: lessons.slug,
            title: lessonTranslations.title,
          })
          .from(questionLessons)
          .innerJoin(lessons, eq(lessons.id, questionLessons.lessonId))
          .leftJoin(
            lessonTranslations,
            and(
              eq(lessonTranslations.lessonId, lessons.id),
              eq(lessonTranslations.locale, locale)
            )
          )
          .where(eq(questionLessons.questionId, q.id))
          .orderBy(lessons.number);

        const lessonsFormatted: ApiQuestionLesson[] = questionLessonsList.map(l => ({
          number: l.number,
          slug: l.slug,
          title: l.title,
        }));

        return {
          id: q.id,
          originalId: q.originalId,
          answerType: q.answerType,
          isMajorFault: q.isMajorFault,
          questionText: q.questionText,
          category: {
            slug: q.categorySlug,
            title: q.categoryTitle,
          },
          region: q.regionCode,
          imageUrl: getAssetUrl(q.imageUuid),
          choices: questionChoices.map(c => ({
            position: c.position,
            text: c.text,
            imageUrl: getAssetUrl(c.imageUuid),
          })),
          lessons: lessonsFormatted,
        };
      })
    );

    res.json({
      config: EXAM_CONFIG,
      generatedAt: new Date().toISOString(),
      questions: questionsWithChoices,
    });
  } catch (error) {
    console.error('Error generating exam:', error);
    res.status(500).json({ error: 'Failed to generate exam' });
  }
});

/**
 * @swagger
 * /api/exam/score:
 *   post:
 *     summary: Score an exam
 *     description: Calculate the score for submitted exam answers using Belgian scoring rules
 *     tags: [Exam]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - answers
 *             properties:
 *               answers:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - questionId
 *                     - answer
 *                   properties:
 *                     questionId:
 *                       type: integer
 *                     answer:
 *                       oneOf:
 *                         - type: integer
 *                         - type: string
 *                         - type: array
 *                           items:
 *                             type: integer
 *     responses:
 *       200:
 *         description: Exam score and detailed results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 result:
 *                   $ref: '#/components/schemas/ExamResult'
 *                 details:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       questionId:
 *                         type: integer
 *                       submitted:
 *                         oneOf:
 *                           - type: integer
 *                           - type: string
 *                           - type: array
 *                       correct:
 *                         oneOf:
 *                           - type: integer
 *                           - type: string
 *                           - type: array
 *                       isCorrect:
 *                         type: boolean
 *                       isMajorFault:
 *                         type: boolean
 *       400:
 *         description: Invalid request body
 */
examRouter.post('/score', async (req, res) => {
  try {
    const { answers } = req.body as { answers: AnswerSubmission[] };

    if (!answers || !Array.isArray(answers)) {
      return res.status(400).json({ error: 'answers array is required' });
    }

    // Fetch correct answers for all submitted questions
    const questionIds = answers.map(a => a.questionId);
    
    const correctAnswers = await db
      .select({
        id: questions.id,
        answer: questions.answer,
        isMajorFault: questions.isMajorFault,
      })
      .from(questions)
      .where(inArray(questions.id, questionIds));

    const answerMap = new Map(correctAnswers.map(q => [q.id, q]));

    let correct = 0;
    let incorrect = 0;
    let majorFaults = 0;
    let minorFaults = 0;

    const details = answers.map(submitted => {
      const question = answerMap.get(submitted.questionId);
      if (!question) {
        return { questionId: submitted.questionId, error: 'Question not found' };
      }

      const isCorrect = JSON.stringify(submitted.answer) === JSON.stringify(question.answer);
      
      if (isCorrect) {
        correct++;
      } else {
        incorrect++;
        if (question.isMajorFault) {
          majorFaults++;
        } else {
          minorFaults++;
        }
      }

      return {
        questionId: submitted.questionId,
        submitted: submitted.answer,
        correct: question.answer,
        isCorrect,
        isMajorFault: question.isMajorFault,
      };
    });

    // Calculate score
    const penalty = (majorFaults * EXAM_CONFIG.majorFaultPenalty) + (minorFaults * EXAM_CONFIG.minorFaultPenalty);
    const score = Math.max(0, EXAM_CONFIG.maxScore - penalty);
    const passed = correct >= EXAM_CONFIG.passThreshold;

    const result: ExamResult = {
      totalQuestions: answers.length,
      correct,
      incorrect,
      majorFaults,
      minorFaults,
      score,
      maxScore: EXAM_CONFIG.maxScore,
      passed,
      passThreshold: EXAM_CONFIG.passThreshold,
      percentage: Math.round((correct / answers.length) * 100),
    };

    res.json({ result, details });
  } catch (error) {
    console.error('Error scoring exam:', error);
    res.status(500).json({ error: 'Failed to score exam' });
  }
});
