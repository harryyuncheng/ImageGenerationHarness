import { Settings, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import {
  SETTINGS_DIALOG_ID as dialogId,
  SettingsPanels,
  settingsTabs,
  type SettingsTab,
} from './SettingsPanels.js';
import { useStudioShell } from './studio-context.js';

const focusableSelector = [
  'button:not([disabled]):not([tabindex="-1"])',
  'a[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function AppSettings() {
  const { settingsTab, setSettingsTab } = useStudioShell();

  return (
    <div className="app-settings">
      <button
        type="button"
        className="icon-button studio-corner-icon app-settings__trigger"
        aria-label="Settings"
        aria-haspopup="dialog"
        aria-expanded={settingsTab !== null}
        aria-controls={settingsTab ? dialogId : undefined}
        title="Settings"
        onClick={() => {
          setSettingsTab(settingsTab ? null : 'repository');
        }}
      >
        <Settings size={18} />
      </button>

      {settingsTab &&
        createPortal(
          <SettingsDialog activeTab={settingsTab} onTabChange={setSettingsTab} />,
          document.body,
        )}
    </div>
  );
}

function SettingsDialog({
  activeTab,
  onTabChange,
}: {
  activeTab: SettingsTab;
  onTabChange: (tab: SettingsTab | null) => void;
}) {
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
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
  }, []);

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
    onTabChange(nextTab.id);
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
    <div
      className="settings-dialog-backdrop surface-enter"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onTabChange(null);
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
              onTabChange(null);
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
                  onTabChange(id);
                }}
              >
                <Icon size={17} aria-hidden="true" />
                <span>{label}</span>
              </button>
            ))}
            <p>Preferences are saved on this device.</p>
          </div>

          <div className="settings-dialog__content">
            <SettingsPanels activeTab={activeTab} />
          </div>
        </div>
      </section>
    </div>
  );
}
