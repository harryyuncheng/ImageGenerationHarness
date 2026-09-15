import { createRootRoute, createRoute, createRouter, Navigate } from '@tanstack/react-router';
import { Alert } from '../shared/components/Alert.js';
import { useImages } from '../features/gallery/use-images.js';
import { HistoryView } from '../features/history/components/HistoryView.js';
import { useStudio } from './studio-context.js';
import { studioSearchSchema } from './studio-search.js';
import { StudioShell } from './StudioShell.js';
import { connectSheetImage, sheetTransitionTypes } from './sheet-transition.js';

function GalleryRoute() {
  const studio = useStudio();
  const imagesQuery = useImages(studio.activeRepositoryId);
  const { repositoryQuery } = studio.repository;
  const error = repositoryQuery.error ?? imagesQuery.error;

  return (
    <HistoryView
      runs={studio.runs.allRuns}
      images={imagesQuery.data?.images ?? []}
      imagesRequestedAt={imagesQuery.data?.requestedAt ?? 0}
      feedback={<Alert feedback={studio.runs.feedback} />}
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
      onOpenImage={studio.draftActions.openImage}
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
  component: GalleryRoute,
});

const legacyGalleryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/gallery/history',
  component: () => <Navigate to="/gallery" search={(previous) => previous} replace />,
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
  legacyGalleryRoute,
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

// Measure only after draft restoration, frame replacement, and the router's scroll restoration.
router.subscribe('onRendered', connectSheetImage);

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
