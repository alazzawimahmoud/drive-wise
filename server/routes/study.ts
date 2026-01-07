import { Router } from 'express';
import { db } from '../db/index.js';
import { 
  lessons, 
  lessonTranslations, 
  questionLessons, 
  questions, 
  questionTranslations, 
  choices, 
  choiceTranslations, 
  assets, 
  regions, 
  categories, 
  categoryTranslations,
  studyProgress,
  studyQuestionStatus,
  userBookmarks
} from '../db/schema.js';
import { eq, and, sql, count, countDistinct, inArray } from 'drizzle-orm';
import type { ApiLessonWithProgress, ApiStudyQuestion, ApiStudyOverview, ApiChoice, ApiQuestionLesson } from '../types/index.js';
import { optionalAuth, requireAuth } from '../middleware/auth.js';
import { getAssetUrl } from '../config.js';

export const studyRouter = Router();

/**
 * @swagger
 * /api/study/lessons:
 *   get:
 *     summary: Get all lessons with study progress
 *     description: Returns all lessons with question counts, major fault counts, and user's study progress
 *     tags: [Study]
 *     parameters:
 *       - $ref: '#/components/parameters/locale'
 *     responses:
 *       200:
 *         description: Array of lessons with progress
 */
studyRouter.get('/lessons', optionalAuth, async (req, res) => {
  try {
    const locale = (req.query.locale as string) || 'nl-BE';
    const userId = req.user?.id;

    // Get lessons with translations
    const lessonsResult = await db
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

    // Get question counts for each lesson (using distinct to avoid counting duplicates)
    const questionCounts = await db
      .select({
        lessonId: questionLessons.lessonId,
        count: countDistinct(questionLessons.questionId),
      })
      .from(questionLessons)
      .groupBy(questionLessons.lessonId);

    const countMap = new Map(questionCounts.map(c => [c.lessonId, Number(c.count)]));

    // Get major fault counts for each lesson
    const majorFaultCounts = await db
      .select({
        lessonId: questionLessons.lessonId,
        count: countDistinct(questionLessons.questionId),
      })
      .from(questionLessons)
      .innerJoin(questions, eq(questions.id, questionLessons.questionId))
      .where(eq(questions.isMajorFault, true))
      .groupBy(questionLessons.lessonId);

    const majorFaultMap = new Map(majorFaultCounts.map(c => [c.lessonId, Number(c.count)]));

    // Get user's study progress if authenticated
    let progressMap = new Map<number, { questionsSeen: number; questionsMastered: number; lastStudiedAt: Date }>();
    if (userId) {
      const progressResult = await db
        .select()
        .from(studyProgress)
        .where(eq(studyProgress.userId, userId));
      
      progressMap = new Map(progressResult.map(p => [p.lessonId, {
        questionsSeen: p.questionsSeen,
        questionsMastered: p.questionsMastered,
        lastStudiedAt: p.lastStudiedAt,
      }]));
    }

    const lessonsWithProgress: ApiLessonWithProgress[] = lessonsResult.map(l => {
      const questionCount = countMap.get(l.id) || 0;
      const progress = progressMap.get(l.id);
      
      return {
        id: l.id,
        number: l.number,
        slug: l.slug,
        title: l.title,
        description: l.description,
        questionCount,
        majorFaultCount: majorFaultMap.get(l.id) || 0,
        progress: progress ? {
          questionsSeen: progress.questionsSeen,
          questionsMastered: progress.questionsMastered,
          percentComplete: questionCount > 0 ? Math.round((progress.questionsSeen / questionCount) * 100) : 0,
          lastStudiedAt: progress.lastStudiedAt,
        } : null,
      };
    });

    res.json(lessonsWithProgress);
  } catch (error) {
    console.error('Error fetching study lessons:', error);
    res.status(500).json({ error: 'Failed to fetch lessons' });
  }
});

/**
 * @swagger
 * /api/study/lessons/{slug}/questions:
 *   get:
 *     summary: Get questions for studying a lesson
 *     description: Returns questions with full answers and explanations for study mode
 *     tags: [Study]
 *     parameters:
 *       - name: slug
 *         in: path
 *         required: true
 *         description: Lesson slug (e.g., les-12)
 *         schema:
 *           type: string
 *       - $ref: '#/components/parameters/locale'
 *       - name: majorFaultsOnly
 *         in: query
 *         description: Only show major fault questions
 *         schema:
 *           type: boolean
 *       - name: unseenOnly
 *         in: query
 *         description: Only show questions user hasn't seen
 *         schema:
 *           type: boolean
 *       - name: needsReview
 *         in: query
 *         description: Only show questions marked for review
 *         schema:
 *           type: boolean
 *       - name: bookmarked
 *         in: query
 *         description: Only show bookmarked questions
 *         schema:
 *           type: boolean
 *       - name: shuffle
 *         in: query
 *         description: Randomize question order
 *         schema:
 *           type: boolean
 *       - name: limit
 *         in: query
 *         description: Maximum questions to return
 *         schema:
 *           type: integer
 *           default: 100
 *       - name: offset
 *         in: query
 *         description: Number of questions to skip
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: Array of questions for studying
 *       404:
 *         description: Lesson not found
 */
studyRouter.get('/lessons/:slug/questions', optionalAuth, async (req, res) => {
  try {
    const { slug } = req.params;
    const locale = (req.query.locale as string) || 'nl-BE';
    // No limit by default - load all questions for the lesson
    const limit = parseInt(req.query.limit as string) || 1000;
    const offset = parseInt(req.query.offset as string) || 0;
    const shuffle = req.query.shuffle === 'true';
    const majorFaultsOnly = req.query.majorFaultsOnly === 'true';
    const unseenOnly = req.query.unseenOnly === 'true';
    const needsReview = req.query.needsReview === 'true';
    const bookmarked = req.query.bookmarked === 'true';
    const userId = req.user?.id;

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

    // Get question IDs for this lesson (deduplicated)
    const lessonQuestionIds = await db
      .select({ questionId: questionLessons.questionId })
      .from(questionLessons)
      .where(eq(questionLessons.lessonId, lesson.id));

    // Deduplicate question IDs in case of duplicate junction entries
    const questionIds = [...new Set(lessonQuestionIds.map(q => q.questionId))];
    
    if (questionIds.length === 0) {
      return res.json({
        lesson: {
          id: lesson.id,
          number: lesson.number,
          slug: lesson.slug,
          title: lesson.title,
          description: lesson.description,
          questionCount: 0,
        },
        questions: [],
        pagination: { total: 0, limit, offset },
      });
    }

    // Get user's study statuses and bookmarks if authenticated
    let statusMap = new Map<number, { status: string; timesSeen: number; lastSeenAt: Date }>();
    let bookmarkSet = new Set<number>();
    
    if (userId) {
      const statuses = await db
        .select()
        .from(studyQuestionStatus)
        .where(and(
          eq(studyQuestionStatus.userId, userId),
          inArray(studyQuestionStatus.questionId, questionIds)
        ));
      
      statusMap = new Map(statuses.map(s => [s.questionId, {
        status: s.status,
        timesSeen: s.timesSeen,
        lastSeenAt: s.lastSeenAt,
      }]));

      const bookmarks = await db
        .select({ questionId: userBookmarks.questionId })
        .from(userBookmarks)
        .where(and(
          eq(userBookmarks.userId, userId),
          inArray(userBookmarks.questionId, questionIds)
        ));
      
      bookmarkSet = new Set(bookmarks.map(b => b.questionId));
    }

    // Apply filters to question IDs
    let filteredQuestionIds = questionIds;

    if (unseenOnly && userId) {
      filteredQuestionIds = filteredQuestionIds.filter(id => !statusMap.has(id));
    }

    if (needsReview && userId) {
      filteredQuestionIds = filteredQuestionIds.filter(id => 
        statusMap.get(id)?.status === 'needs_review'
      );
    }

    if (bookmarked && userId) {
      filteredQuestionIds = filteredQuestionIds.filter(id => bookmarkSet.has(id));
    }

    if (filteredQuestionIds.length === 0) {
      return res.json({
        lesson: {
          id: lesson.id,
          number: lesson.number,
          slug: lesson.slug,
          title: lesson.title,
          description: lesson.description,
          questionCount: questionIds.length,
        },
        questions: [],
        pagination: { total: 0, limit, offset },
      });
    }

    // Build the main query with filters
    const conditions = [inArray(questions.id, filteredQuestionIds)];
    if (majorFaultsOnly) {
      conditions.push(eq(questions.isMajorFault, true));
    }

    // Get total count after filters
    const [countResult] = await db
      .select({ count: count(questions.id) })
      .from(questions)
      .where(and(...conditions));
    const total = Number(countResult?.count || 0);

    // Build the main query - use selectDistinctOn to avoid duplicates from JOINs
    // (DISTINCT ON question ID ensures one row per question)
    let query = db
      .selectDistinctOn([questions.id], {
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
      .where(and(...conditions))
      .limit(limit)
      .offset(offset);

    // Apply ordering (DISTINCT ON requires question.id to be first in ORDER BY)
    // For shuffle, we'll need to re-sort after the query
    const result = await query.orderBy(questions.id);
    
    // If shuffle requested, randomize the result order
    const finalResult = shuffle 
      ? result.sort(() => Math.random() - 0.5)
      : result;

    // Fetch choices and lessons for each question
    const studyQuestions: ApiStudyQuestion[] = await Promise.all(
      finalResult.map(async (q) => {
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

        // Fetch all lessons for this question
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

        const choicesFormatted: ApiChoice[] = questionChoices.map(c => ({
          position: c.position,
          text: c.text,
          imageUrl: getAssetUrl(c.imageUuid),
        }));

        const lessonsFormatted: ApiQuestionLesson[] = questionLessonsList.map(l => ({
          number: l.number,
          slug: l.slug,
          title: l.title,
        }));

        const studyStatus = statusMap.get(q.id);

        return {
          id: q.id,
          originalId: q.originalId,
          answerType: q.answerType as ApiStudyQuestion['answerType'],
          answer: q.answer,
          isMajorFault: q.isMajorFault,
          questionText: q.questionText,
          explanation: q.explanation,
          category: {
            slug: q.categorySlug,
            title: q.categoryTitle,
          },
          region: q.regionCode ? {
            code: q.regionCode,
            name: q.regionName,
          } : null,
          imageUrl: getAssetUrl(q.imageUuid),
          choices: choicesFormatted,
          lessons: lessonsFormatted,
          studyStatus: studyStatus ? {
            status: studyStatus.status as ApiStudyQuestion['studyStatus'] extends null ? never : NonNullable<ApiStudyQuestion['studyStatus']>['status'],
            timesSeen: studyStatus.timesSeen,
            lastSeenAt: studyStatus.lastSeenAt,
          } : null,
          isBookmarked: bookmarkSet.has(q.id),
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
        questionCount: questionIds.length,
      },
      questions: studyQuestions,
      pagination: {
        total,
        limit,
        offset,
      },
    });
  } catch (error) {
    console.error('Error fetching study questions:', error);
    res.status(500).json({ error: 'Failed to fetch questions' });
  }
});

/**
 * @swagger
 * /api/study/mark:
 *   post:
 *     summary: Mark a question's study status
 *     description: Updates the study status for a question (seen, mastered, needs_review)
 *     tags: [Study]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - questionId
 *               - status
 *             properties:
 *               questionId:
 *                 type: integer
 *               status:
 *                 type: string
 *                 enum: [seen, mastered, needs_review]
 *     responses:
 *       200:
 *         description: Status updated successfully
 *       401:
 *         description: Not authenticated
 */
studyRouter.post('/mark', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { questionId, status } = req.body;

    if (!questionId || !status) {
      return res.status(400).json({ error: 'questionId and status are required' });
    }

    if (!['seen', 'mastered', 'needs_review'].includes(status)) {
      return res.status(400).json({ error: 'status must be one of: seen, mastered, needs_review' });
    }

    // Check if question exists
    const [question] = await db
      .select({ id: questions.id })
      .from(questions)
      .where(eq(questions.id, questionId))
      .limit(1);

    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    // Upsert the study status
    const [existing] = await db
      .select()
      .from(studyQuestionStatus)
      .where(and(
        eq(studyQuestionStatus.userId, userId),
        eq(studyQuestionStatus.questionId, questionId)
      ))
      .limit(1);

    if (existing) {
      await db
        .update(studyQuestionStatus)
        .set({
          status,
          timesSeen: existing.timesSeen + 1,
          lastSeenAt: new Date(),
        })
        .where(eq(studyQuestionStatus.id, existing.id));
    } else {
      await db
        .insert(studyQuestionStatus)
        .values({
          userId,
          questionId,
          status,
          timesSeen: 1,
          lastSeenAt: new Date(),
        });
    }

    // Update lesson progress
    const lessonIds = await db
      .select({ lessonId: questionLessons.lessonId })
      .from(questionLessons)
      .where(eq(questionLessons.questionId, questionId));

    for (const { lessonId } of lessonIds) {
      // Count seen and mastered questions for this lesson
      const lessonQuestionIds = await db
        .select({ questionId: questionLessons.questionId })
        .from(questionLessons)
        .where(eq(questionLessons.lessonId, lessonId));

      const qIds = lessonQuestionIds.map(q => q.questionId);
      
      if (qIds.length === 0) continue;

      const stats = await db
        .select({
          seen: sql<number>`count(*)::int`,
          mastered: sql<number>`sum(case when ${studyQuestionStatus.status} = 'mastered' then 1 else 0 end)::int`,
        })
        .from(studyQuestionStatus)
        .where(and(
          eq(studyQuestionStatus.userId, userId),
          inArray(studyQuestionStatus.questionId, qIds)
        ));

      const { seen, mastered } = stats[0] || { seen: 0, mastered: 0 };

      // Upsert study progress
      const [existingProgress] = await db
        .select()
        .from(studyProgress)
        .where(and(
          eq(studyProgress.userId, userId),
          eq(studyProgress.lessonId, lessonId)
        ))
        .limit(1);

      if (existingProgress) {
        await db
          .update(studyProgress)
          .set({
            questionsSeen: seen,
            questionsMastered: mastered,
            lastStudiedAt: new Date(),
          })
          .where(eq(studyProgress.id, existingProgress.id));
      } else {
        await db
          .insert(studyProgress)
          .values({
            userId,
            lessonId,
            questionsSeen: seen,
            questionsMastered: mastered,
            lastStudiedAt: new Date(),
          });
      }
    }

    res.json({ success: true, status });
  } catch (error) {
    console.error('Error marking question:', error);
    res.status(500).json({ error: 'Failed to mark question' });
  }
});

/**
 * @swagger
 * /api/study/progress:
 *   get:
 *     summary: Get overall study progress
 *     description: Returns aggregated study progress across all lessons
 *     tags: [Study]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Study progress overview
 *       401:
 *         description: Not authenticated
 */
studyRouter.get('/progress', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;

    // Get total lessons
    const [lessonCount] = await db
      .select({ count: count(lessons.id) })
      .from(lessons);
    const totalLessons = Number(lessonCount?.count || 0);

    // Get total questions
    const [questionCount] = await db
      .select({ count: count(questions.id) })
      .from(questions);
    const totalQuestions = Number(questionCount?.count || 0);

    // Get user's study stats
    const [studyStats] = await db
      .select({
        lessonsStarted: sql<number>`count(distinct ${studyProgress.lessonId})::int`,
      })
      .from(studyProgress)
      .where(eq(studyProgress.userId, userId));

    // Get question status counts
    const [questionStats] = await db
      .select({
        seen: sql<number>`count(*)::int`,
        mastered: sql<number>`sum(case when ${studyQuestionStatus.status} = 'mastered' then 1 else 0 end)::int`,
        needsReview: sql<number>`sum(case when ${studyQuestionStatus.status} = 'needs_review' then 1 else 0 end)::int`,
      })
      .from(studyQuestionStatus)
      .where(eq(studyQuestionStatus.userId, userId));

    // Count completed lessons (all questions seen)
    const lessonProgressList = await db
      .select({
        lessonId: studyProgress.lessonId,
        questionsSeen: studyProgress.questionsSeen,
      })
      .from(studyProgress)
      .where(eq(studyProgress.userId, userId));

    // Get question counts per lesson
    const lessonQuestionCounts = await db
      .select({
        lessonId: questionLessons.lessonId,
        count: count(questionLessons.questionId),
      })
      .from(questionLessons)
      .groupBy(questionLessons.lessonId);

    const lessonCountMap = new Map(lessonQuestionCounts.map(l => [l.lessonId, Number(l.count)]));

    let lessonsCompleted = 0;
    for (const progress of lessonProgressList) {
      const total = lessonCountMap.get(progress.lessonId) || 0;
      if (total > 0 && progress.questionsSeen >= total) {
        lessonsCompleted++;
      }
    }

    const questionsSeen = Number(questionStats?.seen || 0);
    const questionsMastered = Number(questionStats?.mastered || 0);
    const questionsNeedReview = Number(questionStats?.needsReview || 0);

    const overview: ApiStudyOverview = {
      totalLessons,
      lessonsStarted: studyStats?.lessonsStarted || 0,
      lessonsCompleted,
      totalQuestions,
      questionsSeen,
      questionsMastered,
      questionsNeedReview,
      overallProgress: totalQuestions > 0 ? Math.round((questionsSeen / totalQuestions) * 100) : 0,
    };

    res.json(overview);
  } catch (error) {
    console.error('Error fetching study progress:', error);
    res.status(500).json({ error: 'Failed to fetch progress' });
  }
});

