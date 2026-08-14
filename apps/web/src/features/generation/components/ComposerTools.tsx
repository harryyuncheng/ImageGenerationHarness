import { Bookmark, FolderOpen, Image as ImageIcon, ImagePlus } from 'lucide-react';
import type { RefObject } from 'react';
import { hasParameter } from '../capabilities.js';
import { aspectRatios, outputCounts } from '../settings.js';
import type { GenerationSettingsController } from '../use-generation-settings.js';
import { ComposerSettingPicker } from './ComposerSettingPicker.js';

export type ComposerSettingMenu = 'dimensions' | 'count' | null;

interface ComposerToolsProps {
  settings: GenerationSettingsController;
  fileInput: RefObject<HTMLInputElement | null>;
  settingMenu: ComposerSettingMenu;
  onSettingMenuChange: (menu: 'dimensions' | 'count', open: boolean) => void;
  onOpenLibrary: () => void;
  onSavePrompt: () => void;
}

/** Composer chips: source images, references, saved prompts, and image shape. */
export function ComposerTools({
  settings,
  fileInput,
  settingMenu,
  onSettingMenuChange,
  onOpenLibrary,
  onSavePrompt,
}: ComposerToolsProps) {
  return (
    <div className="composer-tools">
      <button
        type="button"
        className="round-tool"
        onClick={() => {
          fileInput.current?.click();
        }}
        title="Add images (⌘⇧O)"
      >
        <ImagePlus size={18} />
      </button>
      <button
        type="button"
        className="tool-chip"
        onClick={onOpenLibrary}
        title="Open reference library"
        aria-label="References"
      >
        <FolderOpen size={16} />
        <span>References</span>
      </button>
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
      {hasParameter(settings.selectedCapability, 'aspect_ratio') && (
        <ComposerSettingPicker
          menuId="image-dimensions-menu"
          label="Aspect ratio"
          menuLabel="Image dimensions"
          menuDescription="Choose the shape of generated images"
          value={settings.settings.aspectRatio}
          options={aspectRatios.map((ratio) => ({
            value: ratio.value,
            label: ratio.value,
            description: ratio.label,
            preview: <span className={`ratio-shape ratio-${ratio.value.replace(':', '-')}`} />,
          }))}
          open={settingMenu === 'dimensions'}
          variant="dimensions"
          triggerContent={
            <>
              <span
                className={`ratio-shape ratio-${settings.settings.aspectRatio.replace(':', '-')}`}
              />
              <span className="composer-setting-value">{settings.settings.aspectRatio}</span>
            </>
          }
          onOpenChange={(open) => {
            onSettingMenuChange('dimensions', open);
          }}
          onSelect={(value) => {
            settings.updateSettings('aspectRatio', value);
          }}
        />
      )}
      <ComposerSettingPicker
        menuId="image-count-menu"
        label="Number of images"
        menuLabel="Image count"
        menuDescription="Choose how many variations to generate"
        value={String(settings.settings.outputCount)}
        options={outputCounts.map((count) => ({
          value: String(count),
          label: String(count),
          description: count === 1 ? 'image' : 'images',
          preview: <span className="image-count-preview">{count}</span>,
        }))}
        open={settingMenu === 'count'}
        variant="count"
        triggerContent={
          <>
            <ImageIcon size={14} />
            <span className="composer-setting-value">{settings.settings.outputCount}</span>
          </>
        }
        onOpenChange={(open) => {
          onSettingMenuChange('count', open);
        }}
        onSelect={(value) => {
          settings.updateSettings('outputCount', Number(value));
        }}
      />
    </div>
  );
}
