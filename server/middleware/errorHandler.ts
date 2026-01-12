import { Request, Response, NextFunction } from 'express';

// ============================================================================
// CUSTOM ERROR CLASSES
// ============================================================================

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly code: string;

  constructor(message: string, statusCode: number = 500, code: string = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.code = code;
    
    // Maintains proper stack trace for where our error was thrown
    Error.captureStackTrace(this, this.constructor);
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication failed') {
    super(message, 401, 'AUTH_ERROR');
  }
}

export class DatabaseError extends AppError {
  constructor(message: string = 'A database error occurred') {
    super(message, 500, 'DATABASE_ERROR');
  }
}

export class ValidationError extends AppError {
  constructor(message: string = 'Validation failed') {
    super(message, 400, 'VALIDATION_ERROR');
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
  }
}

// ============================================================================
// ERROR RESPONSE INTERFACE
// ============================================================================

interface ErrorResponse {
  error: string;
  code: string;
  message?: string;
}

// ============================================================================
// ERROR HANDLER MIDDLEWARE
// ============================================================================

/**
 * Check if error is a database/query error from Drizzle/PostgreSQL
 */
function isDatabaseError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes('failed query') ||
      message.includes('connection') ||
      message.includes('postgres') ||
      message.includes('database') ||
      message.includes('relation') ||
      message.includes('column') ||
      error.name === 'PostgresError' ||
      error.name === 'DrizzleError'
    );
  }
  return false;
}

/**
 * Check if error is an OAuth/Passport error
 */
function isOAuthError(error: unknown): boolean {
  if (error instanceof Error) {
    return (
      error.name === 'TokenError' ||
      error.name === 'AuthorizationError' ||
      error.name === 'InternalOAuthError' ||
      error.message.includes('OAuth') ||
      error.message.includes('passport')
    );
  }
  return false;
}

/**
 * Global error handler middleware
 * Catches all errors and returns safe, user-friendly responses
 */
export function errorHandler(
  err: Error | AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Log the full error for debugging (server-side only)
  console.error('Error caught by handler:', {
    name: err.name,
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    timestamp: new Date().toISOString(),
  });

  // Handle our custom AppError instances
  if (err instanceof AppError) {
    const response: ErrorResponse = {
      error: err.message,
      code: err.code,
    };
    res.status(err.statusCode).json(response);
    return;
  }

  // Handle database errors - never expose details
  if (isDatabaseError(err)) {
    const response: ErrorResponse = {
      error: 'A service error occurred. Please try again later.',
      code: 'SERVICE_ERROR',
    };
    res.status(503).json(response);
    return;
  }

  // Handle OAuth errors
  if (isOAuthError(err)) {
    const response: ErrorResponse = {
      error: 'Authentication failed. Please try again.',
      code: 'AUTH_ERROR',
    };
    res.status(401).json(response);
    return;
  }

  // Handle all other unexpected errors
  const response: ErrorResponse = {
    error: 'An unexpected error occurred. Please try again later.',
    code: 'INTERNAL_ERROR',
  };
  res.status(500).json(response);
}

/**
 * Async route handler wrapper
 * Catches errors from async route handlers and passes them to the error handler
 */
export function asyncHandler<T>(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<T>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * 404 Not Found handler
 * Should be added after all routes
 */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: 'Resource not found',
    code: 'NOT_FOUND',
    path: req.path,
  });
}
