import { EditToolsPanel } from '../features/editor/components/EditToolsPanel.js';
import type { EditorFocus } from '../features/editor/use-editor-focus.js';
import { SettingsPanel } from '../features/generation/components/SettingsPanel.js';
import type { PreviewModal } from './StudioShell.js';
import { useStudio } from './studio-context.js';

interface StudioPanelsProps {
  showCreateWorkspace: boolean;
  showEditWorkspace: boolean;
  settingsOpen: boolean;
  hasEditSource: boolean;
  focus: EditorFocus | undefined;
  onCloseSettings: () => void;
  onOpenPreview: (modal: PreviewModal) => void;
}

export function StudioPanels({
  showCreateWorkspace,
  showEditWorkspace,
  settingsOpen,
  hasEditSource,
  focus,
  onCloseSettings,
  onOpenPreview,
}: StudioPanelsProps) {
  const studio = useStudio();

  return (
    <>
      {showCreateWorkspace && (
        <SettingsPanel
          open={settingsOpen}
          capability={studio.settings.selectedCapability}
          settings={studio.settings.settings}
          updateSettings={studio.settings.updateSettings}
          onRandomSeed={studio.settings.chooseRandomSeed}
          onViewRequest={() => {
            onOpenPreview('request');
          }}
          onGetCode={() => {
            onOpenPreview('code');
          }}
          onClose={onCloseSettings}
        />
      )}
      {showEditWorkspace && (
        <EditToolsPanel
          selection={studio.editTools.selection}
          hasImage={hasEditSource}
          {...(hasEditSource
            ? {
                onStart: () => {
                  studio.editSource.startSelectedEdit(focus);
                },
              }
            : {})}
        />
      )}
    </>
  );
}
