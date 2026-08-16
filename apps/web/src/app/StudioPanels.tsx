import { EditToolsPanel } from '../features/editor/components/EditToolsPanel.js';
import type { EditSourceController } from '../features/editor/use-edit-source.js';
import type { EditToolsController } from '../features/editor/use-edit-tools.js';
import { SettingsPanel } from '../features/generation/components/SettingsPanel.js';
import type { GenerationSettingsController } from '../features/generation/use-generation-settings.js';
import type { StudioNavigation } from './use-studio-navigation.js';

interface StudioPanelsProps {
  navigation: StudioNavigation;
  settings: GenerationSettingsController;
  editTools: EditToolsController;
  editSource: EditSourceController;
}

export function StudioPanels({ navigation, settings, editTools, editSource }: StudioPanelsProps) {
  return (
    <>
      {navigation.showCreateWorkspace && (
        <SettingsPanel
          open={navigation.settingsOpen}
          capability={settings.selectedCapability}
          settings={settings.settings}
          updateSettings={settings.updateSettings}
          onRandomSeed={settings.chooseRandomSeed}
          onViewRequest={() => {
            navigation.setModal('request');
          }}
          onGetCode={() => {
            navigation.setModal('code');
          }}
          onClose={() => {
            navigation.setSettingsOpen(false);
          }}
        />
      )}
      {navigation.showEditWorkspace && (
        <EditToolsPanel
          selection={editTools.selection}
          hasImage={navigation.hasEditSource}
          {...(navigation.hasEditSource ? { onStart: editSource.startSelectedEdit } : {})}
        />
      )}
    </>
  );
}
