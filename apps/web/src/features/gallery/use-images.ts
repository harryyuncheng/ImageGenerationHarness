import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../shared/api/query-keys.js';
import { getImages } from './api.js';

/** Saved images are only polled while a surface is actually showing them. */
export function useImages(activeRepositoryId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: queryKeys.allImages(activeRepositoryId),
    queryFn: async () => {
      // A slow, older snapshot must not remove frames for outputs completed during its request.
      const requestedAt = Date.now();
      return { ...(await getImages()), requestedAt };
    },
    enabled: Boolean(activeRepositoryId) && enabled,
    retry: false,
    refetchInterval: 3000,
  });
}
