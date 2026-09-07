import { Download } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { progressMessage } from '../../editor/components/ImageViewer.js';
import type { LoadedImage } from '../../editor/use-loaded-image.js';
import type { Capability, ProviderDescriptor } from '../../../shared/types/domain.js';
import { mainImageInputs, toolbarTabs } from '../model-presentation.js';
import type { AttachmentsController } from '../use-attachments.js';
import type { DraftActionsController } from '../use-draft-actions.js';
import type { GenerationController } from '../use-generation.js';
import type { GenerationSettingsController } from '../use-generation-settings.js';
import type { PromptDraftController } from '../use-prompt-draft.js';
import { ImageInputs } from './ImageInputs.js';
import type { ComposerSettingMenu } from './ComposerSettingPicker.js';
import { ComposerTools } from './ComposerTools.js';
import { DestinationPill } from './DestinationPill.js';
import { PromptCanvas } from './PromptCanvas.js';
import { SubmitButton } from './SubmitButton.js';
import { ToolbarModelPicker } from './ToolbarModelPicker.js';
import { ToolbarTabs } from './ToolbarTabs.js';

interface CreateViewProps {
  promptDraft: PromptDraftController;
  settings: GenerationSettingsController;
  attachments: AttachmentsController;
  draftActions: DraftActionsController;
  generation: GenerationController;
  capabilities: readonly Capability[];
  providers: readonly ProviderDescriptor[];
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
  providers,
  loaded,
  destinationLabel,
  onSavePrompt,
}: CreateViewProps) {
  const selectedCapability = settings.selectedCapability;
  const availableCapabilities = capabilities.filter((capability) =>
    providers.some(
      (provider) => provider.providerId === capability.providerId && provider.configured,
    ),
  );
  const activeTab =
    toolbarTabs.find((tab) => tab.category === selectedCapability.category) ?? toolbarTabs[0];
  const visibleTools = capabilities.filter(
    (capability) => capability.category === activeTab.category,
  );
  const lastToolByCategory = useRef<Partial<Record<Capability['category'], string>>>({
    [selectedCapability.category]: selectedCapability.canonicalId,
  });
  const [settingMenu, setSettingMenu] = useState<ComposerSettingMenu>(null);
  const [maskImage, setMaskImage] = useState<HTMLImageElement | null>(null);
  const source = attachments.inputs.source;
  const referenceGeneration =
    selectedCapability.maxInputImages !== undefined && selectedCapability.category === 'generation';
  const showPreview =
    loaded?.selectedOutput !== undefined && (attachments.roles.length === 0 || referenceGeneration);
  const showImages = mainImageInputs(attachments.inputs).length > 0 || showPreview;
  const imageStatus =
    attachments.blockedReason ??
    (loaded &&
    (!loaded.selectedOutput || ['submitting', 'queued', 'running'].includes(loaded.status))
      ? progressMessage(loaded.status, false)
      : undefined);

  useEffect(() => {
    lastToolByCategory.current[selectedCapability.category] = selectedCapability.canonicalId;
    setSettingMenu(null);
  }, [selectedCapability.canonicalId, selectedCapability.category, source?.id]);

  function updateSettingMenu(menu: Exclude<ComposerSettingMenu, null>, open: boolean) {
    setSettingMenu((current) => (open ? menu : current === menu ? null : current));
  }

  function selectTool(targetId: string) {
    settings.updateSettings('targetId', targetId);
  }

  function selectTab(category: Capability['category']) {
    if (category === selectedCapability.category) return;
    const rememberedToolId = lastToolByCategory.current[category];
    const categoryTools = availableCapabilities.filter(
      (capability) => capability.category === category,
    );
    const nextTool =
      categoryTools.find((capability) => capability.canonicalId === rememberedToolId) ??
      categoryTools.find((capability) => capability.providerId === selectedCapability.providerId) ??
      categoryTools.at(0);
    if (nextTool) selectTool(nextTool.canonicalId);
  }

  return (
    <div className="create-page surface-enter">
      <form
        onSubmit={(event) => {
          void generation.generate(event);
        }}
        className={`prompt-workspace ${showImages ? 'prompt-workspace--loaded' : ''}`}
        onDragOver={(event) => {
          event.preventDefault();
        }}
        onDrop={attachments.handleDrop}
      >
        <section
          className="prompt-stage"
          aria-label="Prompt canvas"
          onClick={(event) => {
            if (event.target === event.currentTarget) promptDraft.focusPrompt();
          }}
        >
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
            {imageStatus && (
              <p className="image-input-status" role="status">
                {imageStatus}
              </p>
            )}
            {destinationLabel !== undefined && !showImages && (
              <DestinationPill label={destinationLabel} onReset={draftActions.resetDestination} />
            )}
          </div>
        </section>

        {showImages && (
          <ImageInputs
            attachments={attachments}
            capability={selectedCapability}
            loaded={loaded}
            destination={
              destinationLabel === undefined ? null : (
                <DestinationPill label={destinationLabel} onReset={draftActions.resetDestination} />
              )
            }
            onSourceImageReady={setMaskImage}
            onReset={draftActions.resetDraft}
          />
        )}

        <div className="generation-toolbar" role="toolbar" aria-label="Generation toolbar">
          <ToolbarTabs
            capabilities={availableCapabilities}
            activeCategory={activeTab.category}
            onSelect={selectTab}
          />

          <div className="generation-toolbar-controls">
            <div className="toolbar-tool-row">
              <ToolbarModelPicker
                capabilities={visibleTools}
                providers={providers}
                selectedCapability={selectedCapability}
                open={settingMenu === 'model'}
                onOpenChange={(open) => {
                  updateSettingMenu('model', open);
                }}
                onSelect={selectTool}
              />

              {activeTab.id === 'export' && source && (
                <div className="toolbar-control-group" role="group" aria-label="Export actions">
                  <a
                    className="tool-chip"
                    href={source.previewUrl}
                    download={source.name}
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
                attachments={attachments}
                maskImage={maskImage}
                onSavePrompt={onSavePrompt}
              />
            </div>

            <span className="toolbar-divider" aria-hidden="true" />
            <SubmitButton
              isSubmitting={generation.isSubmitting}
              blockedReason={attachments.blockedReason}
              {...(loaded?.cancel ? { onCancel: loaded.cancel } : {})}
            />
          </div>
        </div>
      </form>
    </div>
  );
}
