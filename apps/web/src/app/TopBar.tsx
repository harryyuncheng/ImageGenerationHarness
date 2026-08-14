import { Menu, PanelLeftClose, PanelLeftOpen, SlidersHorizontal } from 'lucide-react';
import { RepositoryPicker } from '../features/repository/components/RepositoryPicker.js';
import type { RepositoryController } from '../features/repository/use-repository.js';
import { ThemeMenu, ThemeMenuButton } from '../features/theme/components/ThemeMenu.js';
import type { ThemeController } from '../features/theme/use-theme.js';
import type { StudioNavigation } from './use-studio-navigation.js';

export function TopBar({
  navigation,
  repository,
  theme,
}: {
  navigation: StudioNavigation;
  repository: RepositoryController;
  theme: ThemeController;
}) {
  return (
    <header className="top-bar">
      <div className="top-bar-left">
        <button
          className="icon-button mobile-menu"
          onClick={() => {
            navigation.setMobileNavOpen(!navigation.mobileNavOpen);
          }}
          aria-label="Open navigation"
        >
          <Menu size={20} />
        </button>
        <button
          className="icon-button rail-collapse"
          onClick={() => {
            navigation.setSidebarOpen(!navigation.sidebarOpen);
          }}
          aria-label={navigation.sidebarOpen ? 'Collapse navigation' : 'Expand navigation'}
        >
          {navigation.sidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
        </button>
      </div>
      <div className="top-actions">
        <RepositoryPicker repository={repository} />
        <div className="popover-anchor">
          <ThemeMenuButton
            theme={theme.theme}
            onToggle={() => {
              theme.setMenuOpen(!theme.menuOpen);
            }}
          />
          {theme.menuOpen && (
            <ThemeMenu
              theme={theme.theme}
              selectedThemeIndex={theme.selectedThemeIndex}
              onSelect={theme.changeTheme}
            />
          )}
        </div>
        {navigation.showCreateWorkspace && !navigation.settingsOpen && (
          <button
            className="icon-button"
            onClick={() => {
              navigation.setSettingsOpen(true);
            }}
            aria-label="Open advanced settings"
          >
            <SlidersHorizontal size={18} />
          </button>
        )}
      </div>
    </header>
  );
}
