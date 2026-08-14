import { ChevronDown, Cloud, Command, RefreshCw, Send, Upload } from 'lucide-react';
import { useState } from 'react';
import type { Capability } from '../../../shared/types/domain.js';
import { capabilityLabel, requiresPrompt, supportsPrompt } from '../capabilities.js';
import { categoryMeta, shortModelName } from '../model-presentation.js';
import type { AttachmentsController } from '../use-attachments.js';
import type { DraftActionsController } from '../use-draft-actions.js';
import type { GenerationController } from '../use-generation.js';
import type { GenerationSettingsController } from '../use-generation-settings.js';
import type { PromptDraftController } from '../use-prompt-draft.js';
import { AttachmentStrip } from './AttachmentStrip.js';
import { ComposerTools, type ComposerSettingMenu } from './ComposerTools.js';
import { CreateGreeting } from './CreateGreeting.js';
import { ModelMenu } from './ModelMenu.js';

interface CreateViewProps {
  promptDraft: PromptDraftController;
  settings: GenerationSettingsController;
  attachments: AttachmentsController;
  draftActions: DraftActionsController;
  generation: GenerationController;
  capabilities: readonly Capability[];
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

  return (
    <div className="create-page surface-enter">
      <CreateGreeting />

      <form
        onSubmit={(event) => {
          void generation.generate(event);
        }}
        className="composer-wrap"
      >
        <div className="composer-selectors">
          <div className="model-picker-wrap">
            <button
              type="button"
              className="model-picker"
              onClick={() => {
                setSettingMenu(null);
                draftActions.toggleModelMenu();
              }}
            >
              <span className={`model-glyph model-glyph--${selectedCapability.category}`}>
                <ModelIcon size={16} />
              </span>
              <span>
                <small>{categoryMeta[selectedCapability.category].label}</small>
                <strong>{shortModelName(capabilityLabel(selectedCapability))}</strong>
              </span>
              <ChevronDown size={16} />
            </button>
            {draftActions.modelMenuOpen && (
              <ModelMenu
                capabilities={capabilities}
                selectedId={selectedCapability.canonicalId}
                onSelect={draftActions.selectModel}
              />
            )}
          </div>
        </div>

        <div
          className={`composer ${attachments.dragActive ? 'composer--drag' : ''}`}
          onDragEnter={(event) => {
            event.preventDefault();
            attachments.setDragActive(true);
          }}
          onDragOver={(event) => {
            event.preventDefault();
          }}
          onDragLeave={() => {
            attachments.setDragActive(false);
          }}
          onDrop={attachments.handleDrop}
        >
          {attachments.dragActive && (
            <div className="drop-overlay">
              <Upload size={24} /> Drop images here
            </div>
          )}
          {attachments.attachments.length > 0 && (
            <AttachmentStrip
              attachments={attachments.attachments}
              capability={selectedCapability}
              onRemove={attachments.removeAttachment}
            />
          )}
          <textarea
            ref={promptDraft.promptInput}
            value={promptDraft.prompt}
            onChange={(event) => {
              promptDraft.setPrompt(event.target.value);
            }}
            onKeyDown={generation.handlePromptKeyDown}
            rows={4}
            maxLength={10_000}
            placeholder={
              supportsPrompt(selectedCapability)
                ? requiresPrompt(selectedCapability)
                  ? 'Describe the image you want to create…'
                  : 'Describe the desired result (optional)…'
                : 'This tool only needs a source image.'
            }
            aria-label="Image prompt"
          />
          <div className="composer-footer">
            <ComposerTools
              settings={settings}
              fileInput={attachments.fileInput}
              settingMenu={settingMenu}
              onSettingMenuChange={updateSettingMenu}
              onOpenLibrary={onOpenLibrary}
              onSavePrompt={onSavePrompt}
            />
            <div className="submit-area">
              <span className="key-hint">
                <Command size={12} /> Enter
              </span>
              <button className="generate-button" type="submit" disabled={generation.isSubmitting}>
                {generation.isSubmitting ? (
                  <RefreshCw className="spin" size={18} />
                ) : (
                  <Send size={18} />
                )}
                Generate
              </button>
            </div>
          </div>
        </div>
        <p className="composer-note">
          <Cloud size={13} /> Requests are queued privately through your local device. No
          information is ever retained from your requests or generations.
        </p>
      </form>
    </div>
  );
}
