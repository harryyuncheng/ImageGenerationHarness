import { galleryResponseSchema } from '@harness/contracts';
import { requestJson } from '../../shared/api/http.js';
import type { GalleryResponse } from '../../shared/types/domain.js';

export function getImages(): Promise<GalleryResponse> {
  return requestJson('/api/images', galleryResponseSchema, {}, 'Gallery unavailable.');
}
