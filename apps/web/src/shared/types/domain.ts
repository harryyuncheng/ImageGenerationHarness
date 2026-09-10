import type {
  CapabilitiesResponse,
  CapabilityDescriptor,
  GalleryImageDto,
  GalleryResponse,
  PresetDto,
  PresetsResponse,
  ProviderDescriptor,
  StyleGuideFolderDto,
  StyleGuideImageDto,
  StyleGuideResponse,
  RepositoryStatus,
} from '@harness/contracts';

export type Capability = CapabilityDescriptor;
export type GalleryImage = GalleryImageDto;
export type Preset = PresetDto;
export type StyleGuideFolder = StyleGuideFolderDto;
export type StyleGuideImage = StyleGuideImageDto;

export type {
  CapabilitiesResponse,
  GalleryResponse,
  PresetsResponse,
  ProviderDescriptor,
  StyleGuideResponse,
  RepositoryStatus,
};
