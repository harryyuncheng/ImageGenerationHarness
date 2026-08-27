import type { MediaType } from '@harness/contracts';

interface AttachmentBase {
  id: string;
  name: string;
  mediaType: MediaType;
  byteLength: number;
  previewUrl: string;
}

export interface UploadAttachment extends AttachmentBase {
  source: 'upload';
  data: string;
}

export interface StyleGuideAttachment extends AttachmentBase {
  source: 'style-guide';
  folderId: string;
  imageId: string;
}

export type Attachment = UploadAttachment | StyleGuideAttachment;
