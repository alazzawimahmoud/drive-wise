import passport from 'passport';
import { Strategy as GoogleStrategy, Profile as GoogleProfile } from 'passport-google-oauth20';
import { db } from '../db/index.js';
import { users, oauthAccounts } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { OAUTH_CALLBACK_URL } from '../config.js';

// ============================================================================
// TYPES
// ============================================================================

export interface OAuthProfile {
  provider: string;
  providerAccountId: string;
  email?: string;
  displayName: string;
  avatarUrl?: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;
}

export interface AuthenticatedUser {
  id: number;
  email: string | null;
  displayName: string;
  avatarUrl: string | null;
  preferredLocale: string;
  preferredRegion: string | null;
}

// ============================================================================
// CORE USER MANAGEMENT
// ============================================================================

/**
 * Find or create a user from an OAuth profile
 * This is the core function used by all OAuth strategies
 */
export async function findOrCreateUser(profile: OAuthProfile): Promise<AuthenticatedUser> {
  // Check if OAuth account exists
  const [existingAccount] = await db
    .select({
      userId: oauthAccounts.userId,
    })
    .from(oauthAccounts)
    .where(and(
      eq(oauthAccounts.provider, profile.provider),
      eq(oauthAccounts.providerAccountId, profile.providerAccountId)
    ))
    .limit(1);

  if (existingAccount) {
    // Update OAuth tokens and fetch user
    await db
      .update(oauthAccounts)
      .set({
        accessToken: profile.accessToken,
        refreshToken: profile.refreshToken,
        tokenExpiresAt: profile.tokenExpiresAt,
        updatedAt: new Date(),
      })
      .where(and(
        eq(oauthAccounts.provider, profile.provider),
        eq(oauthAccounts.providerAccountId, profile.providerAccountId)
      ));

    // Update user's last login and refresh profile data
    const [user] = await db
      .update(users)
      .set({
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl || undefined,
        lastLoginAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, existingAccount.userId))
      .returning();

    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      preferredLocale: user.preferredLocale,
      preferredRegion: user.preferredRegion,
    };
  }

  // Check if a user with this email already exists (to link accounts)
  let user;
  if (profile.email) {
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, profile.email))
      .limit(1);
    
    if (existingUser) {
      user = existingUser;
      // Update profile data
      await db
        .update(users)
        .set({
          displayName: profile.displayName,
          avatarUrl: profile.avatarUrl || existingUser.avatarUrl,
          lastLoginAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(users.id, existingUser.id));
    }
  }

  // Create new user if not found
  if (!user) {
    [user] = await db
      .insert(users)
      .values({
        email: profile.email || null,
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl || null,
      })
      .returning();
  }

  // Create OAuth account link
  await db
    .insert(oauthAccounts)
    .values({
      userId: user.id,
      provider: profile.provider,
      providerAccountId: profile.providerAccountId,
      accessToken: profile.accessToken,
      refreshToken: profile.refreshToken,
      tokenExpiresAt: profile.tokenExpiresAt,
    });

  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    preferredLocale: user.preferredLocale,
    preferredRegion: user.preferredRegion,
  };
}

/**
 * Get user by ID
 */
export async function getUserById(id: number): Promise<AuthenticatedUser | null> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    preferredLocale: user.preferredLocale,
    preferredRegion: user.preferredRegion,
  };
}

/**
 * Get user's linked OAuth providers
 */
export async function getUserProviders(userId: number): Promise<string[]> {
  const accounts = await db
    .select({ provider: oauthAccounts.provider })
    .from(oauthAccounts)
    .where(eq(oauthAccounts.userId, userId));

  return accounts.map(a => a.provider);
}

// ============================================================================
// PASSPORT SERIALIZATION
// ============================================================================

passport.serializeUser((user, done) => {
  done(null, (user as AuthenticatedUser).id);
});

passport.deserializeUser(async (id: number, done) => {
  try {
    const user = await getUserById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

// ============================================================================
// GOOGLE STRATEGY
// ============================================================================

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    callbackURL: `${OAUTH_CALLBACK_URL}/google/callback`,
    scope: ['profile', 'email'],
  }, async (accessToken, refreshToken, profile: GoogleProfile, done) => {
    try {
      const oauthProfile: OAuthProfile = {
        provider: 'google',
        providerAccountId: profile.id,
        email: profile.emails?.[0]?.value,
        displayName: profile.displayName || profile.emails?.[0]?.value?.split('@')[0] || 'User',
        avatarUrl: profile.photos?.[0]?.value,
        accessToken,
        refreshToken,
      };

      const user = await findOrCreateUser(oauthProfile);
      done(null, user);
    } catch (error) {
      done(error as Error, undefined);
    }
  }));
  
  console.log('✓ Google OAuth strategy configured');
} else {
  console.log('⚠ Google OAuth not configured (missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET)');
}

// ============================================================================
// AVAILABLE PROVIDERS
// ============================================================================

export function getAvailableProviders(): string[] {
  const providers: string[] = [];
  
  if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
    providers.push('google');
  }
  
  return providers;
}

export { passport };

