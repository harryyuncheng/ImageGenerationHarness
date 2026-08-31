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
  ProviderDescriptor,
  ProviderId,
  StyleGuideFolderDto,
  StyleGuideImageDto,
  StyleGuideResponse,
  RepositoryStatus,
} from '@harness/contracts';

export type Capability = CapabilityDescriptor;
export type GalleryImage = GalleryImageDto;
export type Project = ProjectDto;
export type ProjectAsset = ProjectAssetDto;
export type StyleGuideFolder = StyleGuideFolderDto;
export type StyleGuideImage = StyleGuideImageDto;

export type {
  CapabilitiesResponse,
  Destination,
  GalleryResponse,
  ProjectDetailResponse,
  ProjectsResponse,
  ProviderDescriptor,
  ProviderId,
  StyleGuideResponse,
  RepositoryStatus,
};
