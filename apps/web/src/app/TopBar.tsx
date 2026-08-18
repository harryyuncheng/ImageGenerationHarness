import { SlidersHorizontal, X } from 'lucide-react';
import { useRouterState } from '@tanstack/react-router';
import { RepositoryPicker } from '../features/repository/components/RepositoryPicker.js';
import { useStudio } from './studio-context.js';

const libraryTitles: Record<string, string> = {
  '/gallery/history': 'Gallery',
  '/gallery/projects': 'Gallery',
  '/references': 'Reference library',
  '/presets': 'Saved presets',
};

export function TopBar({
  settingsOpen,
  showSettingsButton,
  onOpenSettings,
}: {
  settingsOpen: boolean;
  showSettingsButton: boolean;
  onOpenSettings: () => void;
}) {
  const studio = useStudio();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const openLibrary = pathname.startsWith('/gallery/projects/')
    ? 'Gallery'
    : libraryTitles[pathname];

  return (
    <header className="top-controls">
      <div className="top-bar-left">
        <RepositoryPicker repository={studio.repository} />
      </div>
      <div className="top-actions">
        {openLibrary ? (
          <button
            type="button"
            className="icon-button"
            onClick={studio.navigate.goToCreate}
            aria-label={`Close ${openLibrary}`}
          >
            <X size={18} />
          </button>
        ) : (
          showSettingsButton &&
          !settingsOpen && (
            <button
              type="button"
              className="icon-button"
              onClick={onOpenSettings}
              aria-label="Open advanced settings"
            >
              <SlidersHorizontal size={18} />
            </button>
          )
        )}
      </div>
    </header>
  );
}
