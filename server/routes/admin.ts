import { Router } from 'express';
import { db } from '../db/index.js';
import { users, examSessions } from '../db/schema.js';
import { requireAdmin } from '../middleware/auth.js';
import { eq, sql, desc } from 'drizzle-orm';

export const adminRouter = Router();

// All admin routes require admin access
adminRouter.use(requireAdmin);

/**
 * @swagger
 * /api/admin/users:
 *   get:
 *     summary: Get all registered users with their progress
 *     description: Admin-only endpoint to view all users and their exam statistics
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of users with their progress
 *       403:
 *         description: Admin access required
 */
adminRouter.get('/users', async (_req, res) => {
  try {
    // Get all users
    const allUsers = await db
      .select()
      .from(users)
      .orderBy(desc(users.createdAt));

    // Get progress stats for each user
    const usersWithProgress = await Promise.all(
      allUsers.map(async (user) => {
        // Get exam session stats
        const sessionStats = await db
          .select({
            totalSessions: sql<number>`count(*)::int`,
            passedSessions: sql<number>`sum(case when ${examSessions.passed} then 1 else 0 end)::int`,
            avgScore: sql<number>`avg(${examSessions.score})::float`,
            avgPercentage: sql<number>`avg(${examSessions.percentage})::float`,
            totalQuestionsAnswered: sql<number>`sum(${examSessions.totalQuestions})::int`,
            totalCorrect: sql<number>`sum(${examSessions.correctAnswers})::int`,
            lastExamDate: sql<Date | null>`max(${examSessions.completedAt})`,
          })
          .from(examSessions)
          .where(eq(examSessions.userId, user.id));

        const stats = sessionStats[0];

        // Get recent sessions (last 5)
        const recentSessions = await db
          .select({
            id: examSessions.id,
            score: examSessions.score,
            percentage: examSessions.percentage,
            passed: examSessions.passed,
            totalQuestions: examSessions.totalQuestions,
            completedAt: examSessions.completedAt,
          })
          .from(examSessions)
          .where(eq(examSessions.userId, user.id))
          .orderBy(desc(examSessions.completedAt))
          .limit(5);

        return {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          preferredLocale: user.preferredLocale,
          preferredRegion: user.preferredRegion,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          lastLoginAt: user.lastLoginAt,
          progress: {
            totalSessions: stats?.totalSessions || 0,
            passedSessions: stats?.passedSessions || 0,
            passRate: stats?.totalSessions
              ? Math.round((stats.passedSessions / stats.totalSessions) * 100)
              : 0,
            averageScore: stats?.avgScore ? Math.round(stats.avgScore * 10) / 10 : 0,
            averagePercentage: stats?.avgPercentage ? Math.round(stats.avgPercentage) : 0,
            totalQuestionsAnswered: stats?.totalQuestionsAnswered || 0,
            totalCorrect: stats?.totalCorrect || 0,
            overallAccuracy: stats?.totalQuestionsAnswered
              ? Math.round((stats.totalCorrect / stats.totalQuestionsAnswered) * 100)
              : 0,
            lastExamDate: stats?.lastExamDate || null,
            recentSessions: recentSessions.map(s => ({
              id: s.id,
              score: s.score,
              percentage: s.percentage,
              passed: s.passed,
              totalQuestions: s.totalQuestions,
              completedAt: s.completedAt,
            })),
          },
        };
      })
    );

    res.json({
      users: usersWithProgress,
      totalUsers: usersWithProgress.length,
      usersWithProgress: usersWithProgress.filter(u => u.progress.totalSessions > 0).length,
    });
  } catch (error) {
    console.error('Error fetching admin users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

/**
 * @swagger
 * /api/admin/stats:
 *   get:
 *     summary: Get overall platform statistics
 *     description: Admin-only endpoint for platform-wide statistics
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Platform statistics
 *       403:
 *         description: Admin access required
 */
adminRouter.get('/stats', async (_req, res) => {
  try {
    // Total users
    const totalUsers = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users);

    // Users with at least one exam
    const usersWithExams = await db
      .select({ count: sql<number>`count(distinct ${examSessions.userId})::int` })
      .from(examSessions);

    // Overall exam statistics
    const examStats = await db
      .select({
        totalExams: sql<number>`count(*)::int`,
        passedExams: sql<number>`sum(case when ${examSessions.passed} then 1 else 0 end)::int`,
        avgScore: sql<number>`avg(${examSessions.score})::float`,
        avgPercentage: sql<number>`avg(${examSessions.percentage})::float`,
        totalQuestionsAnswered: sql<number>`sum(${examSessions.totalQuestions})::int`,
        totalCorrect: sql<number>`sum(${examSessions.correctAnswers})::int`,
      })
      .from(examSessions);

    const stats = examStats[0];

    res.json({
      totalUsers: totalUsers[0]?.count || 0,
      usersWithExams: usersWithExams[0]?.count || 0,
      totalExams: stats?.totalExams || 0,
      passedExams: stats?.passedExams || 0,
      overallPassRate: stats?.totalExams
        ? Math.round((stats.passedExams / stats.totalExams) * 100)
        : 0,
      averageScore: stats?.avgScore ? Math.round(stats.avgScore * 10) / 10 : 0,
      averagePercentage: stats?.avgPercentage ? Math.round(stats.avgPercentage) : 0,
      overallAccuracy: stats?.totalQuestionsAnswered
        ? Math.round((stats.totalCorrect / stats.totalQuestionsAnswered) * 100)
        : 0,
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({ error: 'Failed to fetch platform statistics' });
  }
});

