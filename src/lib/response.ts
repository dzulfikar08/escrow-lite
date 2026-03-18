export interface ErrorResponse {
  error: string;
  code: string;
  details?: any;
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationErrorResponse {
  error: string;
  code: 'VALIDATION_ERROR';
  details: ValidationError[];
}

export function jsonResponse(data: unknown, status: number = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });
}

export function errorResponse(
  message: string,
  code: string = 'INTERNAL_ERROR',
  status: number = 500
): Response {
  const error: ErrorResponse = {
    error: message,
    code,
  };

  return new Response(JSON.stringify(error), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

export function validationErrorResponse(errors: any): Response {
  // Handle Zod errors (array of issues with path and message)
  let fields: Record<string, string>;

  if (Array.isArray(errors) && errors.length > 0 && 'path' in errors[0]) {
    // Zod error format
    const zodErrors = errors as Array<{ path: (string | number)[]; message: string }>;
    fields = zodErrors.reduce((acc, issue) => {
      const field = issue.path.join('.');
      acc[field] = issue.message;
      return acc;
    }, {} as Record<string, string>);
  } else if (Array.isArray(errors)) {
    // Custom ValidationError format
    fields = errors.reduce((acc, error) => {
      acc[error.field] = error.message;
      return acc;
    }, {} as Record<string, string>);
  } else {
    fields = {};
  }

  const response = {
    error: 'Validation failed',
    code: 'VALIDATION_ERROR',
    details: {
      fields,
    },
    meta: {
      request_id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    },
  };

  return new Response(JSON.stringify(response), {
    status: 400,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Create a standardized API response
 */
export function createApiResponse(data: any, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}
