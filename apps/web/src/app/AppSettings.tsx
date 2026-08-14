import { Settings, X } from 'lucide-react';
import { useRef } from 'react';
import { ThemeSelector } from '../features/theme/components/ThemeSelector.js';
import type { ThemeController } from '../features/theme/use-theme.js';
import { ShortcutList } from '../shared/components/ShortcutList.js';
import { useOutsidePointerDown } from '../shared/hooks/use-outside-pointer-down.js';

const popoverId = 'app-settings-popover';

export function AppSettings({
  open,
  sidebarOpen,
  theme,
  onOpenChange,
}: {
  open: boolean;
  sidebarOpen: boolean;
  theme: ThemeController;
  onOpenChange: (open: boolean) => void;
}) {
  const anchorRef = useRef<HTMLDivElement>(null);

  useOutsidePointerDown(anchorRef, open, () => {
    onOpenChange(false);
  });

  return (
    <div ref={anchorRef} className={`app-settings ${sidebarOpen ? '' : 'app-settings--collapsed'}`}>
      <button
        type="button"
        className="app-settings__trigger"
        aria-label="Settings"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? popoverId : undefined}
        onClick={() => {
          onOpenChange(!open);
        }}
      >
        <Settings size={18} />
        <span>Settings</span>
      </button>

      {open && (
        <section
          id={popoverId}
          className="popover settings-popover surface-enter"
          role="dialog"
          aria-label="Settings"
        >
          <header className="settings-popover__header">
            <div>
              <Settings size={18} />
              <h2>Settings</h2>
            </div>
            <button
              type="button"
              className="icon-button"
              onClick={() => {
                onOpenChange(false);
              }}
              aria-label="Close settings"
            >
              <X size={17} />
            </button>
          </header>

          <div className="settings-popover__body">
            <section className="settings-popover__section" aria-labelledby="appearance-heading">
              <h3 id="appearance-heading">Appearance</h3>
              <span className="settings-popover__label">Theme</span>
              <ThemeSelector
                theme={theme.theme}
                selectedThemeIndex={theme.selectedThemeIndex}
                onSelect={theme.changeTheme}
              />
            </section>

            <section className="settings-popover__section" aria-labelledby="shortcuts-heading">
              <h3 id="shortcuts-heading">Help &amp; shortcuts</h3>
              <ShortcutList />
            </section>
          </div>
        </section>
      )}
    </div>
  );
}
