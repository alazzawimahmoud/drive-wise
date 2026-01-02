import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import type { AuthenticatedUser } from '../auth/passport.js';
import { JWT_SECRET, JWT_EXPIRES_IN, ADMIN_EMAILS } from '../config.js';

// Re-export for convenience
export type { AuthenticatedUser } from '../auth/passport.js';

// Extend Express and Passport User types
declare global {
  namespace Express {
    // Override Passport's User interface
    interface User extends AuthenticatedUser {}
  }
}

export interface JWTPayload {
  userId: number;
  email: string | null;
  displayName: string;
  iat?: number;
  exp?: number;
}

/**
 * Generate a JWT token for a user
 */
export function generateToken(user: AuthenticatedUser): string {
  const payload: Omit<JWTPayload, 'iat' | 'exp'> = {
    userId: user.id,
    email: user.email,
    displayName: user.displayName,
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions);
}

/**
 * Verify a JWT token and return the payload
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch {
    return null;
  }
}

/**
 * Extract token from Authorization header
 */
function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
}

/**
 * Authentication middleware - requires valid JWT
 * Attaches user info to request object
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = extractToken(req);

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const payload = verifyToken(token);

  if (!payload) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  req.user = {
    id: payload.userId,
    email: payload.email,
    displayName: payload.displayName,
    avatarUrl: null, // Not stored in JWT, fetch from DB if needed
    preferredLocale: 'nl-BE', // Defaults, fetch from DB if needed
    preferredRegion: 'national',
  };

  next();
}

/**
 * Optional authentication middleware
 * Attaches user info if valid token present, but doesn't require it
 */
export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const token = extractToken(req);

  if (token) {
    const payload = verifyToken(token);

    if (payload) {
      req.user = {
        id: payload.userId,
        email: payload.email,
        displayName: payload.displayName,
        avatarUrl: null,
        preferredLocale: 'nl-BE',
        preferredRegion: 'national',
      };
    }
  }

  next();
}

/**
 * Admin-only middleware - requires authentication AND admin email
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  // First check authentication
  const token = extractToken(req);

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const payload = verifyToken(token);

  if (!payload) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  // Check if user is admin
  if (!payload.email || !ADMIN_EMAILS.includes(payload.email.toLowerCase())) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  req.user = {
    id: payload.userId,
    email: payload.email,
    displayName: payload.displayName,
    avatarUrl: null,
    preferredLocale: 'nl-BE',
    preferredRegion: 'national',
  };

  next();
}
