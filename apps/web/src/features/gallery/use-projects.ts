import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useStudioNavigate } from '../../app/use-studio-navigate.js';
import { runMutation } from '../../shared/api/mutation.js';
import { queryKeys } from '../../shared/api/query-keys.js';
import type { Notify } from '../../shared/hooks/use-toasts.js';
import type { Project, ProjectAsset } from '../../shared/types/domain.js';
import type { DestinationController } from '../generation/use-destination.js';
import * as api from './api.js';
import type { ProjectInput } from './api.js';

interface ProjectsOptions {
  activeRepositoryId: string | undefined;
  selectedProjectId: string | undefined;
  destination: DestinationController;
  notify: Notify;
  requireRepository: (action: string) => boolean;
}

export function useProjects({
  activeRepositoryId,
  selectedProjectId,
  destination,
  notify,
  requireRepository,
}: ProjectsOptions) {
  const queryClient = useQueryClient();
  const navigate = useStudioNavigate();

  const projectsQuery = useQuery({
    queryKey: queryKeys.projects(activeRepositoryId),
    queryFn: api.getProjects,
    enabled: Boolean(activeRepositoryId),
    retry: false,
  });
  const projects = projectsQuery.data?.projects ?? [];
  const selectedProjectQuery = useQuery({
    queryKey: queryKeys.project(activeRepositoryId, selectedProjectId),
    queryFn: () => api.getProjectDetail(selectedProjectId ?? ''),
    enabled: Boolean(activeRepositoryId && selectedProjectId),
    retry: false,
  });

  const reportError = (message: string) => {
    notify(message, 'error');
  };

  function invalidateProjects() {
    return queryClient.invalidateQueries({ queryKey: queryKeys.projects(activeRepositoryId) });
  }

  function invalidateProject(projectId: string) {
    return queryClient.invalidateQueries({
      queryKey: queryKeys.project(activeRepositoryId, projectId),
    });
  }

  function invalidateRepositoryContent() {
    return Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.images(activeRepositoryId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.runs(activeRepositoryId) }),
    ]);
  }

  async function createProject(input: ProjectInput) {
    if (!requireRepository('create a project')) return;
    const result = await runMutation(
      () => api.createProject(input),
      'Could not create the project.',
      reportError,
    );
    if (!result.ok) return;
    await invalidateProjects();
    navigate.openProject(result.value.projectId);
    notify('Project created.', 'success');
  }

  async function updateProject(projectId: string, input: ProjectInput) {
    const result = await runMutation(
      () => api.updateProject(projectId, input),
      'Could not update the project.',
      reportError,
    );
    if (!result.ok) return;
    await Promise.all([invalidateProjects(), invalidateProject(projectId)]);
    notify('Project updated.', 'success');
  }

  async function deleteProject(project: Project) {
    if (!window.confirm(`Delete “${project.name}”, its nested assets, and all of its images?`)) {
      return;
    }
    const result = await runMutation(
      () => api.deleteProject(project.projectId),
      'Could not delete the project.',
      reportError,
    );
    if (!result.ok) return;
    const current = destination.destination;
    if (current.kind !== 'main' && current.projectId === project.projectId) {
      destination.resetDestination();
    }
    navigate.goToProjects();
    await Promise.all([invalidateProjects(), invalidateRepositoryContent()]);
    notify('Project deleted.', 'success');
  }

  async function createProjectAsset(projectId: string, input: ProjectInput) {
    const result = await runMutation(
      () => api.createProjectAsset(projectId, input),
      'Could not create the asset.',
      reportError,
    );
    if (!result.ok) return;
    await invalidateProject(projectId);
    notify('Project asset created.', 'success');
  }

  async function editProjectAsset(asset: ProjectAsset) {
    const name = window.prompt('Asset name', asset.name);
    if (!name?.trim()) return;
    const description = window.prompt('Asset description', asset.description);
    if (description === null) return;
    const result = await runMutation(
      () =>
        api.updateProjectAsset(asset.projectId, asset.assetId, {
          name: name.trim(),
          description,
        }),
      'Could not update the asset.',
      reportError,
    );
    if (!result.ok) return;
    await invalidateProject(asset.projectId);
    notify('Project asset updated.', 'success');
  }

  async function deleteProjectAsset(asset: ProjectAsset) {
    if (!window.confirm(`Delete “${asset.name}” and all images generated in it?`)) return;
    const result = await runMutation(
      () => api.deleteProjectAsset(asset.projectId, asset.assetId),
      'Could not delete the asset.',
      reportError,
    );
    if (!result.ok) return;
    const current = destination.destination;
    if (current.kind === 'project-asset' && current.projectAssetId === asset.assetId) {
      destination.setDestination({ kind: 'project', projectId: asset.projectId });
    }
    await Promise.all([invalidateProject(asset.projectId), invalidateRepositoryContent()]);
    notify('Project asset deleted.', 'success');
  }

  return {
    projects,
    projectsQuery,
    selectedProjectId,
    selectedProjectQuery,
    createProject,
    updateProject,
    deleteProject,
    createProjectAsset,
    editProjectAsset,
    deleteProjectAsset,
  };
}

export type ProjectsController = ReturnType<typeof useProjects>;
