import { projectAssetDtoSchema, projectDtoSchema } from '@harness/contracts';
import type { Project, ProjectAsset } from '@harness/domain';

function organizationalDto(record: Project | ProjectAsset) {
  return {
    name: record.name,
    description: record.description,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    ...(record.archivedAt === undefined ? {} : { archivedAt: record.archivedAt }),
  };
}

export function projectDto(project: Project) {
  return projectDtoSchema.parse({
    projectId: project.projectId,
    ...organizationalDto(project),
  });
}

export function projectAssetDto(asset: ProjectAsset) {
  return projectAssetDtoSchema.parse({
    assetId: asset.assetId,
    projectId: asset.projectId,
    ...organizationalDto(asset),
  });
}
