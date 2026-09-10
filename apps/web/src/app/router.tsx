import { createRootRoute, createRoute, createRouter, Navigate } from '@tanstack/react-router';
import { InlineError } from '../shared/components/InlineError.js';
import { useImages } from '../features/gallery/use-images.js';
import { HistoryView } from '../features/history/components/HistoryView.js';
import { useStudio } from './studio-context.js';
import { studioSearchSchema } from './studio-search.js';
import { StudioShell } from './StudioShell.js';
import { sheetTransitionTypes } from './sheet-transition.js';

function HistoryRoute() {
  const studio = useStudio();
  const imagesQuery = useImages(studio.activeRepositoryId);
  const { repositoryQuery } = studio.repository;
  const error = repositoryQuery.error ?? imagesQuery.error;

  return (
    <HistoryView
      runs={studio.runs.allRuns}
      images={imagesQuery.data?.images ?? []}
      imagesUpdatedAt={imagesQuery.dataUpdatedAt}
      feedback={<InlineError feedback={studio.runs.feedback} />}
      hasRepository={studio.activeRepositoryId !== undefined}
      isLoading={repositoryQuery.isLoading || imagesQuery.isLoading}
      {...(error instanceof Error ? { error: error.message } : {})}
      onCreate={studio.navigate.returnToCanvas}
      onChooseRepository={() => {
        studio.repository.requireRepository('browse your gallery');
      }}
      onRetry={() => {
        if (repositoryQuery.isError) void repositoryQuery.refetch();
        else void imagesQuery.refetch();
      }}
      onOpenRun={(run) => {
        studio.navigate.openRun(run.remoteId ?? run.id);
      }}
      onOpenImage={studio.navigate.openImage}
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
});

const galleryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/gallery',
  component: () => <Navigate to="/gallery/history" search={(previous) => previous} replace />,
});

const historyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/gallery/history',
  component: HistoryRoute,
});

// Libraries render as shell overlays, keeping the current canvas behind them.
const styleGuideRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/style-guide',
});

const presetsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/presets',
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  galleryRoute,
  historyRoute,
  styleGuideRoute,
  presetsRoute,
]);

export const router = createRouter({
  routeTree,
  defaultPreload: false,
  scrollRestoration: true,
  scrollToTopSelectors: ['.canvas'],
  defaultViewTransition: {
    types: sheetTransitionTypes,
  },
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
