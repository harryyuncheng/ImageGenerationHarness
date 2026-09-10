import { Check, HardDrive, Keyboard, Palette } from 'lucide-react';
import type { ReactNode } from 'react';
import { RepositorySelector } from '../features/repository/components/RepositorySelector.js';
import { ThemeSelector } from '../features/theme/components/ThemeSelector.js';
import { fontOptions } from '../features/theme/theme.js';
import { ShortcutList } from '../shared/components/ShortcutList.js';
import { useStudio, useStudioShell } from './studio-context.js';

export const SETTINGS_DIALOG_ID = 'app-settings-dialog';
export const settingsTabs = [
  { id: 'repository', label: 'Repository', Icon: HardDrive },
  { id: 'appearance', label: 'Appearance', Icon: Palette },
  { id: 'shortcuts', label: 'Shortcuts', Icon: Keyboard },
] as const;
export type SettingsTab = (typeof settingsTabs)[number]['id'];

function SettingsPanel({
  id,
  title,
  description,
  children,
}: {
  id: SettingsTab;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={`${SETTINGS_DIALOG_ID}-${id}-panel`}
      className="settings-tab-panel"
      role="tabpanel"
      aria-labelledby={`${SETTINGS_DIALOG_ID}-${id}-tab`}
    >
      <header className="settings-tab-panel__header">
        <h3>{title}</h3>
        {description && <p>{description}</p>}
      </header>
      {children}
    </section>
  );
}

export function SettingsPanels({ activeTab }: { activeTab: SettingsTab }) {
  const { theme, shortcuts, dialogs } = useStudioShell();
  const { repository } = useStudio();

  if (activeTab === 'repository') {
    return (
      <SettingsPanel
        id="repository"
        title="Image repository"
        description="Point Constable at the local folder that holds your work."
      >
        <div className="settings-card">
          <div className="settings-card__heading">
            <h4>Active folder</h4>
            <p>
              Images, style guides, and history live inside this folder, so it travels with you.
              Queued work stays with the folder that started it.
            </p>
          </div>
          <RepositorySelector repository={repository} />
        </div>
      </SettingsPanel>
    );
  }

  if (activeTab === 'appearance') {
    return (
      <SettingsPanel
        id="appearance"
        title="Appearance"
        description="Personalize how Constable looks on this device."
      >
        <div className="settings-card">
          <div className="settings-card__heading">
            <h4>Theme</h4>
            <p>Use your system setting or choose a theme.</p>
          </div>
          <ThemeSelector theme={theme.theme} onSelect={theme.changeTheme} />
        </div>
        <div className="settings-card">
          <div className="settings-card__heading">
            <h4>Font</h4>
          </div>
          <div className="font-selector" role="group" aria-label="Font">
            {fontOptions.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                className={`appearance-tile font-tile ${theme.font === value ? 'selected' : ''}`}
                data-font={value}
                aria-pressed={theme.font === value}
                onClick={() => {
                  theme.changeFont(value);
                }}
              >
                <span className="font-tile__preview" aria-hidden="true">
                  Aa
                  {theme.font === value && <Check className="appearance-tile__check" size={13} />}
                </span>
                <span className="appearance-tile__label">{label}</span>
              </button>
            ))}
          </div>
        </div>
      </SettingsPanel>
    );
  }

  return (
    <SettingsPanel id="shortcuts" title="Shortcuts">
      <ShortcutList shortcuts={shortcuts} confirm={dialogs.confirm} />
    </SettingsPanel>
  );
}
