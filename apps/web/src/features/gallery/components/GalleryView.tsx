import { useState } from 'react';
import type { Destination, GalleryImage } from '../../../shared/types/domain.js';
import type { ProjectsController } from '../use-projects.js';
import { ProjectDashboard } from './ProjectDashboard.js';
import { ProjectsBrowser } from './ProjectsBrowser.js';

interface GalleryViewProps {
  projects: ProjectsController;
  images: GalleryImage[];
  repositoryReady: boolean;
  onRepositoryRequired: () => void;
  onGenerate: (destination: Destination) => void;
  onOpenImage: (image: GalleryImage, location: string) => void;
}

/** Projects are the gallery: a browsable list or one project dashboard. */
export function GalleryView({
  projects,
  images,
  repositoryReady,
  onRepositoryRequired,
  onGenerate,
  onOpenImage,
}: GalleryViewProps) {
  const [search, setSearch] = useState('');
  const [creatingProject, setCreatingProject] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');

  const detail = projects.selectedProjectQuery.data;
  const projectsError = projects.projectsQuery.error;
  const detailError = projects.selectedProjectQuery.error;
  const error =
    projectsError instanceof Error
      ? projectsError.message
      : detailError instanceof Error
        ? detailError.message
        : undefined;

  function toggleProjectCreation() {
    if (!creatingProject && !repositoryReady) {
      onRepositoryRequired();
      return;
    }
    setCreatingProject((value) => !value);
  }

  if (detail) {
    return (
      <ProjectDashboard
        detail={detail}
        images={images}
        onSelect={projects.setSelectedProjectId}
        onUpdate={projects.updateProject}
        onDelete={(project) => {
          void projects.deleteProject(project);
        }}
        onCreateAsset={projects.createProjectAsset}
        onEditAsset={(asset) => {
          void projects.editProjectAsset(asset);
        }}
        onDeleteAsset={(asset) => {
          void projects.deleteProjectAsset(asset);
        }}
        onGenerate={onGenerate}
        onOpenImage={onOpenImage}
      />
    );
  }

  return (
    <ProjectsBrowser
      projects={projects.projects}
      draft={{
        search,
        setSearch,
        creatingProject,
        setCreatingProject,
        projectName,
        setProjectName,
        projectDescription,
        setProjectDescription,
      }}
      isLoading={projects.projectsQuery.isLoading || projects.selectedProjectQuery.isLoading}
      {...(error === undefined ? {} : { error })}
      onSelect={projects.setSelectedProjectId}
      onCreate={projects.createProject}
      onToggleCreation={toggleProjectCreation}
    />
  );
}
