import { Bookmark, FolderOpen } from 'lucide-react';
import { useState } from 'react';
import { Outlet, useParams, useRouterState, useSearch } from '@tanstack/react-router';
import { SettingsPanel } from '../features/generation/components/SettingsPanel.js';
import { AppSettings } from './AppSettings.js';
import { StudioOverlays } from './StudioOverlays.js';
import { StudioProvider, useStudio } from './studio-context.js';
import { TopBar } from './TopBar.js';
import { useGlobalShortcuts } from './use-global-shortcuts.js';

export type PreviewModal = 'code' | 'request' | null;

function StudioLayout() {
  const studio = useStudio();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [previewModal, setPreviewModal] = useState<PreviewModal>(null);
  const [appSettingsOpen, setAppSettingsOpen] = useState(false);
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  const showCreateWorkspace = pathname === '/';
  const showSettings = showCreateWorkspace && settingsOpen;
  const isGallery = pathname.startsWith('/gallery');

  useGlobalShortcuts({
    closeOverlays: () => {
      setPreviewModal(null);
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

  return (
    <div
      className={`studio-shell ${showCreateWorkspace ? 'studio-shell--panel-capable' : ''} ${showSettings ? 'studio-shell--panel-open' : ''}`}
    >
      <AppSettings open={appSettingsOpen} onOpenChange={setAppSettingsOpen} />

      <div className={`studio-main ${showCreateWorkspace ? 'studio-main--create' : ''}`}>
        <TopBar
          settingsOpen={settingsOpen}
          showCreateWorkspace={showCreateWorkspace}
          onOpenSettings={() => {
            setSettingsOpen(true);
          }}
        />

        <div className="workspace">
          <main className="canvas">
            <Outlet />
          </main>
        </div>

        <nav className="library-shortcuts" aria-label="Library shortcuts">
          <button
            type="button"
            className={`icon-button studio-corner-icon ${pathname === '/references' ? 'active' : ''}`}
            aria-label="Reference library"
            aria-pressed={pathname === '/references'}
            title="Reference library"
            onClick={studio.navigate.goToReferences}
          >
            <FolderOpen size={18} />
          </button>
          <button
            type="button"
            className={`icon-button studio-corner-icon ${pathname === '/presets' ? 'active' : ''}`}
            aria-label="Saved presets"
            aria-pressed={pathname === '/presets'}
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
            aria-label="View your past creations"
            onClick={studio.navigate.goToHistory}
          >
            View your past creations
          </button>
        )}
      </div>

      {showCreateWorkspace && (
        <SettingsPanel
          open={settingsOpen}
          capability={studio.settings.selectedCapability}
          settings={studio.settings.settings}
          updateSettings={studio.settings.updateSettings}
          onRandomSeed={studio.settings.chooseRandomSeed}
          onViewRequest={() => {
            setPreviewModal('request');
          }}
          onGetCode={() => {
            setPreviewModal('code');
          }}
          onClose={() => {
            setSettingsOpen(false);
          }}
        />
      )}

      <StudioOverlays
        previewModal={previewModal}
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
    <StudioProvider
      focusedImageId={search.image}
      focusedRunId={search.run}
      selectedProjectId={params.projectId}
    >
      <StudioLayout />
    </StudioProvider>
  );
}
