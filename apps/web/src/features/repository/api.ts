import { repositoryStatusSchema } from '@harness/contracts';
import { requestJson } from '../../shared/api/http.js';
import type { RepositoryStatus } from '../../shared/types/domain.js';

export function getRepository(): Promise<RepositoryStatus> {
  return requestJson(
    '/api/repository',
    repositoryStatusSchema,
    {},
    'Repository status unavailable',
  );
}

export const chooseRepositoryEndpoint = '/api/repository/choose';

export function activateRepositoryEndpoint(repositoryId: string): string {
  return `/api/repository/activate/${repositoryId}`;
}

export function postRepositorySelection(endpoint: string): Promise<RepositoryStatus> {
  return requestJson(endpoint, repositoryStatusSchema, { method: 'POST' });
}
