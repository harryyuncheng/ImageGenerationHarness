import type { Destination, GalleryImage } from '../../shared/types/domain.js';

/** Maps a saved image back to the destination that produced it. */
export function imageDestination(image: GalleryImage): Destination {
  if (!image.projectId) return { kind: 'main' };
  if (!image.projectAssetId) return { kind: 'project', projectId: image.projectId };
  return {
    kind: 'project-asset',
    projectId: image.projectId,
    projectAssetId: image.projectAssetId,
  };
}

export function destinationQuery(destination: Destination): string {
  const query = new URLSearchParams({ destination: destination.kind });
  if (destination.kind !== 'main') query.set('projectId', destination.projectId);
  if (destination.kind === 'project-asset') {
    query.set('projectAssetId', destination.projectAssetId);
  }
  return query.toString();
}
