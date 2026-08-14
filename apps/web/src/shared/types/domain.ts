import type {
  CapabilitiesResponse,
  CapabilityDescriptor,
  Destination,
  GalleryImageDto,
  GalleryResponse,
  ProjectAssetDto,
  ProjectDetailResponse,
  ProjectDto,
  ProjectsResponse,
  ReferenceFolderDto,
  ReferenceImageDto,
  ReferenceLibraryResponse,
  RepositoryStatus,
} from '@harness/contracts';

export type Capability = CapabilityDescriptor;
export type GalleryImage = GalleryImageDto;
export type Project = ProjectDto;
export type ProjectAsset = ProjectAssetDto;
export type ReferenceFolder = ReferenceFolderDto;
export type ReferenceImage = ReferenceImageDto;

export type {
  CapabilitiesResponse,
  Destination,
  GalleryResponse,
  ProjectDetailResponse,
  ProjectsResponse,
  ReferenceLibraryResponse,
  RepositoryStatus,
};
