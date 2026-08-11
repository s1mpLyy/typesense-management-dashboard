interface HttpErrorLike extends Error {
  httpStatus: number;
}

export class TypesenseDashboardError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'TypesenseDashboardError';
    this.status = status;
  }
}

function hasHttpStatus(error: Error): error is HttpErrorLike {
  return 'httpStatus' in error && typeof (error as Partial<HttpErrorLike>).httpStatus === 'number';
}

export function normalizeTypesenseError(error: unknown): TypesenseDashboardError {
  if (error instanceof TypesenseDashboardError) return error;

  if (error instanceof Error && hasHttpStatus(error)) {
    if (error.httpStatus === 401) {
      return new TypesenseDashboardError('The API key was rejected by this server.', 401);
    }
    if (error.httpStatus === 403) {
      return new TypesenseDashboardError(
        'This API key cannot list collections. Use a key with dashboard read access.',
        403,
      );
    }
    if (error.httpStatus === 404) {
      return new TypesenseDashboardError('The requested Typesense endpoint was not found.', 404);
    }
    if (error.httpStatus === 409) {
      return new TypesenseDashboardError(error.message || 'This resource already exists.', 409);
    }
    if (error.httpStatus === 400 || error.httpStatus === 422) {
      return new TypesenseDashboardError(
        error.message || 'Typesense rejected the submitted values.',
        error.httpStatus,
      );
    }
    if (error.httpStatus >= 500) {
      return new TypesenseDashboardError(
        'The Typesense server could not complete the request.',
        error.httpStatus,
      );
    }
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (message.includes('timeout')) {
      return new TypesenseDashboardError(
        'The connection timed out. Check the endpoint and timeout.',
      );
    }
    if (message.includes('network') || message.includes('fetch') || message.includes('connect')) {
      return new TypesenseDashboardError(
        'The server could not be reached. Check the address, TLS, and CORS configuration.',
      );
    }
  }

  return new TypesenseDashboardError('The connection failed for an unknown reason.');
}
