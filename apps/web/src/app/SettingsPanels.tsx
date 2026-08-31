import { Keyboard, Palette, Plug } from 'lucide-react';
import type { ReactNode } from 'react';
import { defaultTargetForProvider } from '../features/generation/capabilities.js';
import { ProviderSelector } from '../features/generation/components/ProviderSelector.js';
import { ThemeSelector } from '../features/theme/components/ThemeSelector.js';
import { ShortcutList } from '../shared/components/ShortcutList.js';
import type { ProviderId } from '../shared/types/domain.js';
import { useStudio, useStudioShell } from './studio-context.js';

export const SETTINGS_DIALOG_ID = 'app-settings-dialog';
export const settingsTabs = [
  { id: 'appearance', label: 'Appearance', Icon: Palette },
  { id: 'provider', label: 'Provider', Icon: Plug },
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
  const { capabilities, providers, settings } = useStudio();

  function selectProvider(providerId: ProviderId) {
    const target = defaultTargetForProvider(capabilities, providerId);
    if (target) settings.updateSettings('targetId', target.canonicalId);
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
          <ThemeSelector
            theme={theme.theme}
            selectedThemeIndex={theme.selectedThemeIndex}
            onSelect={theme.changeTheme}
          />
        </div>
      </SettingsPanel>
    );
  }

  if (activeTab === 'provider') {
    return (
      <SettingsPanel
        id="provider"
        title="Provider"
        description="Choose which service generates new images."
      >
        <div className="settings-card">
          <div className="settings-card__heading">
            <h4>Image provider</h4>
            <p>The create toolbar shows the models of the provider you pick.</p>
          </div>
          <ProviderSelector
            providers={providers}
            activeProviderId={settings.selectedCapability.providerId}
            onSelect={selectProvider}
          />
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
