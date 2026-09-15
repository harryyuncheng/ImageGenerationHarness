import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { StyleGuideError } from '../style-guide/style-guide-records.js';
import { RepositoryUnavailableError } from '../repository/errors.js';

export class ApiError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function requireService<T>(service: T | null, message: string): T {
  if (!service) throw new ApiError(503, message);
  return service;
}

export function publicErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    if ('syscall' in error && ('path' in error || 'dest' in error)) {
      return 'A local filesystem operation failed. Check availability, permissions, and free disk space.';
    }
    if (error.message.trim()) return error.message.slice(0, 2000);
  }
  return 'The operation could not be completed.';
}

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ApiError) {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    if (error instanceof RepositoryUnavailableError) {
      return reply.code(503).send({ error: error.message });
    }
    if (error instanceof StyleGuideError) {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    if (error instanceof z.ZodError) {
      return reply.code(400).send({
        error: 'Invalid request.',
        issues: error.issues.map((issue) => ({ path: issue.path, message: issue.message })),
      });
    }
    if (
      error instanceof Error &&
      'statusCode' in error &&
      typeof error.statusCode === 'number' &&
      error.statusCode >= 400 &&
      error.statusCode < 500
    ) {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error({ err: error }, 'request failed');
    return reply.code(500).send({ error: 'The request could not be completed.' });
  });
}
