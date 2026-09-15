import { generationSetupSchema, type GenerationSetupSource } from '@harness/contracts';
import { queryOptions, skipToken } from '@tanstack/react-query';
import { requestJson } from '../../shared/api/http.js';
import { queryKeys } from '../../shared/api/query-keys.js';

export function generationSetupOptions(
  repositoryId: string | undefined,
  source: GenerationSetupSource | undefined,
) {
  return queryOptions({
    queryKey: queryKeys.generationSetup(repositoryId, source),
    queryFn:
      repositoryId && source
        ? ({ signal }) =>
            requestJson(
              `/api/${source.kind}/${source.id}/setup`,
              generationSetupSchema,
              { signal },
              'Generation setup unavailable.',
            )
        : skipToken,
    staleTime: Infinity,
    retry: false,
  });
}
