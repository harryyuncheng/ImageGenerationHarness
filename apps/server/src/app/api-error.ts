import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ProjectServiceError } from '../projects/project-records.js';
import { ReferenceLibraryError } from '../references/reference-records.js';
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

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ApiError) {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    if (error instanceof RepositoryUnavailableError) {
      return reply.code(503).send({ error: error.message });
    }
    if (error instanceof ProjectServiceError || error instanceof ReferenceLibraryError) {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    if (error instanceof z.ZodError) {
      return reply.code(400).send({
        error: 'Invalid request.',
        issues: error.issues.map((issue) => ({ path: issue.path, message: issue.message })),
      });
    }
    request.log.error({ err: error }, 'request failed');
    return reply.code(500).send({ error: 'The request could not be completed.' });
  });
}
