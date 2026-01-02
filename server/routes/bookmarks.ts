import { Router } from 'express';
import { db } from '../db/index.js';
import { userBookmarks, questions, questionTranslations, categories, categoryTranslations, assets } from '../db/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth.js';
import { getAssetUrl } from '../config.js';

export const bookmarksRouter = Router();

// All bookmark routes require authentication
bookmarksRouter.use(requireAuth);

/**
 * @swagger
 * /api/bookmarks:
 *   get:
 *     summary: Get user's bookmarks
 *     description: Returns all bookmarked questions for the authenticated user
 *     tags: [Bookmarks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: type
 *         in: query
 *         description: Filter by bookmark type
 *         schema:
 *           type: string
 *           enum: [saved, difficult, review]
 *       - $ref: '#/components/parameters/locale'
 *     responses:
 *       200:
 *         description: List of bookmarked questions
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Bookmark'
 *       401:
 *         description: Not authenticated
 */
bookmarksRouter.get('/', async (req, res) => {
  try {
    const userId = req.user!.id;
    const bookmarkType = req.query.type as string | undefined;
    const locale = (req.query.locale as string) || 'nl-BE';

    let query = db
      .select({
        id: userBookmarks.id,
        bookmarkType: userBookmarks.bookmarkType,
        notes: userBookmarks.notes,
        createdAt: userBookmarks.createdAt,
        questionId: questions.id,
        originalId: questions.originalId,
        answerType: questions.answerType,
        isMajorFault: questions.isMajorFault,
        questionText: questionTranslations.questionText,
        categorySlug: categories.slug,
        categoryTitle: categoryTranslations.title,
        imageUuid: assets.uuid,
      })
      .from(userBookmarks)
      .innerJoin(questions, eq(questions.id, userBookmarks.questionId))
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
      .leftJoin(assets, eq(assets.id, questions.imageAssetId))
      .where(eq(userBookmarks.userId, userId))
      .orderBy(desc(userBookmarks.createdAt))
      .$dynamic();

    if (bookmarkType) {
      query = query.where(and(
        eq(userBookmarks.userId, userId),
        eq(userBookmarks.bookmarkType, bookmarkType)
      ));
    }

    const bookmarks = await query;

    const formattedBookmarks = bookmarks.map(b => ({
      id: b.id,
      bookmarkType: b.bookmarkType,
      notes: b.notes,
      createdAt: b.createdAt,
      question: {
        id: b.questionId,
        originalId: b.originalId,
        answerType: b.answerType,
        isMajorFault: b.isMajorFault,
        questionText: b.questionText,
        category: {
          slug: b.categorySlug,
          title: b.categoryTitle,
        },
        imageUrl: getAssetUrl(b.imageUuid),
      },
    }));

    res.json(formattedBookmarks);
  } catch (error) {
    console.error('Error fetching bookmarks:', error);
    res.status(500).json({ error: 'Failed to fetch bookmarks' });
  }
});

/**
 * @swagger
 * /api/bookmarks:
 *   post:
 *     summary: Add a bookmark
 *     description: Bookmark a question for the authenticated user
 *     tags: [Bookmarks]
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
 *               - type
 *             properties:
 *               questionId:
 *                 type: integer
 *                 description: ID of the question to bookmark
 *               type:
 *                 type: string
 *                 enum: [saved, difficult, review]
 *                 description: Type of bookmark
 *               notes:
 *                 type: string
 *                 description: Optional notes about this bookmark
 *     responses:
 *       201:
 *         description: Bookmark created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Bookmark'
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Not authenticated
 *       409:
 *         description: Bookmark already exists
 */
bookmarksRouter.post('/', async (req, res) => {
  try {
    const userId = req.user!.id;
    const { questionId, type, notes } = req.body;

    if (!questionId || !type) {
      return res.status(400).json({ error: 'questionId and type are required' });
    }

    if (!['saved', 'difficult', 'review'].includes(type)) {
      return res.status(400).json({ error: 'type must be one of: saved, difficult, review' });
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

    // Check for existing bookmark
    const [existing] = await db
      .select()
      .from(userBookmarks)
      .where(and(
        eq(userBookmarks.userId, userId),
        eq(userBookmarks.questionId, questionId),
        eq(userBookmarks.bookmarkType, type)
      ))
      .limit(1);

    if (existing) {
      return res.status(409).json({ error: 'Bookmark already exists' });
    }

    // Create bookmark
    const [bookmark] = await db
      .insert(userBookmarks)
      .values({
        userId,
        questionId,
        bookmarkType: type,
        notes: notes || null,
      })
      .returning();

    res.status(201).json({
      id: bookmark.id,
      questionId: bookmark.questionId,
      bookmarkType: bookmark.bookmarkType,
      notes: bookmark.notes,
      createdAt: bookmark.createdAt,
    });
  } catch (error) {
    console.error('Error creating bookmark:', error);
    res.status(500).json({ error: 'Failed to create bookmark' });
  }
});

/**
 * @swagger
 * /api/bookmarks/{id}:
 *   patch:
 *     summary: Update a bookmark
 *     description: Update bookmark notes or type
 *     tags: [Bookmarks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Bookmark ID
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               notes:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [saved, difficult, review]
 *     responses:
 *       200:
 *         description: Updated bookmark
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Bookmark not found
 */
bookmarksRouter.patch('/:id', async (req, res) => {
  try {
    const userId = req.user!.id;
    const bookmarkId = parseInt(req.params.id);
    const { notes, type } = req.body;

    if (isNaN(bookmarkId)) {
      return res.status(400).json({ error: 'Invalid bookmark ID' });
    }

    // Check ownership
    const [existing] = await db
      .select()
      .from(userBookmarks)
      .where(and(
        eq(userBookmarks.id, bookmarkId),
        eq(userBookmarks.userId, userId)
      ))
      .limit(1);

    if (!existing) {
      return res.status(404).json({ error: 'Bookmark not found' });
    }

    const updateData: Record<string, unknown> = {};
    if (notes !== undefined) updateData.notes = notes;
    if (type && ['saved', 'difficult', 'review'].includes(type)) {
      updateData.bookmarkType = type;
    }

    const [updated] = await db
      .update(userBookmarks)
      .set(updateData)
      .where(eq(userBookmarks.id, bookmarkId))
      .returning();

    res.json({
      id: updated.id,
      questionId: updated.questionId,
      bookmarkType: updated.bookmarkType,
      notes: updated.notes,
      createdAt: updated.createdAt,
    });
  } catch (error) {
    console.error('Error updating bookmark:', error);
    res.status(500).json({ error: 'Failed to update bookmark' });
  }
});

/**
 * @swagger
 * /api/bookmarks/{id}:
 *   delete:
 *     summary: Remove a bookmark
 *     description: Delete a bookmark by ID
 *     tags: [Bookmarks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Bookmark ID
 *         schema:
 *           type: integer
 *     responses:
 *       204:
 *         description: Bookmark deleted
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Bookmark not found
 */
bookmarksRouter.delete('/:id', async (req, res) => {
  try {
    const userId = req.user!.id;
    const bookmarkId = parseInt(req.params.id);

    if (isNaN(bookmarkId)) {
      return res.status(400).json({ error: 'Invalid bookmark ID' });
    }

    const result = await db
      .delete(userBookmarks)
      .where(and(
        eq(userBookmarks.id, bookmarkId),
        eq(userBookmarks.userId, userId)
      ))
      .returning();

    if (result.length === 0) {
      return res.status(404).json({ error: 'Bookmark not found' });
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting bookmark:', error);
    res.status(500).json({ error: 'Failed to delete bookmark' });
  }
});

/**
 * @swagger
 * /api/bookmarks/question/{questionId}:
 *   delete:
 *     summary: Remove bookmark by question ID
 *     description: Delete a bookmark by question ID and optionally type
 *     tags: [Bookmarks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: questionId
 *         in: path
 *         required: true
 *         description: Question ID
 *         schema:
 *           type: integer
 *       - name: type
 *         in: query
 *         description: Bookmark type (if omitted, removes all types)
 *         schema:
 *           type: string
 *           enum: [saved, difficult, review]
 *     responses:
 *       204:
 *         description: Bookmark(s) deleted
 *       401:
 *         description: Not authenticated
 */
bookmarksRouter.delete('/question/:questionId', async (req, res) => {
  try {
    const userId = req.user!.id;
    const questionId = parseInt(req.params.questionId);
    const bookmarkType = req.query.type as string | undefined;

    if (isNaN(questionId)) {
      return res.status(400).json({ error: 'Invalid question ID' });
    }

    let conditions = and(
      eq(userBookmarks.userId, userId),
      eq(userBookmarks.questionId, questionId)
    );

    if (bookmarkType) {
      conditions = and(
        conditions,
        eq(userBookmarks.bookmarkType, bookmarkType)
      );
    }

    await db.delete(userBookmarks).where(conditions);

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting bookmark:', error);
    res.status(500).json({ error: 'Failed to delete bookmark' });
  }
});

/**
 * @swagger
 * /api/bookmarks/check/{questionId}:
 *   get:
 *     summary: Check if question is bookmarked
 *     description: Returns bookmark status for a specific question
 *     tags: [Bookmarks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: questionId
 *         in: path
 *         required: true
 *         description: Question ID
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Bookmark status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 bookmarks:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       type:
 *                         type: string
 *       401:
 *         description: Not authenticated
 */
bookmarksRouter.get('/check/:questionId', async (req, res) => {
  try {
    const userId = req.user!.id;
    const questionId = parseInt(req.params.questionId);

    if (isNaN(questionId)) {
      return res.status(400).json({ error: 'Invalid question ID' });
    }

    const bookmarks = await db
      .select({
        id: userBookmarks.id,
        type: userBookmarks.bookmarkType,
      })
      .from(userBookmarks)
      .where(and(
        eq(userBookmarks.userId, userId),
        eq(userBookmarks.questionId, questionId)
      ));

    res.json({ bookmarks });
  } catch (error) {
    console.error('Error checking bookmark:', error);
    res.status(500).json({ error: 'Failed to check bookmark' });
  }
});


