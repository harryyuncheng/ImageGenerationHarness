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
  maskSourceId?: string;
  maskEncoding?: 'alpha' | 'luminance';
}

interface RepositoryAttachment extends AttachmentBase {
  source: 'repository';
  imageId: string;
}

export interface StyleGuideAttachment extends AttachmentBase {
  source: 'style-guide';
  folderId: string;
  imageId: string;
}

export type Attachment = UploadAttachment | RepositoryAttachment | StyleGuideAttachment;

export interface ImageInputs {
  source: Attachment | undefined;
  references: readonly Attachment[];
  mask: UploadAttachment | undefined;
}

export type ImageInputRole = keyof ImageInputs;
