import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../shared/api/query-keys.js';
import { getImageMetadata } from '../gallery/api.js';

/** Driven by the addressed image so the dialog survives a reload of its link. */
export function useImageMetadata(
  activeRepositoryId: string | undefined,
  imageId: string | undefined,
) {
  return useQuery({
    queryKey: queryKeys.imageMetadata(activeRepositoryId, imageId),
    queryFn: () => getImageMetadata(imageId ?? ''),
    enabled: imageId !== undefined,
    retry: false,
  });
}

export type ImageMetadataController = ReturnType<typeof useImageMetadata>;
