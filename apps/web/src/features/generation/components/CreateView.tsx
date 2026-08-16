import { ChevronDown, FolderTree, RefreshCw, Upload, WandSparkles, X } from 'lucide-react';
import { useState } from 'react';
import type { Capability } from '../../../shared/types/domain.js';
import { capabilityLabel } from '../capabilities.js';
import { categoryMeta, shortModelName } from '../model-presentation.js';
import type { AttachmentsController } from '../use-attachments.js';
import type { DraftActionsController } from '../use-draft-actions.js';
import type { GenerationController } from '../use-generation.js';
import type { GenerationSettingsController } from '../use-generation-settings.js';
import type { PromptDraftController } from '../use-prompt-draft.js';
import { AttachmentStrip } from './AttachmentStrip.js';
import { ComposerTools, type ComposerSettingMenu } from './ComposerTools.js';
import { ModelMenu } from './ModelMenu.js';
import { MovableToolbar } from './MovableToolbar.js';
import { PromptCanvas } from './PromptCanvas.js';

interface CreateViewProps {
  promptDraft: PromptDraftController;
  settings: GenerationSettingsController;
  attachments: AttachmentsController;
  draftActions: DraftActionsController;
  generation: GenerationController;
  capabilities: readonly Capability[];
  destinationLabel?: string;
  onOpenLibrary: () => void;
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
  onOpenLibrary,
  onSavePrompt,
}: CreateViewProps) {
  const selectedCapability = settings.selectedCapability;
  const ModelIcon = categoryMeta[selectedCapability.category].Icon;
  const [settingMenu, setSettingMenu] = useState<ComposerSettingMenu>(null);

  function updateSettingMenu(menu: 'dimensions' | 'count', open: boolean) {
    if (open && draftActions.modelMenuOpen) draftActions.closeModelMenu();
    setSettingMenu((current) => (open ? menu : current === menu ? null : current));
  }

  function closeToolbarMenus() {
    setSettingMenu(null);
    if (draftActions.modelMenuOpen) draftActions.closeModelMenu();
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
          <div className="model-picker-wrap">
            <button
              type="button"
              className="model-picker"
              aria-label={`Tool: ${capabilityLabel(selectedCapability)}`}
              onClick={() => {
                setSettingMenu(null);
                draftActions.toggleModelMenu();
              }}
            >
              <span className={`model-glyph model-glyph--${selectedCapability.category}`}>
                <ModelIcon size={15} />
              </span>
              <span className="model-picker-copy">
                <strong>{shortModelName(capabilityLabel(selectedCapability))}</strong>
              </span>
              <ChevronDown className="model-picker-chevron" size={14} />
            </button>
            {draftActions.modelMenuOpen && (
              <ModelMenu
                capabilities={capabilities}
                selectedId={selectedCapability.canonicalId}
                onSelect={draftActions.selectModel}
              />
            )}
          </div>

          <span className="toolbar-divider" aria-hidden="true" />
          <ComposerTools
            settings={settings}
            fileInput={attachments.fileInput}
            settingMenu={settingMenu}
            onSettingMenuChange={updateSettingMenu}
            onOpenLibrary={onOpenLibrary}
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
        </MovableToolbar>
      </form>
    </div>
  );
}
