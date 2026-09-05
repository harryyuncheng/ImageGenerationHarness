import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { runMutation } from '../../shared/api/mutation.js';
import { queryKeys, repositoryScopedQueryPrefixes } from '../../shared/api/query-keys.js';
import type { Notify } from '../../shared/hooks/use-toasts.js';
import { getRepository, postRepositorySelection } from './api.js';

export function useRepository(notify: Notify, setRepositorySettingsOpen: (open: boolean) => void) {
  const queryClient = useQueryClient();
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
    setIsMutating(true);
    try {
      const result = await runMutation(
        () => postRepositorySelection(endpoint),
        'Could not select the repository.',
        (message) => {
          notify(message, 'error');
        },
      );
      if (!result.ok) return;
      const status = result.value;
      clearRepositoryQueries();
      queryClient.setQueryData(queryKeys.repository(), status);
      // A cancelled native picker resolves with the unchanged status, which must not read as a switch.
      if (status.active && status.active.repositoryId !== activeRepositoryId) {
        setRepositorySettingsOpen(false);
        notify(`Using ${status.active.name}.`, 'success');
      }
    } finally {
      setIsMutating(false);
    }
  }

  /** Guards repository-backed actions and reveals the repository settings instead. */
  function requireRepository(action: string): boolean {
    if (activeRepositoryId) return true;
    setRepositorySettingsOpen(true);
    notify(`Choose an image repository to ${action}.`);
    return false;
  }

  return {
    repositoryQuery,
    activeRepositoryId,
    isMutating,
    selectRepository,
    requireRepository,
  };
}

export type RepositoryController = ReturnType<typeof useRepository>;
