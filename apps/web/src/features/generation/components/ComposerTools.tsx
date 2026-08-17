import { Bookmark, Image as ImageIcon } from 'lucide-react';
import { hasParameter } from '../capabilities.js';
import { aspectRatios, outputCounts } from '../settings.js';
import type { GenerationSettingsController } from '../use-generation-settings.js';
import { ComposerSettingPicker } from './ComposerSettingPicker.js';

export type ComposerSettingMenu = 'dimensions' | 'count' | null;

interface ComposerToolsProps {
  settings: GenerationSettingsController;
  settingMenu: ComposerSettingMenu;
  onSettingMenuChange: (menu: Exclude<ComposerSettingMenu, null>, open: boolean) => void;
  onSavePrompt: () => void;
}

export function ComposerTools({
  settings,
  settingMenu,
  onSettingMenuChange,
  onSavePrompt,
}: ComposerToolsProps) {
  return (
    <div className="composer-tools">
      <div className="toolbar-control-group" role="group" aria-label="Output setup">
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
