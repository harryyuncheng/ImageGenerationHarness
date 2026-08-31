import { Bookmark, Image as ImageIcon } from 'lucide-react';
import type { UploadAttachment } from '../../../shared/types/attachments.js';
import { supportsImageShape } from '../capabilities.js';
import { aspectRatios, outputCounts } from '../settings.js';
import { CapabilitySettings } from './CapabilitySettings.js';
import {
  ComposerSettingOptions,
  ComposerSettingPicker,
  type ComposerSettingGroupProps,
} from './ComposerSettingPicker.js';
import { MaskChip } from './MaskChip.js';
import { OutputSettings } from './OutputSettings.js';

interface ComposerToolsProps extends ComposerSettingGroupProps {
  maskSource: UploadAttachment | undefined;
  hasMask: boolean;
  onMaskChange: (mask: UploadAttachment) => void;
  onSavePrompt: () => void;
}

export function ComposerTools({
  settings,
  settingMenu,
  onSettingMenuChange,
  maskSource,
  hasMask,
  onMaskChange,
  onSavePrompt,
}: ComposerToolsProps) {
  const capability = settings.selectedCapability;
  const current = settings.settings;

  return (
    <div className="composer-tools">
      <div className="toolbar-control-group" role="group" aria-label="Output setup">
        {supportsImageShape(capability) && (
          <ComposerSettingPicker
            menuId="image-dimensions-menu"
            label="Aspect ratio"
            menuLabel="Image dimensions"
            menuDescription="Choose the shape of generated images"
            value={current.aspectRatio}
            open={settingMenu === 'dimensions'}
            variant="dimensions"
            triggerContent={
              <>
                <span className="composer-setting-shape">
                  <span className={`ratio-shape ratio-${current.aspectRatio.replace(':', '-')}`} />
                </span>
                <span className="composer-setting-value">{current.aspectRatio}</span>
              </>
            }
            onOpenChange={(open) => {
              onSettingMenuChange('dimensions', open);
            }}
          >
            {(close) => (
              <ComposerSettingOptions
                label="Image dimensions"
                variant="dimensions"
                value={current.aspectRatio}
                options={aspectRatios.map((ratio) => ({
                  value: ratio.value,
                  label: ratio.value,
                  description: ratio.label,
                  preview: (
                    <span className={`ratio-shape ratio-${ratio.value.replace(':', '-')}`} />
                  ),
                }))}
                onSelect={(value) => {
                  settings.updateSettings('aspectRatio', value);
                  close();
                }}
              />
            )}
          </ComposerSettingPicker>
        )}
        <ComposerSettingPicker
          menuId="image-count-menu"
          label="Number of images"
          menuLabel="Image count"
          menuDescription="Choose how many variations to generate"
          value={String(current.outputCount)}
          open={settingMenu === 'count'}
          variant="count"
          triggerContent={
            <>
              <ImageIcon size={14} />
              <span className="composer-setting-value">{current.outputCount}</span>
            </>
          }
          onOpenChange={(open) => {
            onSettingMenuChange('count', open);
          }}
        >
          {(close) => (
            <ComposerSettingOptions
              label="Image count"
              variant="count"
              value={String(current.outputCount)}
              options={outputCounts.map((count) => ({
                value: String(count),
                label: String(count),
                description: count === 1 ? 'image' : 'images',
              }))}
              onSelect={(value) => {
                settings.updateSettings('outputCount', Number(value));
                close();
              }}
            />
          )}
        </ComposerSettingPicker>
      </div>
      <div className="toolbar-control-group" role="group" aria-label="Model settings">
        <MaskChip
          capability={capability}
          source={maskSource}
          hasMask={hasMask}
          onMaskChange={onMaskChange}
        />
        <CapabilitySettings
          settings={settings}
          settingMenu={settingMenu}
          onSettingMenuChange={onSettingMenuChange}
        />
        <OutputSettings
          settings={settings}
          settingMenu={settingMenu}
          onSettingMenuChange={onSettingMenuChange}
        />
      </div>
      <div className="toolbar-control-group" role="group" aria-label="Prompt resources">
        <button
          type="button"
          className="tool-chip"
          onClick={onSavePrompt}
          title="Save prompt"
          aria-label="Save"
        >
          <Bookmark size={16} />
          <span>Save</span>
        </button>
      </div>
    </div>
  );
}
