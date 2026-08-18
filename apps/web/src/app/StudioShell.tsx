import { Bookmark, FolderOpen } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Outlet, useParams, useRouterState, useSearch } from '@tanstack/react-router';
import { usesToolbarSettings } from '../features/generation/capabilities.js';
import { SettingsPanel } from '../features/generation/components/SettingsPanel.js';
import { AppSettings } from './AppSettings.js';
import { StudioOverlays } from './StudioOverlays.js';
import { StudioProvider, useStudio } from './studio-context.js';
import { TopBar } from './TopBar.js';
import { useGlobalShortcuts } from './use-global-shortcuts.js';

function StudioLayout() {
  const studio = useStudio();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [appSettingsOpen, setAppSettingsOpen] = useState(false);
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  const panelCapable = !usesToolbarSettings(studio.settings.selectedCapability);
  const showCreateWorkspace = pathname === '/';
  const showSettings = showCreateWorkspace && panelCapable && settingsOpen;
  const isGallery = pathname.startsWith('/gallery');

  // Selecting a toolbar-only tool retires the panel, so it must not reappear on the way back.
  useEffect(() => {
    if (!panelCapable) setSettingsOpen(false);
  }, [panelCapable]);

  useGlobalShortcuts({
    closeOverlays: () => {
      setAppSettingsOpen(false);
      studio.repository.setMenuOpen(false);
    },
    openSettings: () => {
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
          showSettingsButton={showCreateWorkspace && panelCapable}
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

      {showCreateWorkspace && panelCapable && (
        <SettingsPanel
          open={showSettings}
          capability={studio.settings.selectedCapability}
          settings={studio.settings.settings}
          updateSettings={studio.settings.updateSettings}
          onRandomSeed={studio.settings.chooseRandomSeed}
          onClose={() => {
            setSettingsOpen(false);
          }}
        />
      )}

      <StudioOverlays />
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
