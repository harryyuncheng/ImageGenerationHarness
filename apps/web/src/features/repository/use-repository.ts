import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { runMutation } from '../../shared/api/mutation.js';
import { queryKeys, repositoryScopedQueryPrefixes } from '../../shared/api/query-keys.js';
import { useAlert } from '../../shared/hooks/use-alert.js';
import { getRepository, postRepositorySelection } from './api.js';

export function useRepository(setRepositorySettingsOpen: (open: boolean) => void) {
  const queryClient = useQueryClient();
  const feedback = useAlert();
  const repositoryQuery = useQuery({
    queryKey: queryKeys.repository(),
    queryFn: getRepository,
    retry: false,
  });
  const activeRepositoryId = repositoryQuery.data?.active?.repositoryId;

  const [isMutating, setIsMutating] = useState(false);

  /** Repository-scoped caches are dropped entirely so a switch can never leak data. */
  function clearRepositoryQueries() {
    queryClient.removeQueries({
      predicate: (query) => repositoryScopedQueryPrefixes.includes(String(query.queryKey[0])),
    });
  }

  async function selectRepository(endpoint: string) {
    feedback.clearAlert();
    setIsMutating(true);
    try {
      const result = await runMutation(
        () => postRepositorySelection(endpoint),
        'Could not select the repository.',
        feedback.reportError,
      );
      if (!result.ok) {
        await repositoryQuery.refetch();
        return;
      }
      const status = result.value;
      // A cancelled native picker returns the unchanged status, not a repository switch.
      const switched = status.active?.repositoryId !== activeRepositoryId;
      if (switched) clearRepositoryQueries();
      queryClient.setQueryData(queryKeys.repository(), status);
      if (status.active && switched) setRepositorySettingsOpen(false);
    } finally {
      setIsMutating(false);
    }
  }

  /** Guards repository-backed actions and reveals the repository settings instead. */
  function requireRepository(action: string): boolean {
    if (activeRepositoryId) return true;
    setRepositorySettingsOpen(true);
    feedback.reportError(`Choose an image repository to ${action}.`);
    return false;
  }

  return {
    repositoryQuery,
    feedback,
    activeRepositoryId,
    isMutating,
    selectRepository,
    requireRepository,
  };
}

export type RepositoryController = ReturnType<typeof useRepository>;
