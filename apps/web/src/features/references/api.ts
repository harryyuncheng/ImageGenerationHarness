import {
  referenceFolderDtoSchema,
  referenceImageDtoSchema,
  referenceLibraryResponseSchema,
} from '@harness/contracts';
import { jsonBody, requestJson, requestVoid } from '../../shared/api/http.js';
import type { ReferenceLibraryResponse } from '../../shared/types/domain.js';
import type { UploadAttachment } from '../../shared/types/attachments.js';

export function getReferenceLibrary(): Promise<ReferenceLibraryResponse> {
  return requestJson(
    '/api/reference-library',
    referenceLibraryResponseSchema,
    {},
    'Reference library unavailable',
  );
}

export function createReferenceFolder(name: string) {
  return requestJson(
    '/api/reference-folders',
    referenceFolderDtoSchema,
    { method: 'POST', ...jsonBody({ name }) },
    'Could not create the folder.',
  );
}

export function renameReferenceRecord(endpoint: string, name: string, fallback: string) {
  return requestVoid(endpoint, { method: 'PATCH', ...jsonBody({ name }) }, fallback);
}

export function deleteReferenceFolder(folderId: string) {
  return requestVoid(
    `/api/reference-folders/${folderId}`,
    { method: 'DELETE' },
    'Could not remove the folder.',
  );
}

export function uploadReferenceImage(folderId: string, upload: UploadAttachment) {
  return requestJson(
    `/api/reference-folders/${folderId}/images`,
    referenceImageDtoSchema,
    {
      method: 'POST',
      ...jsonBody({ name: upload.name, mediaType: upload.mediaType, data: upload.data }),
    },
    'Could not upload the image.',
  );
}

export function referenceFolderEndpoint(folderId: string): string {
  return `/api/reference-folders/${folderId}`;
}

export function referenceImageEndpoint(folderId: string, imageId: string): string {
  return `/api/reference-folders/${folderId}/images/${imageId}`;
}

export function referenceImageContentUrl(folderId: string, imageId: string): string {
  return `${referenceImageEndpoint(folderId, imageId)}/content`;
}

export function deleteReferenceImage(folderId: string, imageId: string) {
  return requestVoid(
    referenceImageEndpoint(folderId, imageId),
    { method: 'DELETE' },
    'Could not remove the image.',
  );
}
