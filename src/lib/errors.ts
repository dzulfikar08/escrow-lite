/**
 * Base application error class
 * All custom errors should extend this class
 */
export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500,
    public code: string
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Build metadata object for error responses
   */
  protected buildMeta() {
    return {
      request_id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    };
  }

  toJSON() {
    return {
      error: {
        message: this.message,
        code: this.code,
        details: {},
      },
      meta: this.buildMeta(),
    };
  }
}

/**
 * Authentication errors (401)
 * Thrown when user is not authenticated or token is invalid
 */
export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }

  toJSON() {
    return {
      error: {
        message: this.message,
        code: this.code,
        details: {},
      },
      meta: this.buildMeta(),
    };
  }
}

/**
 * Validation errors (400)
 * Thrown when input validation fails
 */
export class ValidationError extends AppError {
  constructor(message: string, public fields?: Record<string, string>) {
    super(message, 400, 'VALIDATION_ERROR');
    this.fields = fields;
  }

  toJSON() {
    const details = this.fields ? { fields: this.fields } : {};
    return {
      error: {
        message: this.message,
        code: this.code,
        details,
      },
      meta: this.buildMeta(),
    };
  }
}

/**
 * Not found errors (404)
 * Thrown when requested resource doesn't exist
 */
export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(message, 404, 'NOT_FOUND_ERROR');
  }

  toJSON() {
    return {
      error: {
        message: this.message,
        code: this.code,
        details: {},
      },
      meta: this.buildMeta(),
    };
  }
}

/**
 * Conflict errors (409)
 * Thrown when request conflicts with current state
 */
export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT_ERROR');
  }

  toJSON() {
    return {
      error: {
        message: this.message,
        code: this.code,
        details: {},
      },
      meta: this.buildMeta(),
    };
  }
}

/**
 * Rate limit errors (429)
 * Thrown when rate limit is exceeded
 */
export class RateLimitError extends AppError {
  constructor(
    message: string = 'Rate limit exceeded',
    public retryAfter?: number
  ) {
    super(message, 429, 'RATE_LIMIT_ERROR');
    this.retryAfter = retryAfter;
  }

  toJSON() {
    const details = this.retryAfter ? { retryAfter: this.retryAfter } : {};
    return {
      error: {
        message: this.message,
        code: this.code,
        details,
      },
      meta: this.buildMeta(),
    };
  }
}

/**
 * Handle errors and return appropriate Response for API routes
 * Converts any error to a Response object
 */
export function handleError(error: unknown): Response {
  let appError: AppError;

  // Already an AppError, use as-is
  if (error instanceof AppError) {
    appError = error;
  }
  // Zod validation error
  else if (error && typeof error === 'object' && 'issues' in error) {
    const zodError = error as { issues: Array<{ path: string[]; message: string }> };
    const fields = zodError.issues.reduce((acc, issue) => {
      const field = issue.path.join('.');
      acc[field] = issue.message;
      return acc;
    }, {} as Record<string, string>);

    appError = new ValidationError('Validation failed', fields);
  }
  // Generic error
  else if (error instanceof Error) {
    appError = new AppError(error.message, 500, 'INTERNAL_ERROR');
  }
  // Unknown error type
  else {
    appError = new AppError('An unexpected error occurred', 500, 'INTERNAL_ERROR');
  }

  const errorJson = appError.toJSON();

  return new Response(JSON.stringify(errorJson), {
    status: appError.statusCode,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}
