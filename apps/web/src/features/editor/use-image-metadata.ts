import { useState } from 'react';
import type { GeneratedImageSidecar } from '@harness/contracts';
import { getImageMetadata } from '../gallery/api.js';

/** Loads the authoritative sidecar for a saved image into the metadata dialog. */
export function useImageMetadata(openDialog: () => void) {
  const [metadata, setMetadata] = useState<GeneratedImageSidecar>();
  const [metadataError, setMetadataError] = useState<string>();

  async function viewMetadata(imageId: string) {
    setMetadata(undefined);
    setMetadataError(undefined);
    openDialog();
    try {
      setMetadata(await getImageMetadata(imageId));
    } catch (error) {
      setMetadataError(error instanceof Error ? error.message : 'Image metadata unavailable');
    }
  }

  return { metadata, metadataError, viewMetadata };
}

export type ImageMetadataController = ReturnType<typeof useImageMetadata>;
