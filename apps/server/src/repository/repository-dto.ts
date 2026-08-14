import { repositoryStatusSchema } from '@harness/contracts';
import type { RepositoryStatus } from '@harness/domain';

export function repositoryStatusDto(status: RepositoryStatus) {
  return repositoryStatusSchema.parse({
    active: status.active
      ? { repositoryId: status.active.repositoryId, name: status.active.name }
      : null,
    recent: status.recent.map((repository) => ({
      repositoryId: repository.repositoryId,
      name: repository.name,
    })),
  });
}
