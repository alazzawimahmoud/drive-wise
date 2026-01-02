import { Router } from 'express';
import { db } from '../db/index.js';
import { examSessions, examSessionAnswers, categories, categoryTranslations, questions, questionTranslations } from '../db/schema.js';
import { eq, and, sql, desc, gte } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth.js';

export const statsRouter = Router();

// All stats routes require authentication
statsRouter.use(requireAuth);

/**
 * @swagger
 * /api/stats/overview:
 *   get:
 *     summary: Get user statistics overview
 *     description: Returns aggregated performance statistics including pass rate, license probability, and progress
 *     tags: [Statistics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User statistics overview
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StatsOverview'
 *       401:
 *         description: Not authenticated
 */
statsRouter.get('/overview', async (req, res) => {
  try {
    const userId = req.user!.id;

    // Get overall session stats
    const sessionStats = await db
      .select({
        totalSessions: sql<number>`count(*)::int`,
        passedSessions: sql<number>`sum(case when ${examSessions.passed} then 1 else 0 end)::int`,
        avgScore: sql<number>`avg(${examSessions.score})::float`,
        avgPercentage: sql<number>`avg(${examSessions.percentage})::float`,
        totalQuestionsAnswered: sql<number>`sum(${examSessions.totalQuestions})::int`,
        totalCorrect: sql<number>`sum(${examSessions.correctAnswers})::int`,
        totalIncorrect: sql<number>`sum(${examSessions.incorrectAnswers})::int`,
        totalMajorFaults: sql<number>`sum(${examSessions.majorFaults})::int`,
        bestScore: sql<number>`max(${examSessions.score})::int`,
        worstScore: sql<number>`min(${examSessions.score})::int`,
      })
      .from(examSessions)
      .where(eq(examSessions.userId, userId));

    const stats = sessionStats[0];

    // Get recent trend (last 10 sessions)
    const recentSessions = await db
      .select({
        score: examSessions.score,
        percentage: examSessions.percentage,
        passed: examSessions.passed,
        completedAt: examSessions.completedAt,
      })
      .from(examSessions)
      .where(eq(examSessions.userId, userId))
      .orderBy(desc(examSessions.completedAt))
      .limit(10);

    // Calculate license probability based on recent performance
    // Weight recent exams more heavily
    let licenseProbability = 0;
    if (recentSessions.length > 0) {
      const weights = recentSessions.map((_, i) => Math.pow(0.9, i)); // More recent = higher weight
      const weightSum = weights.reduce((a, b) => a + b, 0);
      
      const weightedScore = recentSessions.reduce((sum, session, i) => {
        // Use percentage as base, bonus for passing
        const sessionScore = session.passed ? 
          Math.min(100, session.percentage + 10) : 
          session.percentage;
        return sum + (sessionScore * weights[i]);
      }, 0);
      
      licenseProbability = Math.round(weightedScore / weightSum);
    }

    // Get streak info (consecutive passed exams)
    let currentStreak = 0;
    for (const session of recentSessions) {
      if (session.passed) {
        currentStreak++;
      } else {
        break;
      }
    }

    // Calculate improvement (compare first half vs second half of sessions)
    let improvement = null;
    if (recentSessions.length >= 4) {
      const halfPoint = Math.floor(recentSessions.length / 2);
      const recentHalf = recentSessions.slice(0, halfPoint);
      const olderHalf = recentSessions.slice(halfPoint);
      
      const recentAvg = recentHalf.reduce((sum, s) => sum + s.percentage, 0) / recentHalf.length;
      const olderAvg = olderHalf.reduce((sum, s) => sum + s.percentage, 0) / olderHalf.length;
      
      improvement = Math.round(recentAvg - olderAvg);
    }

    res.json({
      totalSessions: stats.totalSessions || 0,
      passedSessions: stats.passedSessions || 0,
      passRate: stats.totalSessions ? Math.round((stats.passedSessions / stats.totalSessions) * 100) : 0,
      averageScore: stats.avgScore ? Math.round(stats.avgScore * 10) / 10 : 0,
      averagePercentage: stats.avgPercentage ? Math.round(stats.avgPercentage) : 0,
      totalQuestionsAnswered: stats.totalQuestionsAnswered || 0,
      totalCorrect: stats.totalCorrect || 0,
      totalIncorrect: stats.totalIncorrect || 0,
      overallAccuracy: stats.totalQuestionsAnswered ? 
        Math.round((stats.totalCorrect / stats.totalQuestionsAnswered) * 100) : 0,
      totalMajorFaults: stats.totalMajorFaults || 0,
      bestScore: stats.bestScore || 0,
      worstScore: stats.worstScore || 0,
      licenseProbability,
      currentStreak,
      improvement,
      recentTrend: recentSessions.map(s => ({
        score: s.score,
        percentage: s.percentage,
        passed: s.passed,
        completedAt: s.completedAt,
      })),
    });
  } catch (error) {
    console.error('Error fetching stats overview:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

/**
 * @swagger
 * /api/stats/categories:
 *   get:
 *     summary: Get performance by category
 *     description: Returns accuracy statistics broken down by question category, helping identify weak areas
 *     tags: [Statistics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/locale'
 *     responses:
 *       200:
 *         description: Category performance statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 categories:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/CategoryStats'
 *                 weakestCategory:
 *                   $ref: '#/components/schemas/CategoryStats'
 *                 strongestCategory:
 *                   $ref: '#/components/schemas/CategoryStats'
 *       401:
 *         description: Not authenticated
 */
statsRouter.get('/categories', async (req, res) => {
  try {
    const userId = req.user!.id;
    const locale = (req.query.locale as string) || 'nl-BE';

    // Get performance by category
    const categoryStats = await db
      .select({
        categoryId: examSessionAnswers.categoryId,
        categorySlug: categories.slug,
        categoryTitle: categoryTranslations.title,
        totalAnswered: sql<number>`count(*)::int`,
        correctAnswers: sql<number>`sum(case when ${examSessionAnswers.isCorrect} then 1 else 0 end)::int`,
        majorFaults: sql<number>`sum(case when ${examSessionAnswers.isMajorFault} and not ${examSessionAnswers.isCorrect} then 1 else 0 end)::int`,
      })
      .from(examSessionAnswers)
      .innerJoin(examSessions, eq(examSessions.id, examSessionAnswers.sessionId))
      .innerJoin(categories, eq(categories.id, examSessionAnswers.categoryId))
      .leftJoin(
        categoryTranslations,
        and(
          eq(categoryTranslations.categoryId, categories.id),
          eq(categoryTranslations.locale, locale)
        )
      )
      .where(eq(examSessions.userId, userId))
      .groupBy(examSessionAnswers.categoryId, categories.slug, categoryTranslations.title)
      .orderBy(sql`(sum(case when ${examSessionAnswers.isCorrect} then 1 else 0 end)::float / count(*))`);

    const formattedStats = categoryStats.map(cat => ({
      categoryId: cat.categoryId,
      slug: cat.categorySlug,
      title: cat.categoryTitle,
      totalAnswered: cat.totalAnswered,
      correctAnswers: cat.correctAnswers,
      incorrectAnswers: cat.totalAnswered - cat.correctAnswers,
      accuracy: Math.round((cat.correctAnswers / cat.totalAnswered) * 100),
      majorFaults: cat.majorFaults,
    }));

    // Find weakest and strongest (only if they have enough data)
    const significantCategories = formattedStats.filter(c => c.totalAnswered >= 5);
    
    const weakestCategory = significantCategories.length > 0 ? 
      significantCategories[0] : null; // Already sorted by accuracy ascending
    
    const strongestCategory = significantCategories.length > 0 ? 
      significantCategories[significantCategories.length - 1] : null;

    res.json({
      categories: formattedStats,
      weakestCategory,
      strongestCategory,
    });
  } catch (error) {
    console.error('Error fetching category stats:', error);
    res.status(500).json({ error: 'Failed to fetch category statistics' });
  }
});

/**
 * @swagger
 * /api/stats/progress:
 *   get:
 *     summary: Get progress over time
 *     description: Returns performance metrics over time for tracking improvement
 *     tags: [Statistics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: period
 *         in: query
 *         description: Time period for grouping
 *         schema:
 *           type: string
 *           enum: [day, week, month]
 *           default: week
 *       - name: limit
 *         in: query
 *         description: Number of periods to return
 *         schema:
 *           type: integer
 *           default: 12
 *     responses:
 *       200:
 *         description: Progress data over time
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 progress:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       period:
 *                         type: string
 *                       sessions:
 *                         type: integer
 *                       avgPercentage:
 *                         type: number
 *                       passRate:
 *                         type: number
 *       401:
 *         description: Not authenticated
 */
statsRouter.get('/progress', async (req, res) => {
  try {
    const userId = req.user!.id;
    const period = (req.query.period as string) || 'week';
    const limit = Math.min(parseInt(req.query.limit as string) || 12, 52);

    // Determine date truncation based on period
    let dateTrunc: 'day' | 'week' | 'month' = 'week';
    if (period === 'day') dateTrunc = 'day';
    else if (period === 'month') dateTrunc = 'month';

    const progress = await db
      .select({
        period: sql<string>`date_trunc(${dateTrunc}, ${examSessions.completedAt})::date::text`,
        sessions: sql<number>`count(*)::int`,
        avgPercentage: sql<number>`avg(${examSessions.percentage})::float`,
        avgScore: sql<number>`avg(${examSessions.score})::float`,
        passedCount: sql<number>`sum(case when ${examSessions.passed} then 1 else 0 end)::int`,
        totalCorrect: sql<number>`sum(${examSessions.correctAnswers})::int`,
        totalQuestions: sql<number>`sum(${examSessions.totalQuestions})::int`,
      })
      .from(examSessions)
      .where(eq(examSessions.userId, userId))
      .groupBy(sql`date_trunc(${dateTrunc}, ${examSessions.completedAt})`)
      .orderBy(desc(sql`date_trunc(${dateTrunc}, ${examSessions.completedAt})`))
      .limit(limit);

    const formattedProgress = progress.map(p => ({
      period: p.period,
      sessions: p.sessions,
      avgPercentage: Math.round(p.avgPercentage),
      avgScore: Math.round(p.avgScore * 10) / 10,
      passRate: Math.round((p.passedCount / p.sessions) * 100),
      accuracy: Math.round((p.totalCorrect / p.totalQuestions) * 100),
    })).reverse(); // Chronological order

    res.json({ progress: formattedProgress });
  } catch (error) {
    console.error('Error fetching progress:', error);
    res.status(500).json({ error: 'Failed to fetch progress' });
  }
});

/**
 * @swagger
 * /api/stats/difficult-questions:
 *   get:
 *     summary: Get most missed questions
 *     description: Returns questions the user has answered incorrectly most often
 *     tags: [Statistics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: limit
 *         in: query
 *         description: Number of questions to return
 *         schema:
 *           type: integer
 *           default: 10
 *       - $ref: '#/components/parameters/locale'
 *     responses:
 *       200:
 *         description: List of difficult questions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 questions:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       questionId:
 *                         type: integer
 *                       timesAnswered:
 *                         type: integer
 *                       timesIncorrect:
 *                         type: integer
 *                       accuracy:
 *                         type: number
 *       401:
 *         description: Not authenticated
 */
statsRouter.get('/difficult-questions', async (req, res) => {
  try {
    const userId = req.user!.id;
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
    const locale = (req.query.locale as string) || 'nl-BE';

    const difficultQuestions = await db
      .select({
        questionId: examSessionAnswers.questionId,
        timesAnswered: sql<number>`count(*)::int`,
        timesCorrect: sql<number>`sum(case when ${examSessionAnswers.isCorrect} then 1 else 0 end)::int`,
        timesIncorrect: sql<number>`sum(case when not ${examSessionAnswers.isCorrect} then 1 else 0 end)::int`,
        questionText: questionTranslations.questionText,
        categorySlug: categories.slug,
        categoryTitle: categoryTranslations.title,
        isMajorFault: sql<boolean>`bool_or(${examSessionAnswers.isMajorFault})`,
      })
      .from(examSessionAnswers)
      .innerJoin(examSessions, eq(examSessions.id, examSessionAnswers.sessionId))
      .innerJoin(questions, eq(questions.id, examSessionAnswers.questionId))
      .leftJoin(
        questionTranslations,
        and(
          eq(questionTranslations.questionId, questions.id),
          eq(questionTranslations.locale, locale)
        )
      )
      .innerJoin(categories, eq(categories.id, examSessionAnswers.categoryId))
      .leftJoin(
        categoryTranslations,
        and(
          eq(categoryTranslations.categoryId, categories.id),
          eq(categoryTranslations.locale, locale)
        )
      )
      .where(eq(examSessions.userId, userId))
      .groupBy(
        examSessionAnswers.questionId, 
        questionTranslations.questionText,
        categories.slug,
        categoryTranslations.title
      )
      .having(sql`sum(case when not ${examSessionAnswers.isCorrect} then 1 else 0 end) > 0`)
      .orderBy(desc(sql`sum(case when not ${examSessionAnswers.isCorrect} then 1 else 0 end)::float / count(*)`))
      .limit(limit);

    const formattedQuestions = difficultQuestions.map(q => ({
      questionId: q.questionId,
      questionText: q.questionText,
      category: {
        slug: q.categorySlug,
        title: q.categoryTitle,
      },
      timesAnswered: q.timesAnswered,
      timesCorrect: q.timesCorrect,
      timesIncorrect: q.timesIncorrect,
      accuracy: Math.round((q.timesCorrect / q.timesAnswered) * 100),
      isMajorFault: q.isMajorFault,
    }));

    res.json({ questions: formattedQuestions });
  } catch (error) {
    console.error('Error fetching difficult questions:', error);
    res.status(500).json({ error: 'Failed to fetch difficult questions' });
  }
});

/**
 * @swagger
 * /api/stats/ready-for-exam:
 *   get:
 *     summary: Check exam readiness
 *     description: Analyzes user's performance to determine if they're ready to take the real exam
 *     tags: [Statistics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Exam readiness assessment
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ready:
 *                   type: boolean
 *                 confidence:
 *                   type: integer
 *                   description: Confidence percentage (0-100)
 *                 recommendations:
 *                   type: array
 *                   items:
 *                     type: string
 *                 metrics:
 *                   type: object
 *       401:
 *         description: Not authenticated
 */
statsRouter.get('/ready-for-exam', async (req, res) => {
  try {
    const userId = req.user!.id;
    const locale = (req.query.locale as string) || 'nl-BE';

    // Get recent exam sessions (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentSessions = await db
      .select()
      .from(examSessions)
      .where(and(
        eq(examSessions.userId, userId),
        eq(examSessions.sessionType, 'exam'),
        gte(examSessions.completedAt, thirtyDaysAgo)
      ))
      .orderBy(desc(examSessions.completedAt))
      .limit(10);

    const recommendations: string[] = [];
    let confidenceScore = 0;

    // Criteria 1: Minimum practice (at least 5 full exams)
    const hasEnoughPractice = recentSessions.length >= 5;
    if (hasEnoughPractice) {
      confidenceScore += 20;
    } else {
      recommendations.push(`Complete at least ${5 - recentSessions.length} more practice exams`);
    }

    // Criteria 2: Recent pass rate (>= 80%)
    if (recentSessions.length > 0) {
      const passedCount = recentSessions.filter(s => s.passed).length;
      const passRate = passedCount / recentSessions.length;
      
      if (passRate >= 0.8) {
        confidenceScore += 25;
      } else if (passRate >= 0.6) {
        confidenceScore += 15;
        recommendations.push('Aim for passing at least 80% of practice exams');
      } else {
        recommendations.push('Focus on improving your pass rate before the real exam');
      }
    }

    // Criteria 3: Consistency (last 3 exams all passed)
    const lastThree = recentSessions.slice(0, 3);
    const consecutivePasses = lastThree.every(s => s.passed);
    if (consecutivePasses && lastThree.length >= 3) {
      confidenceScore += 20;
    } else if (lastThree.length >= 3) {
      recommendations.push('Try to pass 3 exams in a row to build consistency');
    }

    // Criteria 4: Average score above pass threshold
    if (recentSessions.length > 0) {
      const avgPercentage = recentSessions.reduce((sum, s) => sum + s.percentage, 0) / recentSessions.length;
      if (avgPercentage >= 85) {
        confidenceScore += 20;
      } else if (avgPercentage >= 75) {
        confidenceScore += 10;
        recommendations.push('Aim for 85%+ average to have a comfortable margin');
      } else {
        recommendations.push('Your average score needs improvement');
      }
    }

    // Criteria 5: Low major fault rate
    if (recentSessions.length > 0) {
      const avgMajorFaults = recentSessions.reduce((sum, s) => sum + s.majorFaults, 0) / recentSessions.length;
      if (avgMajorFaults < 1) {
        confidenceScore += 15;
      } else if (avgMajorFaults < 2) {
        confidenceScore += 10;
        recommendations.push('Work on avoiding major faults - they cost 5 points each');
      } else {
        recommendations.push('Focus on major fault questions - review traffic signals and priority rules');
      }
    }

    // Check weak categories
    const categoryStats = await db
      .select({
        categoryTitle: categoryTranslations.title,
        accuracy: sql<number>`(sum(case when ${examSessionAnswers.isCorrect} then 1 else 0 end)::float / count(*) * 100)`,
      })
      .from(examSessionAnswers)
      .innerJoin(examSessions, eq(examSessions.id, examSessionAnswers.sessionId))
      .innerJoin(categories, eq(categories.id, examSessionAnswers.categoryId))
      .leftJoin(
        categoryTranslations,
        and(
          eq(categoryTranslations.categoryId, categories.id),
          eq(categoryTranslations.locale, locale)
        )
      )
      .where(eq(examSessions.userId, userId))
      .groupBy(categoryTranslations.title)
      .having(sql`count(*) >= 10`);

    const weakCategories = categoryStats.filter(c => c.accuracy < 70);
    if (weakCategories.length > 0) {
      const categoryNames = weakCategories.map(c => c.categoryTitle).slice(0, 3).join(', ');
      recommendations.push(`Review weak categories: ${categoryNames}`);
    }

    const ready = confidenceScore >= 70 && recommendations.length <= 1;

    res.json({
      ready,
      confidence: Math.min(100, confidenceScore),
      recommendations: recommendations.slice(0, 5),
      metrics: {
        totalRecentExams: recentSessions.length,
        recentPassRate: recentSessions.length > 0 ? 
          Math.round((recentSessions.filter(s => s.passed).length / recentSessions.length) * 100) : 0,
        consecutivePasses: lastThree.filter(s => s.passed).length,
        averagePercentage: recentSessions.length > 0 ?
          Math.round(recentSessions.reduce((sum, s) => sum + s.percentage, 0) / recentSessions.length) : 0,
        weakCategoryCount: weakCategories.length,
      },
    });
  } catch (error) {
    console.error('Error checking exam readiness:', error);
    res.status(500).json({ error: 'Failed to check exam readiness' });
  }
});

