import { X } from 'lucide-react';
import { useRouterState } from '@tanstack/react-router';
import { useStudio } from './studio-context.js';

const libraryTitles: Record<string, string> = {
  '/gallery/history': 'Gallery',
  '/gallery/projects': 'Gallery',
  '/presets': 'Saved presets',
};

export function TopBar() {
  const studio = useStudio();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const openLibrary = pathname.startsWith('/gallery/projects/')
    ? 'Gallery'
    : libraryTitles[pathname];

  return (
    <header className="top-controls">
      <div className="top-actions">
        {openLibrary && (
          <button
            type="button"
            className="icon-button"
            onClick={studio.navigate.goToCreate}
            aria-label={`Close ${openLibrary}`}
          >
            <X size={18} />
          </button>
        )}
      </div>
    </header>
  );
}
