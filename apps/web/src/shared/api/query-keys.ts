/**
 * Every repository-scoped key keeps its owning repository identifier so switching
 * repositories can never surface data from another one.
 */
export const queryKeys = {
  capabilities: () => ['capabilities'] as const,
  repository: () => ['repository'] as const,
  projects: (repositoryId: string | undefined) => ['projects', repositoryId] as const,
  project: (repositoryId: string | undefined, projectId: string | undefined) =>
    ['project', repositoryId, projectId] as const,
  styleGuide: (repositoryId: string | undefined) => ['style-guide', repositoryId] as const,
  runs: (repositoryId: string | undefined) => ['runs', repositoryId] as const,
  allRuns: (repositoryId: string | undefined) => ['runs', repositoryId, 'all'] as const,
  images: (repositoryId: string | undefined) => ['images', repositoryId] as const,
  allImages: (repositoryId: string | undefined) => ['images', repositoryId, 'all'] as const,
};

export const repositoryScopedQueryPrefixes: readonly string[] = [
  'projects',
  'project',
  'style-guide',
  'runs',
  'images',
];
