/**
 * Standard API error response format.
 * All error responses follow this structure for consistency.
 */
export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    requestId?: string;
  };
}

/**
 * Custom API error class with code and optional details.
 * Use this for throwing errors that should be returned to clients.
 */
export class ApiError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;

  constructor(
    code: string,
    message: string,
    statusCode: number = 500,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;

    // Maintains proper stack trace for where error was thrown
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Convert to API response format.
   */
  toResponse(requestId?: string): ApiErrorResponse {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details && { details: this.details }),
        ...(requestId && { requestId }),
      },
    };
  }
}

/**
 * Type guard to check if an error is an ApiError.
 * Uses duck typing for cross-module compatibility (avoids instanceof issues in tests).
 */
export function isApiError(error: unknown): error is ApiError {
  return (
    error !== null &&
    typeof error === 'object' &&
    'name' in error &&
    error.name === 'ApiError' &&
    'code' in error &&
    typeof (error as ApiError).code === 'string' &&
    'statusCode' in error &&
    typeof (error as ApiError).statusCode === 'number' &&
    'toResponse' in error &&
    typeof (error as ApiError).toResponse === 'function'
  );
}

// Common error factory functions

export const Errors = {
  badRequest: (message: string, details?: Record<string, unknown>) =>
    new ApiError('BAD_REQUEST', message, 400, details),

  unauthorized: (message = 'Authentication required') => new ApiError('UNAUTHORIZED', message, 401),

  forbidden: (message = 'Access denied') => new ApiError('FORBIDDEN', message, 403),

  notFound: (resource: string) => new ApiError('NOT_FOUND', `${resource} not found`, 404),

  conflict: (message: string) => new ApiError('CONFLICT', message, 409),

  validationError: (details: Record<string, unknown>) =>
    new ApiError('VALIDATION_ERROR', 'Validation failed', 400, details),

  rateLimited: (retryAfter?: number) =>
    new ApiError('RATE_LIMITED', 'Too many requests', 429, { retryAfter }),

  internal: (message = 'Internal server error') => new ApiError('INTERNAL_ERROR', message, 500),
};
