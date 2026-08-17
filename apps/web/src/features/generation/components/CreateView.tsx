import { FolderTree, RefreshCw, Upload, WandSparkles, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { Capability } from '../../../shared/types/domain.js';
import { toolbarTabs } from '../model-presentation.js';
import type { AttachmentsController } from '../use-attachments.js';
import type { DraftActionsController } from '../use-draft-actions.js';
import type { GenerationController } from '../use-generation.js';
import type { GenerationSettingsController } from '../use-generation-settings.js';
import type { PromptDraftController } from '../use-prompt-draft.js';
import { AttachmentStrip } from './AttachmentStrip.js';
import { ComposerTools, type ComposerSettingMenu } from './ComposerTools.js';
import { MovableToolbar } from './MovableToolbar.js';
import { PromptCanvas } from './PromptCanvas.js';
import { ToolbarToolButton } from './ToolbarToolButton.js';

interface CreateViewProps {
  promptDraft: PromptDraftController;
  settings: GenerationSettingsController;
  attachments: AttachmentsController;
  draftActions: DraftActionsController;
  generation: GenerationController;
  capabilities: readonly Capability[];
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

  useEffect(() => {
    lastToolByCategory.current[selectedCapability.category] = selectedCapability.canonicalId;
  }, [selectedCapability.canonicalId, selectedCapability.category]);

  function updateSettingMenu(menu: Exclude<ComposerSettingMenu, null>, open: boolean) {
    setSettingMenu((current) => (open ? menu : current === menu ? null : current));
  }

  function closeToolbarMenus() {
    setSettingMenu(null);
  }

  function selectTool(capability: Capability) {
    closeToolbarMenus();
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
        className="prompt-workspace"
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
              onChange={promptDraft.setPrompt}
              onKeyDown={generation.handlePromptKeyDown}
            />
            {attachments.attachments.length > 0 && (
              <AttachmentStrip
                attachments={attachments.attachments}
                capability={selectedCapability}
                onRemove={attachments.removeAttachment}
              />
            )}
            {destinationLabel !== undefined && (
              <button
                type="button"
                className="destination-pill"
                onClick={draftActions.resetDestination}
                title="Save to the main repository instead"
                aria-label={`Saving to ${destinationLabel}. Save to the main repository instead.`}
              >
                <FolderTree size={14} aria-hidden="true" />
                <span>Saving to {destinationLabel}</span>
                <X size={14} aria-hidden="true" />
              </button>
            )}
          </div>
        </section>

        <MovableToolbar onMoveStart={closeToolbarMenus}>
          <div className="toolbar-tab-row">
            <div className="toolbar-tabs" role="group" aria-label="Workflow">
              {toolbarTabs.map((tab) => {
                const selected = tab.category === activeTab.category;
                const available = capabilities.some(
                  (capability) => capability.category === tab.category,
                );
                return (
                  <button
                    key={tab.id}
                    type="button"
                    className={`toolbar-tab ${selected ? 'selected' : ''}`}
                    aria-pressed={selected}
                    disabled={!available}
                    onClick={() => {
                      selectTab(tab.category);
                    }}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="toolbar-tool-row">
            <div
              className="toolbar-tool-options"
              role="group"
              aria-label={`${activeTab.label} tools`}
              style={{
                gridTemplateColumns: `repeat(${String(visibleTools.length)}, minmax(0, 1fr))`,
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

            <span className="toolbar-divider" aria-hidden="true" />
            <ComposerTools
              settings={settings}
              settingMenu={settingMenu}
              onSettingMenuChange={updateSettingMenu}
              onSavePrompt={onSavePrompt}
            />

            <span className="toolbar-divider" aria-hidden="true" />
            <button
              className="generate-button"
              type="submit"
              disabled={generation.isSubmitting}
              title="Generate (⌘ Enter)"
            >
              {generation.isSubmitting ? (
                <RefreshCw className="spin" size={18} />
              ) : (
                <WandSparkles size={17} />
              )}
              <span>Generate</span>
            </button>
          </div>
        </MovableToolbar>
      </form>
    </div>
  );
}
