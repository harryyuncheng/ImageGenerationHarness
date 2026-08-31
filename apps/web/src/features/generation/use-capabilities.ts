import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../shared/api/query-keys.js';
import { getCapabilities } from './api.js';
import { defaultCapabilities, defaultProviders } from './capabilities.js';

export function useCapabilities() {
  const capabilitiesQuery = useQuery({
    queryKey: queryKeys.capabilities(),
    queryFn: getCapabilities,
    staleTime: Infinity,
  });
  return {
    capabilitiesQuery,
    capabilities: capabilitiesQuery.data?.targets ?? defaultCapabilities,
    providers: capabilitiesQuery.data?.providers ?? defaultProviders,
  };
}
