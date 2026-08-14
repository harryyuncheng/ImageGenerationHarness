import {
  galleryResponseSchema,
  generatedImageSidecarSchema,
  projectAssetDtoSchema,
  projectDetailResponseSchema,
  projectDtoSchema,
  projectsResponseSchema,
} from '@harness/contracts';
import type { GeneratedImageSidecar } from '@harness/contracts';
import { jsonBody, requestJson, requestVoid } from '../../shared/api/http.js';
import type {
  Destination,
  GalleryResponse,
  ProjectDetailResponse,
  ProjectsResponse,
} from '../../shared/types/domain.js';
import { destinationQuery } from '../generation/destination.js';

export interface ProjectInput {
  name: string;
  description: string;
}

export function getProjects(): Promise<ProjectsResponse> {
  return requestJson('/api/projects', projectsResponseSchema, {}, 'Projects unavailable');
}

export function getProjectDetail(projectId: string): Promise<ProjectDetailResponse> {
  return requestJson(
    `/api/projects/${projectId}`,
    projectDetailResponseSchema,
    {},
    'Project unavailable',
  );
}

export function createProject(input: ProjectInput) {
  return requestJson(
    '/api/projects',
    projectDtoSchema,
    { method: 'POST', ...jsonBody(input) },
    'Could not create the project.',
  );
}

export function updateProject(projectId: string, input: ProjectInput) {
  return requestJson(
    `/api/projects/${projectId}`,
    projectDtoSchema,
    { method: 'PATCH', ...jsonBody(input) },
    'Could not update the project.',
  );
}

export function deleteProject(projectId: string) {
  return requestVoid(
    `/api/projects/${projectId}`,
    { method: 'DELETE' },
    'Could not delete the project.',
  );
}

export function createProjectAsset(projectId: string, input: ProjectInput) {
  return requestJson(
    `/api/projects/${projectId}/assets`,
    projectAssetDtoSchema,
    { method: 'POST', ...jsonBody(input) },
    'Could not create the asset.',
  );
}

export function updateProjectAsset(projectId: string, assetId: string, input: ProjectInput) {
  return requestJson(
    `/api/projects/${projectId}/assets/${assetId}`,
    projectAssetDtoSchema,
    { method: 'PATCH', ...jsonBody(input) },
    'Could not update the asset.',
  );
}

export function deleteProjectAsset(projectId: string, assetId: string) {
  return requestVoid(
    `/api/projects/${projectId}/assets/${assetId}`,
    { method: 'DELETE' },
    'Could not delete the asset.',
  );
}

export function getImages(destination?: Destination): Promise<GalleryResponse> {
  const suffix = destination ? `?${destinationQuery(destination)}` : '';
  return requestJson(`/api/images${suffix}`, galleryResponseSchema, {}, 'Gallery unavailable');
}

export function getImageMetadata(imageId: string): Promise<GeneratedImageSidecar> {
  return requestJson(
    `/api/images/${imageId}/metadata`,
    generatedImageSidecarSchema,
    {},
    'Image metadata unavailable',
  );
}
