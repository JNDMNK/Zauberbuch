export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message?: string,
    public details?: unknown,
  ) {
    super(message ?? code);
  }
}

export const badRequest = (code: string, message?: string, details?: unknown) =>
  new HttpError(400, code, message, details);
export const unauthorized = (code = 'unauthorized', message = 'Authentication required') =>
  new HttpError(401, code, message);
export const forbidden = (code = 'forbidden', message = 'Insufficient permissions') =>
  new HttpError(403, code, message);
export const notFound = (code = 'not_found', message = 'Resource not found') =>
  new HttpError(404, code, message);
export const conflict = (code: string, message?: string) => new HttpError(409, code, message);
