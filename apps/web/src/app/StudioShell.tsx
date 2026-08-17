import { Bookmark, FolderOpen } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Outlet, useParams, useRouterState, useSearch } from '@tanstack/react-router';
import { resolveEditorFocus, type EditorFocus } from '../features/editor/use-editor-focus.js';
import { useImages } from '../features/gallery/use-images.js';
import { AppSettings } from './AppSettings.js';
import { CanvasEditor } from './CanvasEditor.js';
import { StudioOverlays } from './StudioOverlays.js';
import { StudioPanels } from './StudioPanels.js';
import { StudioProvider, useStudio } from './studio-context.js';
import { TopBar } from './TopBar.js';
import { useGlobalShortcuts } from './use-global-shortcuts.js';

export type PreviewModal = 'code' | 'request' | null;

/** Which surface the current route and focus combine to show. */
function useStudioSurface(focus: EditorFocus | undefined, settingsOpen: boolean) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const hasEditSource =
    focus?.kind === 'upload' || (focus?.kind === 'image' && focus.intent === 'edit');
  const showCreateWorkspace = pathname === '/' && focus === undefined;
  const showEditWorkspace = pathname === '/edit' && (focus === undefined || hasEditSource);
  const showSettings = showCreateWorkspace && settingsOpen;

  return {
    pathname,
    hasEditSource,
    showCreateWorkspace,
    showEditWorkspace,
    showSettings,
    panelCapable: showCreateWorkspace || showEditWorkspace,
    panelOpen: showSettings || showEditWorkspace,
  };
}

function StudioLayout() {
  const studio = useStudio();
  const search = useSearch({ strict: false });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [previewModal, setPreviewModal] = useState<PreviewModal>(null);
  const [appSettingsOpen, setAppSettingsOpen] = useState(false);

  const imagesQuery = useImages(studio.activeRepositoryId, search.image !== undefined);
  const focus = resolveEditorFocus(
    search,
    imagesQuery.data?.images ?? [],
    studio.runs.allRuns,
    studio.upload.upload,
  );
  const surface = useStudioSurface(focus, settingsOpen);

  const { clearUpload } = studio.upload;
  useEffect(() => {
    if (surface.pathname !== '/edit') clearUpload();
  }, [surface.pathname, clearUpload]);

  useGlobalShortcuts({
    closeOverlays: () => {
      setPreviewModal(null);
      studio.navigate.closeMetadata();
      studio.draftActions.closeModelMenu();
      setAppSettingsOpen(false);
      studio.repository.setMenuOpen(false);
    },
    openSettings: () => {
      setPreviewModal(null);
      setAppSettingsOpen(true);
    },
    fileInput: studio.attachments.fileInput,
    promptInput: studio.promptDraft.promptInput,
  });

  const isGallery = surface.pathname.startsWith('/gallery');

  return (
    <div
      className={`studio-shell ${surface.panelCapable ? 'studio-shell--panel-capable' : ''} ${surface.panelOpen ? 'studio-shell--panel-open' : ''}`}
    >
      <AppSettings open={appSettingsOpen} onOpenChange={setAppSettingsOpen} />

      <div className={`studio-main ${surface.showCreateWorkspace ? 'studio-main--create' : ''}`}>
        <TopBar
          settingsOpen={settingsOpen}
          showCreateWorkspace={surface.showCreateWorkspace}
          onOpenSettings={() => {
            setSettingsOpen(true);
          }}
        />

        <div className="workspace">
          <main className="canvas">{focus ? <CanvasEditor focus={focus} /> : <Outlet />}</main>
        </div>

        <nav className="library-shortcuts" aria-label="Library shortcuts">
          <button
            type="button"
            className={`icon-button studio-corner-icon ${surface.pathname === '/references' ? 'active' : ''}`}
            aria-label="Reference library"
            aria-pressed={surface.pathname === '/references'}
            title="Reference library"
            onClick={studio.navigate.goToReferences}
          >
            <FolderOpen size={18} />
          </button>
          <button
            type="button"
            className={`icon-button studio-corner-icon ${surface.pathname === '/presets' ? 'active' : ''}`}
            aria-label="Saved presets"
            aria-pressed={surface.pathname === '/presets'}
            title="Saved presets"
            onClick={studio.navigate.goToPresets}
          >
            <Bookmark size={18} />
          </button>
        </nav>

        {!isGallery && (
          <button
            type="button"
            className="gallery-launcher surface-enter"
            aria-label="View your past creations here"
            onClick={studio.navigate.goToHistory}
          >
            View your past creations here
          </button>
        )}
      </div>

      <StudioPanels
        showCreateWorkspace={surface.showCreateWorkspace}
        showEditWorkspace={surface.showEditWorkspace}
        settingsOpen={settingsOpen}
        hasEditSource={surface.hasEditSource}
        focus={focus}
        onCloseSettings={() => {
          setSettingsOpen(false);
        }}
        onOpenPreview={setPreviewModal}
      />

      <StudioOverlays
        previewModal={previewModal}
        metadataImageId={search.metadata}
        onClosePreview={() => {
          setPreviewModal(null);
        }}
      />
    </div>
  );
}

/**
 * The root route renders the shell so every view shares the top bar, canvas frame,
 * panels, and overlays, while the addressed view swaps through the outlet.
 */
export function StudioShell() {
  const search = useSearch({ strict: false });
  const params = useParams({ strict: false });

  return (
    <StudioProvider focusedRunId={search.run} selectedProjectId={params.projectId}>
      <StudioLayout />
    </StudioProvider>
  );
}
