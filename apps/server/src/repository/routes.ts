import { repositoryParamsSchema } from '@harness/contracts';
import type { RepositoryStatus } from '@harness/domain';
import type { FastifyInstance } from 'fastify';
import { ApiError } from '../app/api-error.js';
import type { RepositoryManagerLike } from '../app/types.js';
import { RepositoryUnavailableError } from './errors.js';
import { repositoryStatusDto } from './repository-dto.js';

interface RepositoryRouteDependencies {
  repositoryManager: RepositoryManagerLike;
  recoverSelectedRepository(status: RepositoryStatus): Promise<void>;
}

export function registerRepositoryRoutes(
  app: FastifyInstance,
  dependencies: RepositoryRouteDependencies,
): void {
  const { repositoryManager } = dependencies;
  const recoverSelectedRepository = (status: RepositoryStatus) =>
    dependencies.recoverSelectedRepository(status);

  app.get('/api/repository', () => repositoryStatusDto(repositoryManager.getStatus()));
  app.post('/api/repository/choose', async () => {
    const status = await repositoryManager.choose();
    await recoverSelectedRepository(status);
    return repositoryStatusDto(status);
  });
  app.post('/api/repository/activate/:repositoryId', async (request) => {
    const { repositoryId } = repositoryParamsSchema.parse(request.params);
    let status: RepositoryStatus;
    try {
      status = await repositoryManager.activateRepository(repositoryId);
    } catch (error) {
      if (error instanceof RepositoryUnavailableError) {
        throw new ApiError(404, 'Repository not found.');
      }
      throw error;
    }
    await recoverSelectedRepository(status);
    return repositoryStatusDto(status);
  });
}
