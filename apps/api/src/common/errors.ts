import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { ZodError } from 'zod';

export class ApiError extends HttpException {
  constructor(status: number, public readonly code: string, message: string) {
    super({ error: { code, message } }, status);
  }
}
export const forbidden = (m = 'You do not have permission to do that', code = 'forbidden') => new ApiError(403, code, m);
export const notFound = (m = 'Not found') => new ApiError(404, 'not_found', m);
export const conflict = (m: string, code = 'conflict') => new ApiError(409, code, m);
export const badRequest = (m: string, code = 'bad_request') => new ApiError(400, code, m);
export const unprocessable = (m: string, code = 'unprocessable') => new ApiError(422, code, m);

/** Map a PostgreSQL error to an HTTP status + code (null = not a mapped DB error). */
export function mapPgError(e: unknown): { status: number; code: string; message: string } | null {
  const err = e as { code?: string; message?: string; constraint?: string };
  if (!err || typeof err.code !== 'string' || !/^[0-9A-Z]{5}$/.test(err.code)) return null;
  const msg = err.message ?? 'Database error';
  switch (err.code) {
    case '42501': return { status: 403, code: 'forbidden', message: 'Not allowed (row-level security)' };
    case '23505': return { status: 409, code: 'conflict', message: 'Already exists' };
    case '23503': return { status: 409, code: 'conflict', message: 'Referenced item does not exist or is still in use' };
    case '53400': return { status: 409, code: 'plan_limit_reached', message: msg };
    case '23514': return { status: 422, code: 'rule_violation', message: msg };
    case '23502': return { status: 422, code: 'missing_value', message: msg };
    case '22023': case 'P0001': return { status: 422, code: 'invalid', message: msg };
    case '22P02': case '22007': case '22008': case '22001': case '22003': return { status: 400, code: 'bad_request', message: 'Invalid value' };
    default: return null;
  }
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly log = new Logger('Errors');
  catch(e: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    let status = 500, code = 'internal_error', message = 'Something went wrong';
    if (e instanceof ApiError) {
      status = e.getStatus(); code = e.code; message = (e.getResponse() as { error: { message: string } }).error.message;
    } else if (e instanceof ZodError) {
      status = 400; code = 'validation_error';
      message = e.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join('; ');
    } else if (e instanceof HttpException) {
      status = e.getStatus();
      const r = e.getResponse() as string | { message?: string | string[] };
      message = typeof r === 'string' ? r : Array.isArray(r.message) ? r.message.join('; ') : (r.message ?? e.message);
      code = status === 401 ? 'unauthorized' : status === 403 ? 'forbidden' : status === 404 ? 'not_found' : status === 413 ? 'too_large' : status === 429 ? 'rate_limited' : 'error';
    } else {
      const m = mapPgError(e);
      if (m) ({ status, code, message } = m);
      else this.log.error(e instanceof Error ? (e.stack ?? e.message) : String(e));
    }
    if (status === HttpStatus.INTERNAL_SERVER_ERROR) message = 'Something went wrong';
    res.status(status).json({ error: { code, message } });
  }
}
