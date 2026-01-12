import { Router, Request, Response, NextFunction } from 'express';
import { passport, getUserById, getUserProviders, getAvailableProviders } from '../auth/passport.js';
import { db } from '../db/index.js';
import { users, oauthAccounts } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { generateToken, requireAuth } from '../middleware/auth.js';
import { FRONTEND_URL } from '../config.js';
import { asyncHandler } from '../middleware/errorHandler.js';

export const authRouter = Router();

// Initialize passport
authRouter.use(passport.initialize());

// ============================================================================
// PROVIDER DISCOVERY
// ============================================================================

/**
 * @swagger
 * /api/auth/providers:
 *   get:
 *     summary: List available OAuth providers
 *     description: Returns a list of configured OAuth providers that can be used for authentication
 *     tags: [Authentication]
 *     responses:
 *       200:
 *         description: List of available providers
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 providers:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         example: google
 *                       name:
 *                         type: string
 *                         example: Google
 *                       authUrl:
 *                         type: string
 *                         example: /api/auth/google
 */
authRouter.get('/providers', (_req, res) => {
  const availableProviders = getAvailableProviders();
  
  const providerDetails = availableProviders.map(provider => ({
    id: provider,
    name: provider.charAt(0).toUpperCase() + provider.slice(1),
    authUrl: `/api/auth/${provider}`,
    callbackUrl: `/api/auth/${provider}/callback`,
  }));

  res.json({ providers: providerDetails });
});

// ============================================================================
// GOOGLE OAUTH - SERVER FLOW (Web with redirects)
// ============================================================================

/**
 * @swagger
 * /api/auth/google:
 *   get:
 *     summary: Initiate Google OAuth flow
 *     description: Redirects to Google for authentication (server-side flow)
 *     tags: [Authentication]
 *     responses:
 *       302:
 *         description: Redirect to Google OAuth
 */
authRouter.get('/google', passport.authenticate('google', {
  scope: ['profile', 'email'],
  session: false,
}));

/**
 * @swagger
 * /api/auth/google/callback:
 *   get:
 *     summary: Google OAuth callback
 *     description: Handles the OAuth callback from Google
 *     tags: [Authentication]
 *     responses:
 *       302:
 *         description: Redirect to frontend with token
 */
authRouter.get('/google/callback', (req: Request, res: Response, next: NextFunction) => {
  passport.authenticate('google', { session: false }, (err: Error | null, user: Express.User | false | null, info: { message?: string } | undefined) => {
    // Handle authentication errors gracefully
    if (err) {
      console.error('OAuth authentication error:', {
        name: err.name,
        message: err.message,
        timestamp: new Date().toISOString(),
      });
      
      // Redirect to frontend with error - never expose internal error details
      return res.redirect(`${FRONTEND_URL}/auth/callback?error=auth_failed&message=${encodeURIComponent('Authentication failed. Please try again.')}`);
    }

    // Handle case where no user was returned
    if (!user) {
      const message = info?.message || 'Authentication failed';
      console.error('OAuth failed - no user returned:', { info, timestamp: new Date().toISOString() });
      return res.redirect(`${FRONTEND_URL}/auth/callback?error=auth_failed&message=${encodeURIComponent(message)}`);
    }

    // Success - generate token and redirect
    try {
      const token = generateToken(user);
      res.redirect(`${FRONTEND_URL}/auth/callback?token=${token}`);
    } catch (tokenError) {
      console.error('Token generation error:', tokenError);
      res.redirect(`${FRONTEND_URL}/auth/callback?error=token_failed&message=${encodeURIComponent('Failed to complete authentication.')}`);
    }
  })(req, res, next);
});

// ============================================================================
// USER PROFILE & MANAGEMENT
// ============================================================================

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get current user profile
 *     description: Returns the authenticated user's profile information
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/User'
 *                 - type: object
 *                   properties:
 *                     providers:
 *                       type: array
 *                       items:
 *                         type: string
 *                       description: Linked OAuth providers
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: User not found
 */
authRouter.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const user = await getUserById(req.user!.id);

  if (!user) {
    return res.status(404).json({ error: 'User not found', code: 'NOT_FOUND' });
  }

  const providers = await getUserProviders(user.id);

  res.json({
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    preferredLocale: user.preferredLocale,
    preferredRegion: user.preferredRegion,
    providers,
  });
}));

/**
 * @swagger
 * /api/auth/me:
 *   patch:
 *     summary: Update user preferences
 *     description: Update the authenticated user's preferences (locale, region, display name)
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               preferredLocale:
 *                 type: string
 *                 enum: [nl-BE, fr-BE, de-BE, en]
 *               preferredRegion:
 *                 type: string
 *                 enum: [national, brussels, flanders, wallonia]
 *               displayName:
 *                 type: string
 *     responses:
 *       200:
 *         description: Updated user profile
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       401:
 *         description: Not authenticated
 */
authRouter.patch('/me', requireAuth, asyncHandler(async (req, res) => {
  const { preferredLocale, preferredRegion, displayName } = req.body;
  
  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  
  if (preferredLocale && ['nl-BE', 'fr-BE', 'de-BE', 'en'].includes(preferredLocale)) {
    updateData.preferredLocale = preferredLocale;
  }
  if (preferredRegion && ['national', 'brussels', 'flanders', 'wallonia'].includes(preferredRegion)) {
    updateData.preferredRegion = preferredRegion;
  }
  if (displayName && typeof displayName === 'string' && displayName.trim().length > 0) {
    updateData.displayName = displayName.trim();
  }

  const [user] = await db
    .update(users)
    .set(updateData)
    .where(eq(users.id, req.user!.id))
    .returning();

  res.json({
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    preferredLocale: user.preferredLocale,
    preferredRegion: user.preferredRegion,
  });
}));

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Refresh access token
 *     description: Exchange a valid JWT for a fresh token with extended expiry
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: New access token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *       401:
 *         description: Not authenticated
 */
authRouter.post('/refresh', requireAuth, asyncHandler(async (req, res) => {
  const user = await getUserById(req.user!.id);
  
  if (!user) {
    return res.status(404).json({ error: 'User not found', code: 'NOT_FOUND' });
  }

  const token = generateToken(user);

  // Update last login
  await db
    .update(users)
    .set({ lastLoginAt: new Date() })
    .where(eq(users.id, req.user!.id));

  res.json({ token });
}));

/**
 * @swagger
 * /api/auth/unlink/{provider}:
 *   delete:
 *     summary: Unlink OAuth provider
 *     description: Remove a linked OAuth provider from the user's account (must have at least one provider linked)
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: provider
 *         in: path
 *         required: true
 *         description: Provider to unlink
 *         schema:
 *           type: string
 *           enum: [google]
 *     responses:
 *       200:
 *         description: Provider unlinked
 *       400:
 *         description: Cannot unlink only provider
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Provider not linked
 */
authRouter.delete('/unlink/:provider', requireAuth, asyncHandler(async (req, res) => {
  const { provider } = req.params;
  const userId = req.user!.id;

  // Check how many providers are linked
  const providers = await getUserProviders(userId);
  
  if (providers.length <= 1) {
    return res.status(400).json({ 
      error: 'Cannot unlink only provider',
      code: 'VALIDATION_ERROR',
      message: 'You must have at least one authentication method linked'
    });
  }

  if (!providers.includes(provider)) {
    return res.status(404).json({ error: 'Provider not linked to this account', code: 'NOT_FOUND' });
  }

  // Remove the OAuth account
  await db
    .delete(oauthAccounts)
    .where(and(
      eq(oauthAccounts.userId, userId),
      eq(oauthAccounts.provider, provider)
    ));

  res.json({ 
    message: `${provider} unlinked successfully`,
    remainingProviders: providers.filter(p => p !== provider)
  });
}));
