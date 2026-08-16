import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { runMutation } from '../../shared/api/mutation.js';
import { queryKeys, repositoryScopedQueryPrefixes } from '../../shared/api/query-keys.js';
import { useOutsidePointerDown } from '../../shared/hooks/use-outside-pointer-down.js';
import type { Notify } from '../../shared/hooks/use-toasts.js';
import { getRepository, postRepositorySelection } from './api.js';

export function useRepository(notify: Notify) {
  const queryClient = useQueryClient();
  const repositoryQuery = useQuery({
    queryKey: queryKeys.repository(),
    queryFn: getRepository,
    retry: false,
  });
  const activeRepositoryId = repositoryQuery.data?.active?.repositoryId;

  const [menuOpen, setMenuOpen] = useState(false);
  const [attentionCount, setAttentionCount] = useState(0);
  const [isMutating, setIsMutating] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);

  useOutsidePointerDown(anchorRef, menuOpen, () => {
    setMenuOpen(false);
  });

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
      setMenuOpen(false);
      if (status.active) notify(`Using ${status.active.name}.`, 'success');
    } finally {
      setIsMutating(false);
    }
  }

  /** Guards repository-backed actions and draws attention to the picker instead. */
  function requireRepository(action: string): boolean {
    if (activeRepositoryId) return true;
    setMenuOpen(true);
    setAttentionCount((current) => current + 1);
    notify(`Choose an image repository to ${action}.`);
    window.requestAnimationFrame(() => buttonRef.current?.focus());
    return false;
  }

  return {
    repositoryQuery,
    activeRepositoryId,
    menuOpen,
    setMenuOpen,
    attentionCount,
    isMutating,
    buttonRef,
    anchorRef,
    selectRepository,
    requireRepository,
  };
}

export type RepositoryController = ReturnType<typeof useRepository>;
