import { Router } from 'express';
import { db } from '../db/index.js';
import { questions, questionTranslations, choices, choiceTranslations, assets, regions, categories, categoryTranslations, questionLessons, lessons, lessonTranslations, examSessions, examSessionAnswers } from '../db/schema.js';
import { eq, and, sql, inArray, desc } from 'drizzle-orm';
import type { ExamConfig, ExamResult, AnswerSubmission, ApiQuestionLesson } from '../types/index.js';
import { optionalAuth, requireAuth } from '../middleware/auth.js';
import { getAssetUrl } from '../config.js';

export const examRouter = Router();

// Belgian driving theory exam configuration
// In development: 10 questions, 1 minute
// In production: 50 questions, 90 minutes
// const isDev = process.env.NODE_ENV !== 'production';
// const EXAM_CONFIG: ExamConfig = isDev
//   ? {
//       totalQuestions: 10,
//       passThreshold: 8, // 80% of 10 = 8
//       majorFaultPenalty: 5,
//       minorFaultPenalty: 1,
//       maxScore: 10,
//       timeLimitMinutes: 1,
//     }
//   : {
//       totalQuestions: 50,
//       passThreshold: 41,
//       majorFaultPenalty: 5,
//       minorFaultPenalty: 1,
//       maxScore: 50,
//       timeLimitMinutes: 90,
//     };
const EXAM_CONFIG: ExamConfig = {
      totalQuestions: 50,
      passThreshold: 41,
      majorFaultPenalty: 5,
      minorFaultPenalty: 1,
      maxScore: 50,
      timeLimitMinutes: 90,
    };

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
 *     description: Calculate the score for submitted exam answers using Belgian scoring rules. If authenticated, the session is persisted for history and statistics.
 *     tags: [Exam]
 *     security:
 *       - bearerAuth: []
 *       - {}
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
 *               sessionType:
 *                 type: string
 *                 enum: [exam, practice, review]
 *                 default: exam
 *               startedAt:
 *                 type: string
 *                 format: date-time
 *                 description: When the exam was started (for time tracking)
 *               timeTakenSeconds:
 *                 type: integer
 *                 description: Total time taken in seconds
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
 *                 sessionId:
 *                   type: integer
 *                   description: ID of persisted session (only if authenticated)
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
examRouter.post('/score', optionalAuth, async (req, res) => {
  try {
    const { answers, sessionType, startedAt, timeTakenSeconds } = req.body as { 
      answers: AnswerSubmission[]; 
      sessionType?: string;
      startedAt?: string;
      timeTakenSeconds?: number;
    };

    if (!answers || !Array.isArray(answers)) {
      return res.status(400).json({ error: 'answers array is required' });
    }

    const locale = (req.body.locale as string) || 'nl-BE';

    // Fetch correct answers and category IDs for all submitted questions
    const questionIds = answers.map(a => a.questionId);
    
    const correctAnswers = await db
      .select({
        id: questions.id,
        answer: questions.answer,
        answerType: questions.answerType,
        isMajorFault: questions.isMajorFault,
        categoryId: questions.categoryId,
        questionText: questionTranslations.questionText,
        explanation: questionTranslations.explanation,
      })
      .from(questions)
      .leftJoin(
        questionTranslations,
        and(
          eq(questionTranslations.questionId, questions.id),
          eq(questionTranslations.locale, locale)
        )
      )
      .where(inArray(questions.id, questionIds));

    const answerMap = new Map(correctAnswers.map(q => [q.id, q]));

    // Helper function to normalize INPUT answers for comparison
    // Handles both string and number types, trims whitespace, and normalizes the format
    const normalizeInputAnswer = (value: any): string => {
      if (value === null || value === undefined) return '';
      
      // Handle different input types
      let normalized: string;
      if (typeof value === 'number') {
        // Convert number to string (e.g., 150 -> "150")
        normalized = String(value);
      } else if (typeof value === 'string') {
        // Already a string, just trim
        normalized = value.trim();
      } else {
        // Fallback: convert to string and trim
        normalized = String(value).trim();
      }
      
      return normalized;
    };

    let correct = 0;
    let incorrect = 0;
    let majorFaults = 0;
    let minorFaults = 0;

    const details = answers.map(submitted => {
      const question = answerMap.get(submitted.questionId);
      if (!question) {
        return { questionId: submitted.questionId, error: 'Question not found' };
      }

      // Special handling for INPUT type questions - normalize strings and trim whitespace
      let isCorrect: boolean;
      // Check if answerType is INPUT (case-insensitive for safety)
      const isInputType = question.answerType?.toUpperCase() === 'INPUT';
      if (isInputType) {
        const submittedNormalized = normalizeInputAnswer(submitted.answer);
        const correctNormalized = normalizeInputAnswer(question.answer);
        isCorrect = submittedNormalized === correctNormalized;
      } else {
        // For other types (SINGLE_CHOICE, YES_NO, ORDER), use strict JSON comparison
        isCorrect = JSON.stringify(submitted.answer) === JSON.stringify(question.answer);
      }
      
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
        categoryId: question.categoryId,
        submitted: submitted.answer,
        correct: question.answer,
        isCorrect,
        isMajorFault: question.isMajorFault,
        questionText: question.questionText,
        explanation: question.explanation,
      };
    });

    // Calculate score with penalties (major faults = 5 points, minor faults = 1 point)
    const penalty = (majorFaults * EXAM_CONFIG.majorFaultPenalty) + (minorFaults * EXAM_CONFIG.minorFaultPenalty);
    const score = Math.max(0, EXAM_CONFIG.maxScore - penalty);
    const passed = score >= EXAM_CONFIG.passThreshold;
    const percentage = Math.round((score / EXAM_CONFIG.maxScore) * 100);

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
      percentage,
    };

    let sessionId: number | undefined;

    // Persist session if user is authenticated
    if (req.user) {
      const [session] = await db
        .insert(examSessions)
        .values({
          userId: req.user.id,
          sessionType: sessionType || 'exam',
          totalQuestions: answers.length,
          correctAnswers: correct,
          incorrectAnswers: incorrect,
          majorFaults,
          minorFaults,
          score,
          maxScore: EXAM_CONFIG.maxScore,
          passed,
          percentage,
          timeTakenSeconds: timeTakenSeconds || null,
          startedAt: startedAt ? new Date(startedAt) : new Date(),
        })
        .returning();

      sessionId = session.id;

      // Persist individual answers for detailed analytics
      // Note: unanswered questions have null/undefined submitted values - store as special marker
      const answerRecords = details
        .filter((d): d is typeof d & { categoryId: number; isCorrect: boolean; isMajorFault: boolean } => 
          'categoryId' in d && 
          d.categoryId !== undefined && 
          d.isCorrect !== undefined && 
          d.isMajorFault !== undefined
        )
        .map(d => ({
          sessionId: session.id,
          questionId: d.questionId,
          categoryId: d.categoryId,
          submittedAnswer: d.submitted ?? { unanswered: true },
          correctAnswer: d.correct,
          isCorrect: d.isCorrect,
          isMajorFault: d.isMajorFault,
        }));

      if (answerRecords.length > 0) {
        await db.insert(examSessionAnswers).values(answerRecords);
      }
    }

    res.json({ result, sessionId, details });
  } catch (error) {
    console.error('Error scoring exam:', error);
    res.status(500).json({ error: 'Failed to score exam' });
  }
});

/**
 * @swagger
 * /api/exam/history:
 *   get:
 *     summary: Get exam history
 *     description: Returns the authenticated user's exam session history
 *     tags: [Exam]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: limit
 *         in: query
 *         description: Maximum number of sessions to return
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *       - name: offset
 *         in: query
 *         description: Number of sessions to skip
 *         schema:
 *           type: integer
 *           default: 0
 *       - name: sessionType
 *         in: query
 *         description: Filter by session type
 *         schema:
 *           type: string
 *           enum: [exam, practice, review]
 *     responses:
 *       200:
 *         description: List of exam sessions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sessions:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ExamSession'
 *                 total:
 *                   type: integer
 *       401:
 *         description: Not authenticated
 */
examRouter.get('/history', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;
    const sessionType = req.query.sessionType as string | undefined;

    let conditions = eq(examSessions.userId, userId);
    if (sessionType && ['exam', 'practice', 'review'].includes(sessionType)) {
      conditions = and(conditions, eq(examSessions.sessionType, sessionType))!;
    }

    const sessions = await db
      .select()
      .from(examSessions)
      .where(conditions)
      .orderBy(desc(examSessions.completedAt))
      .limit(limit)
      .offset(offset);

    // Get total count
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(examSessions)
      .where(conditions);

    res.json({
      sessions: sessions.map(s => ({
        id: s.id,
        sessionType: s.sessionType,
        totalQuestions: s.totalQuestions,
        correctAnswers: s.correctAnswers,
        incorrectAnswers: s.incorrectAnswers,
        majorFaults: s.majorFaults,
        minorFaults: s.minorFaults,
        score: s.score,
        maxScore: s.maxScore,
        passed: s.passed,
        percentage: s.percentage,
        timeTakenSeconds: s.timeTakenSeconds,
        startedAt: s.startedAt,
        completedAt: s.completedAt,
      })),
      total: count,
    });
  } catch (error) {
    console.error('Error fetching exam history:', error);
    res.status(500).json({ error: 'Failed to fetch exam history' });
  }
});

/**
 * @swagger
 * /api/exam/session/{id}:
 *   get:
 *     summary: Get exam session details
 *     description: Returns detailed information about a specific exam session including all answers
 *     tags: [Exam]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Session ID
 *         schema:
 *           type: integer
 *       - $ref: '#/components/parameters/locale'
 *     responses:
 *       200:
 *         description: Session details with answers
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Session not found
 */
examRouter.get('/session/:id', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const sessionId = parseInt(req.params.id);
    const locale = (req.query.locale as string) || 'nl-BE';

    if (isNaN(sessionId)) {
      return res.status(400).json({ error: 'Invalid session ID' });
    }

    // Fetch session (verify ownership)
    const [session] = await db
      .select()
      .from(examSessions)
      .where(and(
        eq(examSessions.id, sessionId),
        eq(examSessions.userId, userId)
      ))
      .limit(1);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Fetch answers with question details
    const answers = await db
      .select({
        questionId: examSessionAnswers.questionId,
        submittedAnswer: examSessionAnswers.submittedAnswer,
        correctAnswer: examSessionAnswers.correctAnswer,
        isCorrect: examSessionAnswers.isCorrect,
        isMajorFault: examSessionAnswers.isMajorFault,
        questionText: questionTranslations.questionText,
        explanation: questionTranslations.explanation,
        categorySlug: categories.slug,
        categoryTitle: categoryTranslations.title,
      })
      .from(examSessionAnswers)
      .innerJoin(questions, eq(questions.id, examSessionAnswers.questionId))
      .leftJoin(
        questionTranslations,
        and(
          eq(questionTranslations.questionId, questions.id),
          eq(questionTranslations.locale, locale)
        )
      )
      .leftJoin(categories, eq(categories.id, examSessionAnswers.categoryId))
      .leftJoin(
        categoryTranslations,
        and(
          eq(categoryTranslations.categoryId, categories.id),
          eq(categoryTranslations.locale, locale)
        )
      )
      .where(eq(examSessionAnswers.sessionId, sessionId));

    res.json({
      session: {
        id: session.id,
        sessionType: session.sessionType,
        totalQuestions: session.totalQuestions,
        correctAnswers: session.correctAnswers,
        incorrectAnswers: session.incorrectAnswers,
        majorFaults: session.majorFaults,
        minorFaults: session.minorFaults,
        score: session.score,
        maxScore: session.maxScore,
        passed: session.passed,
        percentage: session.percentage,
        timeTakenSeconds: session.timeTakenSeconds,
        startedAt: session.startedAt,
        completedAt: session.completedAt,
      },
      answers: answers.map(a => ({
        questionId: a.questionId,
        submittedAnswer: a.submittedAnswer,
        correctAnswer: a.correctAnswer,
        isCorrect: a.isCorrect,
        isMajorFault: a.isMajorFault,
        questionText: a.questionText,
        explanation: a.explanation,
        category: {
          slug: a.categorySlug,
          title: a.categoryTitle,
        },
      })),
    });
  } catch (error) {
    console.error('Error fetching session details:', error);
    res.status(500).json({ error: 'Failed to fetch session details' });
  }
});
