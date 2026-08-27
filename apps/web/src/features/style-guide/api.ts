import {
  styleGuideFolderDtoSchema,
  styleGuideImageDtoSchema,
  styleGuideResponseSchema,
} from '@harness/contracts';
import { jsonBody, requestJson, requestVoid } from '../../shared/api/http.js';
import type { StyleGuideResponse } from '../../shared/types/domain.js';
import type { UploadAttachment } from '../../shared/types/attachments.js';

export function getStyleGuide(): Promise<StyleGuideResponse> {
  return requestJson('/api/style-guide', styleGuideResponseSchema, {}, 'Style guide unavailable');
}

export function createStyleGuideFolder(name: string) {
  return requestJson(
    '/api/style-guide/folders',
    styleGuideFolderDtoSchema,
    { method: 'POST', ...jsonBody({ name }) },
    'Could not create the folder.',
  );
}

export function renameStyleGuideRecord(endpoint: string, name: string, fallback: string) {
  return requestVoid(endpoint, { method: 'PATCH', ...jsonBody({ name }) }, fallback);
}

export function deleteStyleGuideFolder(folderId: string) {
  return requestVoid(
    `/api/style-guide/folders/${folderId}`,
    { method: 'DELETE' },
    'Could not remove the folder.',
  );
}

export function uploadStyleGuideImage(folderId: string, upload: UploadAttachment) {
  return requestJson(
    `/api/style-guide/folders/${folderId}/images`,
    styleGuideImageDtoSchema,
    {
      method: 'POST',
      ...jsonBody({ name: upload.name, mediaType: upload.mediaType, data: upload.data }),
    },
    'Could not upload the image.',
  );
}

export function styleGuideFolderEndpoint(folderId: string): string {
  return `/api/style-guide/folders/${folderId}`;
}

export function styleGuideImageEndpoint(folderId: string, imageId: string): string {
  return `/api/style-guide/folders/${folderId}/images/${imageId}`;
}

export function styleGuideImageContentUrl(folderId: string, imageId: string): string {
  return `${styleGuideImageEndpoint(folderId, imageId)}/content`;
}

export function deleteStyleGuideImage(folderId: string, imageId: string) {
  return requestVoid(
    styleGuideImageEndpoint(folderId, imageId),
    { method: 'DELETE' },
    'Could not remove the image.',
  );
}
