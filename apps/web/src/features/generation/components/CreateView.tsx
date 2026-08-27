import { Download, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ImageViewer } from '../../editor/components/ImageViewer.js';
import type { LoadedImage } from '../../editor/use-loaded-image.js';
import type { Capability } from '../../../shared/types/domain.js';
import { toolbarTabs } from '../model-presentation.js';
import type { AttachmentsController } from '../use-attachments.js';
import type { DraftActionsController } from '../use-draft-actions.js';
import type { GenerationController } from '../use-generation.js';
import type { GenerationSettingsController } from '../use-generation-settings.js';
import type { PromptDraftController } from '../use-prompt-draft.js';
import { AttachmentStrip } from './AttachmentStrip.js';
import { ComposerTools, type ComposerSettingMenu } from './ComposerTools.js';
import { DestinationPill } from './DestinationPill.js';
import { PromptCanvas } from './PromptCanvas.js';
import { SubmitButton } from './SubmitButton.js';
import { ToolbarTabs } from './ToolbarTabs.js';
import { ToolbarToolButton } from './ToolbarToolButton.js';

interface CreateViewProps {
  promptDraft: PromptDraftController;
  settings: GenerationSettingsController;
  attachments: AttachmentsController;
  draftActions: DraftActionsController;
  generation: GenerationController;
  capabilities: readonly Capability[];
  loaded?: LoadedImage;
  destinationLabel?: string;
  onSavePrompt: () => void;
}

export function CreateView({
  promptDraft,
  settings,
  attachments,
  draftActions,
  generation,
  capabilities,
  loaded,
  destinationLabel,
  onSavePrompt,
}: CreateViewProps) {
  const selectedCapability = settings.selectedCapability;
  const activeTab =
    toolbarTabs.find((tab) => tab.category === selectedCapability.category) ?? toolbarTabs[0];
  const visibleTools = capabilities.filter(
    (capability) => capability.category === activeTab.category,
  );
  const lastToolByCategory = useRef<Partial<Record<Capability['category'], string>>>({
    [selectedCapability.category]: selectedCapability.canonicalId,
  });
  const [settingMenu, setSettingMenu] = useState<ComposerSettingMenu>(null);
  // Style guide images are represented by the fan and its modal, never in the composer strip.
  const uploads = attachments.attachments.filter((item) => item.source === 'upload');

  useEffect(() => {
    lastToolByCategory.current[selectedCapability.category] = selectedCapability.canonicalId;
    setSettingMenu(null);
  }, [selectedCapability.canonicalId, selectedCapability.category]);

  function updateSettingMenu(menu: Exclude<ComposerSettingMenu, null>, open: boolean) {
    setSettingMenu((current) => (open ? menu : current === menu ? null : current));
  }

  function selectTool(capability: Capability) {
    setSettingMenu(null);
    lastToolByCategory.current[capability.category] = capability.canonicalId;
    if (capability.canonicalId !== selectedCapability.canonicalId) {
      draftActions.selectTool(capability);
    }
  }

  function selectTab(category: Capability['category']) {
    if (category === selectedCapability.category) return;
    const rememberedToolId = lastToolByCategory.current[category];
    const nextTool =
      (rememberedToolId
        ? capabilities.find(
            (capability) =>
              capability.category === category && capability.canonicalId === rememberedToolId,
          )
        : undefined) ?? capabilities.find((capability) => capability.category === category);
    if (nextTool) selectTool(nextTool);
  }

  return (
    <div className="create-page surface-enter">
      <form
        onSubmit={(event) => {
          void generation.generate(event);
        }}
        className={`prompt-workspace ${loaded ? 'prompt-workspace--loaded' : ''}`}
        onDragEnter={(event) => {
          event.preventDefault();
          attachments.setDragActive(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
        }}
        onDragLeave={(event) => {
          if (
            event.relatedTarget instanceof Node &&
            event.currentTarget.contains(event.relatedTarget)
          ) {
            return;
          }
          attachments.setDragActive(false);
        }}
        onDrop={attachments.handleDrop}
      >
        <section
          className={`prompt-stage ${attachments.dragActive ? 'prompt-stage--drag' : ''}`}
          aria-label="Prompt canvas"
          onClick={(event) => {
            if (event.target === event.currentTarget) promptDraft.focusPrompt();
          }}
        >
          {attachments.dragActive && (
            <div className="prompt-drop-overlay">
              <Upload size={24} /> Drop images here
            </div>
          )}
          <div className="prompt-editor">
            <PromptCanvas
              capability={selectedCapability}
              inputRef={promptDraft.promptInput}
              value={promptDraft.prompt}
              negativePrompt={settings.settings.negativePrompt}
              onChange={promptDraft.setPrompt}
              onNegativePromptChange={(value) => {
                settings.updateSettings('negativePrompt', value);
              }}
              onKeyDown={generation.handlePromptKeyDown}
            />
            {uploads.length > 0 && (
              <AttachmentStrip
                attachments={uploads}
                capability={selectedCapability}
                onRemove={attachments.removeUpload}
              />
            )}
            {destinationLabel !== undefined && loaded === undefined && (
              <DestinationPill label={destinationLabel} onReset={draftActions.resetDestination} />
            )}
          </div>
        </section>

        {loaded && (
          <ImageViewer
            loaded={loaded}
            destination={
              destinationLabel === undefined ? null : (
                <DestinationPill label={destinationLabel} onReset={draftActions.resetDestination} />
              )
            }
            onReset={draftActions.resetDraft}
          />
        )}

        <div className="generation-toolbar" role="toolbar" aria-label="Generation toolbar">
          <div className="generation-toolbar-controls">
            <ToolbarTabs
              capabilities={capabilities}
              activeCategory={activeTab.category}
              onSelect={selectTab}
            />

            <div className="toolbar-tool-row">
              <div
                className="toolbar-tool-options"
                role="group"
                aria-label={`${activeTab.label} tools`}
                style={{
                  gridTemplateColumns: `repeat(${String(visibleTools.length)}, minmax(56px, 1fr))`,
                }}
              >
                {visibleTools.map((capability) => {
                  const selected = capability.canonicalId === selectedCapability.canonicalId;
                  return (
                    <ToolbarToolButton
                      key={capability.canonicalId}
                      capability={capability}
                      selected={selected}
                      onSelect={() => {
                        selectTool(capability);
                      }}
                    />
                  );
                })}
              </div>

              {activeTab.id === 'export' && loaded?.selectedOutput && (
                <div className="toolbar-control-group" role="group" aria-label="Export actions">
                  <a
                    className="tool-chip"
                    href={loaded.selectedOutput.url}
                    download={loaded.selectedOutput.name}
                    title="Download image"
                    aria-label="Download image"
                  >
                    <Download size={16} />
                    <span>Download</span>
                  </a>
                </div>
              )}

              <span className="toolbar-divider" aria-hidden="true" />
              <ComposerTools
                settings={settings}
                settingMenu={settingMenu}
                onSettingMenuChange={updateSettingMenu}
                onSavePrompt={onSavePrompt}
              />

              <span className="toolbar-divider" aria-hidden="true" />
              <SubmitButton
                isSubmitting={generation.isSubmitting}
                {...(loaded?.cancel ? { onCancel: loaded.cancel } : {})}
              />
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
