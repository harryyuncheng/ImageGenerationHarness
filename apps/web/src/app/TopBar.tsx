import { SlidersHorizontal, X } from 'lucide-react';
import { RepositoryPicker } from '../features/repository/components/RepositoryPicker.js';
import type { RepositoryController } from '../features/repository/use-repository.js';
import type { StudioNavigation } from './use-studio-navigation.js';

export function TopBar({
  navigation,
  repository,
}: {
  navigation: StudioNavigation;
  repository: RepositoryController;
}) {
  const openLibrary = navigation.showsView('gallery')
    ? 'Gallery'
    : navigation.showsView('references')
      ? 'Reference library'
      : navigation.showsView('presets')
        ? 'Saved presets'
        : undefined;

  return (
    <header className="top-controls">
      <div className="top-bar-left">
        <RepositoryPicker repository={repository} />
      </div>
      <div className="top-actions">
        {openLibrary ? (
          <button
            type="button"
            className="icon-button"
            onClick={() => {
              navigation.selectStudioView('create');
            }}
            aria-label={`Close ${openLibrary}`}
          >
            <X size={18} />
          </button>
        ) : (
          navigation.showCreateWorkspace &&
          !navigation.settingsOpen && (
            <button
              type="button"
              className="icon-button"
              onClick={() => {
                navigation.setSettingsOpen(true);
              }}
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
