/**
 * Application configuration from environment variables
 */

// Assets storage configuration
export const ASSETS_BASE_URL = process.env.ASSETS_BASE_URL || 
  'https://storage.googleapis.com/be-on-the-road.appspot.com/files_uuidNames';

/**
 * Build full asset URL from UUID
 */
export function getAssetUrl(uuid: string | null, type: 'image' | 'video' = 'image'): string | null {
  if (!uuid) return null;
  if (type === 'video') return `https://www.youtube.com/watch?v=${uuid.replace('video-', '')}`;
  return `${ASSETS_BASE_URL}/${uuid}`;
}

// OAuth configuration
export const OAUTH_CALLBACK_URL = process.env.OAUTH_CALLBACK_URL || 'http://localhost:3000/api/auth';
export const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// JWT configuration
export const JWT_SECRET = process.env.JWT_SECRET || 'drive-wise-dev-secret-change-in-production';
export const JWT_EXPIRES_IN = '30d';

