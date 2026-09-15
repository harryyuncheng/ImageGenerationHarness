import { Download, RotateCcw } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { progressMessage } from '../../editor/components/ImageViewer.js';
import type { LoadedImage } from '../../editor/use-loaded-image.js';
import type { Capability, ProviderDescriptor } from '../../../shared/types/domain.js';
import { mainSourceImage, toolbarTabs } from '../model-presentation.js';
import type { AttachmentsController } from '../use-attachments.js';
import type { GenerationController } from '../use-generation.js';
import type { GenerationSettingsController } from '../use-generation-settings.js';
import type { PromptDraftController } from '../use-prompt-draft.js';
import { ImageInputs, ReferenceInputs } from './ImageInputs.js';
import type { ComposerSettingMenu } from './ComposerSettingPicker.js';
import { ComposerTools } from './ComposerTools.js';
import { PromptCanvas } from './PromptCanvas.js';
import { SubmitButton } from './SubmitButton.js';
import { ToolbarModelPicker } from './ToolbarModelPicker.js';
import { ToolbarTabs } from './ToolbarTabs.js';

interface CreateViewProps {
  promptDraft: PromptDraftController;
  settings: GenerationSettingsController;
  attachments: AttachmentsController;
  generation: GenerationController;
  feedback: ReactNode;
  capabilities: readonly Capability[];
  providers: readonly ProviderDescriptor[];
  loaded?: LoadedImage;
  onResetSettings: () => void;
  onSavePrompt: () => void;
}

export function CreateView({
  promptDraft,
  settings,
  attachments,
  generation,
  feedback,
  capabilities,
  providers,
  loaded,
  onResetSettings,
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
  const [draggingOutput, setDraggingOutput] = useState(false);
  const source = attachments.inputs.source;
  const showPreview =
    loaded !== undefined && (loaded.isPending || loaded.selectedOutput !== undefined);
  const showImages = mainSourceImage(attachments.inputs) !== undefined || showPreview;
  const downloadUrl = loaded?.selectedOutput?.url ?? source?.previewUrl;
  const downloadName = loaded?.selectedOutput?.name ?? source?.name;
  const imageStatus =
    generation.blockedReason ??
    loaded?.error ??
    (loaded && !loaded.selectedOutput && !loaded.isPending
      ? progressMessage(loaded.status, false)
      : undefined);

  useEffect(() => {
    lastToolByCategory.current[selectedCapability.category] = selectedCapability.canonicalId;
    setSettingMenu(null);
  }, [selectedCapability.canonicalId, selectedCapability.category, source?.id]);
  useEffect(() => {
    setDraggingOutput(false);
  }, [loaded?.selectedOutput?.imageId]);

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
    <div className="create-page">
      <form
        onSubmit={(event) => {
          void generation.generate(event);
        }}
        className={`prompt-workspace ${showImages ? 'prompt-workspace--loaded' : ''}`}
        inert={loaded?.isRestoringSetup}
        aria-busy={loaded?.isRestoringSetup}
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
              hasImages={showImages}
              onChange={promptDraft.setPrompt}
              onKeyDown={generation.handlePromptKeyDown}
            />
            {feedback}
            {imageStatus && (
              <p className="image-input-status" role="status">
                {imageStatus}
              </p>
            )}
          </div>
        </section>

        {showImages && (
          <ImageInputs
            attachments={attachments}
            capability={selectedCapability}
            loaded={loaded}
            onSourceImageReady={setMaskImage}
            onOutputDrag={setDraggingOutput}
          />
        )}

        <ReferenceInputs
          attachments={attachments}
          loaded={loaded}
          draggingOutput={draggingOutput}
          onOutputDrag={setDraggingOutput}
        />

        <div className="composer-dock">
          <div className="generation-toolbar" role="toolbar" aria-label="Generation toolbar">
            <button
              type="button"
              className="icon-button create-reset"
              onClick={onResetSettings}
              aria-label="Reset settings"
              title="Reset settings"
            >
              <RotateCcw size={18} aria-hidden="true" />
            </button>

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

                {activeTab.id === 'export' && downloadUrl && (
                  <div className="toolbar-control-group" role="group" aria-label="Export actions">
                    <a
                      className="tool-chip"
                      href={downloadUrl}
                      download={downloadName}
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
                blockedReason={generation.blockedReason}
                shortcut={generation.createShortcut}
                {...(loaded?.cancel ? { onCancel: loaded.cancel } : {})}
              />
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
