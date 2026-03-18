/**
 * Base application error class
 * All custom errors should extend this class
 */
export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      error: {
        message: this.message,
        code: this.code || this.name,
        statusCode: this.statusCode,
      },
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
    return {
      error: {
        message: this.message,
        code: this.code,
        statusCode: this.statusCode,
        fields: this.fields,
      },
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
}

/**
 * Conflict errors (409)
 * Thrown when request conflicts with current state
 */
export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT_ERROR');
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
    return {
      error: {
        message: this.message,
        code: this.code,
        statusCode: this.statusCode,
        retryAfter: this.retryAfter,
      },
    };
  }
}

/**
 * Authorization errors (403)
 * Thrown when user lacks permission for an action
 */
export class AuthorizationError extends AppError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 403, 'AUTHORIZATION_ERROR');
  }
}

/**
 * Payment errors (402)
 * Thrown when payment processing fails
 */
export class PaymentError extends AppError {
  constructor(message: string, public gatewayCode?: string) {
    super(message, 402, 'PAYMENT_ERROR');
    this.gatewayCode = gatewayCode;
  }

  toJSON() {
    return {
      error: {
        message: this.message,
        code: this.code,
        statusCode: this.statusCode,
        gatewayCode: this.gatewayCode,
      },
    };
  }
}

/**
 * Handle errors and return appropriate response
 * Converts any error to an AppError instance
 */
export function handleError(error: unknown): AppError {
  // Already an AppError, return as-is
  if (error instanceof AppError) {
    return error;
  }

  // Zod validation error
  if (error && typeof error === 'object' && 'issues' in error) {
    const zodError = error as { issues: Array<{ path: string[]; message: string }> };
    const fields = zodError.issues.reduce((acc, issue) => {
      const field = issue.path.join('.');
      acc[field] = issue.message;
      return acc;
    }, {} as Record<string, string>);

    return new ValidationError('Validation failed', fields);
  }

  // Generic error
  if (error instanceof Error) {
    return new AppError(error.message, 500);
  }

  // Unknown error type
  return new AppError('An unexpected error occurred', 500);
}

/**
 * Type guard to check if error is an AppError
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
