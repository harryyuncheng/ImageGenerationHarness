import { createRootRoute, createRoute, createRouter, Navigate } from '@tanstack/react-router';
import { useState } from 'react';
import { GalleryTabs } from '../features/gallery/components/GalleryTabs.js';
import { ProjectDashboard } from '../features/gallery/components/ProjectDashboard.js';
import { ProjectsBrowser } from '../features/gallery/components/ProjectsBrowser.js';
import { useImages } from '../features/gallery/use-images.js';
import { CreateView } from '../features/generation/components/CreateView.js';
import { HistoryView } from '../features/history/components/HistoryView.js';
import { PresetsView } from '../features/presets/components/PresetsView.js';
import { useStudio } from './studio-context.js';
import { studioSearchSchema } from './studio-search.js';
import { StudioShell } from './StudioShell.js';

function CreateRoute() {
  const studio = useStudio();
  const { destination } = studio.destination;
  const destinationLabel =
    destination.kind === 'main' ? undefined : studio.describeDestination(destination);

  return (
    <CreateView
      promptDraft={studio.promptDraft}
      settings={studio.settings}
      attachments={studio.attachments}
      draftActions={studio.draftActions}
      generation={studio.generation}
      capabilities={studio.capabilities}
      providers={studio.providers}
      {...(studio.viewer === undefined ? {} : { loaded: studio.viewer })}
      {...(destinationLabel === undefined ? {} : { destinationLabel })}
      onSavePrompt={() => {
        studio.savedPrompts.savePrompt(studio.promptDraft.prompt);
      }}
    />
  );
}

function HistoryRoute() {
  const studio = useStudio();

  return (
    <HistoryView
      runs={studio.runs.allRuns}
      headerActions={<GalleryTabs />}
      onCreate={studio.navigate.goToCreate}
      onOpenRun={(run) => {
        studio.navigate.openRun(run.remoteId ?? run.id);
      }}
      onFavorite={studio.favorites.toggleFavorite}
    />
  );
}

function ProjectsRoute() {
  const studio = useStudio();
  const [search, setSearch] = useState('');
  const [creatingProject, setCreatingProject] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const { projectsQuery } = studio.projects;
  const { error } = projectsQuery;

  return (
    <ProjectsBrowser
      projects={studio.projects.projects}
      headerActions={<GalleryTabs />}
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
      isLoading={projectsQuery.isLoading}
      {...(error instanceof Error ? { error: error.message } : {})}
      onSelect={studio.navigate.openProject}
      onCreate={studio.projects.createProject}
      onRetry={() => {
        void projectsQuery.refetch();
      }}
      onToggleCreation={() => {
        if (!creatingProject && !studio.activeRepositoryId) {
          studio.repository.requireRepository('create a project');
          return;
        }
        setCreatingProject((value) => !value);
      }}
    />
  );
}

function ProjectRoute() {
  const studio = useStudio();
  const imagesQuery = useImages(studio.activeRepositoryId);
  const { selectedProjectQuery } = studio.projects;
  const detail = selectedProjectQuery.data;

  if (!detail) return <GalleryTabs />;

  return (
    <ProjectDashboard
      detail={detail}
      images={imagesQuery.data?.images ?? []}
      headerActions={<GalleryTabs />}
      onBack={studio.navigate.goToProjects}
      onUpdate={studio.projects.updateProject}
      onDelete={(project) => {
        void studio.projects.deleteProject(project);
      }}
      onCreateAsset={studio.projects.createProjectAsset}
      onEditAsset={(asset) => {
        void studio.projects.editProjectAsset(asset);
      }}
      onDeleteAsset={(asset) => {
        void studio.projects.deleteProjectAsset(asset);
      }}
      onGenerate={studio.draftActions.generateTo}
      onOpenImage={(image) => {
        studio.navigate.openImage(image);
      }}
    />
  );
}

function PresetsRoute() {
  const studio = useStudio();

  return (
    <PresetsView
      prompts={studio.savedPrompts.savedPrompts}
      onUse={(value) => {
        studio.promptDraft.setPrompt(value);
        studio.navigate.goToCreate();
      }}
      onDelete={studio.savedPrompts.deletePrompt}
      onCreate={studio.navigate.goToCreate}
    />
  );
}

const rootRoute = createRootRoute({
  component: StudioShell,
  validateSearch: studioSearchSchema,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: CreateRoute,
});

const galleryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/gallery',
  component: () => <Navigate to="/gallery/history" replace />,
});

const historyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/gallery/history',
  component: HistoryRoute,
});

const projectsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/gallery/projects',
  component: ProjectsRoute,
});

const projectRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/gallery/projects/$projectId',
  component: ProjectRoute,
});

// The style guide renders as a modal in the shell, so this route keeps the create screen behind it.
const styleGuideRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/style-guide',
  component: CreateRoute,
});

const presetsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/presets',
  component: PresetsRoute,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  galleryRoute,
  historyRoute,
  projectsRoute,
  projectRoute,
  styleGuideRoute,
  presetsRoute,
]);

export const router = createRouter({ routeTree, defaultPreload: false });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
