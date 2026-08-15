import { Keyboard, Palette, Settings, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { ThemeSelector } from '../features/theme/components/ThemeSelector.js';
import type { ThemeController } from '../features/theme/use-theme.js';
import { ShortcutList } from '../shared/components/ShortcutList.js';

const dialogId = 'app-settings-dialog';
const settingsTabs = [
  { id: 'appearance', label: 'Appearance', Icon: Palette },
  { id: 'shortcuts', label: 'Keyboard', Icon: Keyboard },
] as const;
type SettingsTab = (typeof settingsTabs)[number]['id'];

const focusableSelector = [
  'button:not([disabled]):not([tabindex="-1"])',
  'a[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

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
  const [activeTab, setActiveTab] = useState<SettingsTab>('appearance');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusFrame = window.requestAnimationFrame(() => {
      dialogRef.current
        ?.querySelector<HTMLButtonElement>('[role="tab"][aria-selected="true"]')
        ?.focus({ preventScroll: true });
    });

    return () => {
      window.cancelAnimationFrame(focusFrame);
      if (previouslyFocused?.isConnected) previouslyFocused.focus({ preventScroll: true });
    };
  }, [open]);

  function moveTabFocus(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (!['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft', 'Home', 'End'].includes(event.key)) {
      return;
    }

    event.preventDefault();
    const currentIndex = settingsTabs.findIndex(({ id }) => id === activeTab);
    let nextIndex = currentIndex;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = settingsTabs.length - 1;
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      nextIndex = (currentIndex + 1) % settingsTabs.length;
    }
    if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      nextIndex = (currentIndex - 1 + settingsTabs.length) % settingsTabs.length;
    }

    const nextTab = settingsTabs[nextIndex];
    if (!nextTab) return;
    setActiveTab(nextTab.id);
    event.currentTarget.querySelector<HTMLButtonElement>(`#${dialogId}-${nextTab.id}-tab`)?.focus();
  }

  function trapDialogFocus(event: ReactKeyboardEvent<HTMLElement>) {
    if (event.key !== 'Tab') return;
    const focusableElements = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(focusableSelector),
    );
    const firstElement = focusableElements.at(0);
    const lastElement = focusableElements.at(-1);
    if (!firstElement || !lastElement) return;

    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
    } else if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  }

  return (
    <div className={`app-settings ${sidebarOpen ? '' : 'app-settings--collapsed'}`}>
      <button
        ref={triggerRef}
        type="button"
        className="app-settings__trigger"
        aria-label="Settings"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? dialogId : undefined}
        onClick={() => {
          onOpenChange(!open);
        }}
      >
        <Settings size={18} />
        <span>Settings</span>
      </button>

      {open &&
        createPortal(
          <div
            className="settings-dialog-backdrop surface-enter"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) onOpenChange(false);
            }}
          >
            <section
              ref={dialogRef}
              id={dialogId}
              className="settings-dialog surface-enter"
              role="dialog"
              aria-modal="true"
              aria-labelledby={`${dialogId}-title`}
              onKeyDown={trapDialogFocus}
            >
              <header className="settings-dialog__header">
                <div>
                  <Settings size={18} aria-hidden="true" />
                  <h2 id={`${dialogId}-title`}>Settings</h2>
                </div>
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => {
                    onOpenChange(false);
                  }}
                  aria-label="Close settings"
                >
                  <X size={18} />
                </button>
              </header>

              <div className="settings-dialog__body">
                <div
                  className="settings-dialog__tabs"
                  role="tablist"
                  aria-label="Settings sections"
                  onKeyDown={moveTabFocus}
                >
                  {settingsTabs.map(({ id, label, Icon }) => (
                    <button
                      key={id}
                      id={`${dialogId}-${id}-tab`}
                      type="button"
                      role="tab"
                      aria-selected={activeTab === id}
                      aria-controls={`${dialogId}-${id}-panel`}
                      tabIndex={activeTab === id ? 0 : -1}
                      onClick={() => {
                        setActiveTab(id);
                      }}
                    >
                      <Icon size={17} aria-hidden="true" />
                      <span>{label}</span>
                    </button>
                  ))}
                  <p>Preferences are saved on this device.</p>
                </div>

                <div className="settings-dialog__content">
                  {activeTab === 'appearance' ? (
                    <section
                      id={`${dialogId}-appearance-panel`}
                      className="settings-tab-panel"
                      role="tabpanel"
                      aria-labelledby={`${dialogId}-appearance-tab`}
                    >
                      <header className="settings-tab-panel__header">
                        <h3>Appearance</h3>
                        <p>Personalize how Baroque looks on this device.</p>
                      </header>

                      <div className="settings-card">
                        <div className="settings-card__heading">
                          <h4>Theme</h4>
                          <p>Use your system setting or choose a theme.</p>
                        </div>
                        <ThemeSelector
                          theme={theme.theme}
                          selectedThemeIndex={theme.selectedThemeIndex}
                          onSelect={theme.changeTheme}
                        />
                      </div>
                    </section>
                  ) : (
                    <section
                      id={`${dialogId}-shortcuts-panel`}
                      className="settings-tab-panel"
                      role="tabpanel"
                      aria-labelledby={`${dialogId}-shortcuts-tab`}
                    >
                      <header className="settings-tab-panel__header">
                        <h3>Keyboard shortcuts</h3>
                        <p>Navigate the studio and create without leaving the keyboard.</p>
                      </header>

                      <div className="settings-card settings-card--shortcuts">
                        <ShortcutList />
                      </div>
                    </section>
                  )}
                </div>
              </div>
            </section>
          </div>,
          document.body,
        )}
    </div>
  );
}
