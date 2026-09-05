import { HardDrive, Keyboard, Palette } from 'lucide-react';
import type { ReactNode } from 'react';
import { RepositorySelector } from '../features/repository/components/RepositorySelector.js';
import { ThemeSelector } from '../features/theme/components/ThemeSelector.js';
import { ShortcutList } from '../shared/components/ShortcutList.js';
import { useStudio, useStudioShell } from './studio-context.js';

export const SETTINGS_DIALOG_ID = 'app-settings-dialog';
export const settingsTabs = [
  { id: 'repository', label: 'Repository', Icon: HardDrive },
  { id: 'appearance', label: 'Appearance', Icon: Palette },
  { id: 'shortcuts', label: 'Keyboard', Icon: Keyboard },
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
  description: string;
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
        <p>{description}</p>
      </header>
      {children}
    </section>
  );
}

export function SettingsPanels({ activeTab }: { activeTab: SettingsTab }) {
  const { theme } = useStudioShell();
  const { repository } = useStudio();

  if (activeTab === 'repository') {
    return (
      <SettingsPanel
        id="repository"
        title="Image repository"
        description="Point Baroque at the local folder that holds your work."
      >
        <div className="settings-card">
          <div className="settings-card__heading">
            <h4>Active folder</h4>
            <p>
              Images, projects, style guides, and history live inside this folder, so it travels
              with you. Queued work stays with the folder that started it.
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
        description="Personalize how Baroque looks on this device."
      >
        <div className="settings-card">
          <div className="settings-card__heading">
            <h4>Theme</h4>
            <p>Use your system setting or choose a theme.</p>
          </div>
          <ThemeSelector theme={theme.theme} onSelect={theme.changeTheme} />
        </div>
      </SettingsPanel>
    );
  }

  return (
    <SettingsPanel
      id="shortcuts"
      title="Keyboard shortcuts"
      description="Navigate the studio and create without leaving the keyboard."
    >
      <div className="settings-card settings-card--shortcuts">
        <ShortcutList />
      </div>
    </SettingsPanel>
  );
}
