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

export function jsonResponse(data: any, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
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

export function validationErrorResponse(errors: ValidationError[]): Response {
  const response: ValidationErrorResponse = {
    error: 'Validation failed',
    code: 'VALIDATION_ERROR',
    details: errors,
  };

  return new Response(JSON.stringify(response), {
    status: 400,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}
