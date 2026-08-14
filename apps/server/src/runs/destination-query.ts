import { destinationQuerySchema } from '@harness/contracts';

export function parseDestinationQuery(query: unknown) {
  const parsed = destinationQuerySchema.parse(query);
  if (!('destination' in parsed)) return undefined;
  if (parsed.destination === 'main') return { kind: 'main' as const };
  if (parsed.destination === 'project') {
    return { kind: 'project' as const, projectId: parsed.projectId };
  }
  return {
    kind: 'project-asset' as const,
    projectId: parsed.projectId,
    projectAssetId: parsed.projectAssetId,
  };
}
