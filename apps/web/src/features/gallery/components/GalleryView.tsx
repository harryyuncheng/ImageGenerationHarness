import { CalendarDays, FolderTree } from 'lucide-react';
import { useState } from 'react';
import type { GallerySort } from '../../../app/navigation.js';
import type { Destination, GalleryImage } from '../../../shared/types/domain.js';
import { HistoryView } from '../../history/components/HistoryView.js';
import type { StudioRun } from '../../history/run-presentation.js';
import type { ProjectsController } from '../use-projects.js';
import { ProjectDashboard } from './ProjectDashboard.js';
import { ProjectsBrowser } from './ProjectsBrowser.js';

interface GalleryViewProps {
  projects: ProjectsController;
  images: GalleryImage[];
  runs: StudioRun[];
  sort: GallerySort;
  repositoryReady: boolean;
  onRepositoryRequired: () => void;
  onGenerate: (destination: Destination) => void;
  onOpenImage: (image: GalleryImage, location: string) => void;
  onCreate: () => void;
  onOpenRun: (run: StudioRun) => void;
  onFavorite: (runId: string) => void;
  onSortChange: (sort: GallerySort) => void;
}

function GallerySortControl({
  value,
  onChange,
}: {
  value: GallerySort;
  onChange: (value: GallerySort) => void;
}) {
  const options = [
    { value: 'chronological', label: 'Chronological', Icon: CalendarDays },
    { value: 'project', label: 'By project', Icon: FolderTree },
  ] as const;

  return (
    <div className="gallery-sort-control">
      <span>Sort</span>
      <div role="group" aria-label="Sort gallery">
        {options.map(({ value: option, label, Icon }) => (
          <button
            type="button"
            key={option}
            className={value === option ? 'selected' : ''}
            aria-pressed={value === option}
            onClick={() => {
              onChange(option);
            }}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** One gallery, organized either chronologically or by project. */
export function GalleryView({
  projects,
  images,
  runs,
  sort,
  repositoryReady,
  onRepositoryRequired,
  onGenerate,
  onOpenImage,
  onCreate,
  onOpenRun,
  onFavorite,
  onSortChange,
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

  const sortControl = <GallerySortControl value={sort} onChange={onSortChange} />;

  if (sort === 'chronological') {
    return (
      <HistoryView
        runs={runs}
        headerActions={sortControl}
        onCreate={onCreate}
        onOpenRun={onOpenRun}
        onFavorite={onFavorite}
      />
    );
  }

  if (detail) {
    return (
      <ProjectDashboard
        detail={detail}
        images={images}
        headerActions={sortControl}
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
      headerActions={sortControl}
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
