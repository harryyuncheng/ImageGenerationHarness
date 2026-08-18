import { Blend, Bookmark, Dice5, FileImage, Image as ImageIcon } from 'lucide-react';
import { hasParameter, maximumSeed, usesToolbarSettings } from '../capabilities.js';
import {
  aspectRatios,
  outputCounts,
  outputFormatDescriptions,
  outputFormats,
  seedStrategies,
} from '../settings.js';
import type { GenerationSettingsController } from '../use-generation-settings.js';
import { ComposerSettingOptions, ComposerSettingPicker } from './ComposerSettingPicker.js';
import { RangeSetting, SeedValueInput } from './SettingControls.js';

export type ComposerSettingMenu = 'count' | 'dimensions' | 'format' | 'seed' | 'strength' | null;

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
  const capability = settings.selectedCapability;
  const inlineSettings = usesToolbarSettings(capability);
  const seedMaximum = maximumSeed(capability);
  const supportsSourceImage = capability.modes.includes('image-to-image');

  return (
    <div className="composer-tools">
      <div className="toolbar-control-group" role="group" aria-label="Output setup">
        {hasParameter(capability, 'aspect_ratio') && (
          <ComposerSettingPicker
            menuId="image-dimensions-menu"
            label="Aspect ratio"
            menuLabel="Image dimensions"
            menuDescription="Choose the shape of generated images"
            value={settings.settings.aspectRatio}
            open={settingMenu === 'dimensions'}
            variant="dimensions"
            triggerContent={
              <>
                <span className="composer-setting-shape">
                  <span
                    className={`ratio-shape ratio-${settings.settings.aspectRatio.replace(':', '-')}`}
                  />
                </span>
                <span className="composer-setting-value">{settings.settings.aspectRatio}</span>
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
                value={settings.settings.aspectRatio}
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
          value={String(settings.settings.outputCount)}
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
        >
          {(close) => (
            <ComposerSettingOptions
              label="Image count"
              variant="count"
              value={String(settings.settings.outputCount)}
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
      {inlineSettings && (
        <div className="toolbar-control-group" role="group" aria-label="Model settings">
          <ComposerSettingPicker
            menuId="image-strength-menu"
            label="Image strength"
            menuLabel="Image strength"
            menuDescription={
              supportsSourceImage
                ? 'How far results may move from a source image'
                : `${capability.name} generates from text only`
            }
            value={settings.settings.strength.toFixed(2)}
            open={settingMenu === 'strength'}
            variant="strength"
            triggerContent={
              <>
                <Blend size={14} />
                <span className="composer-setting-value">
                  {settings.settings.strength.toFixed(2)}
                </span>
              </>
            }
            onOpenChange={(open) => {
              onSettingMenuChange('strength', open);
            }}
          >
            {() => (
              <RangeSetting
                label="Strength"
                value={settings.settings.strength}
                min={0}
                max={1}
                step={0.05}
                disabled={!supportsSourceImage}
                onChange={(value) => {
                  settings.updateSettings('strength', value);
                }}
              />
            )}
          </ComposerSettingPicker>
          {hasParameter(capability, 'output_format') && (
            <ComposerSettingPicker
              menuId="output-format-menu"
              label="Output format"
              menuLabel="Output format"
              menuDescription="Choose the file type written to the repository"
              value={settings.settings.outputFormat.toUpperCase()}
              open={settingMenu === 'format'}
              variant="format"
              triggerContent={
                <>
                  <FileImage size={14} />
                  <span className="composer-setting-value">
                    {settings.settings.outputFormat.toUpperCase()}
                  </span>
                </>
              }
              onOpenChange={(open) => {
                onSettingMenuChange('format', open);
              }}
            >
              {(close) => (
                <ComposerSettingOptions
                  label="Output format"
                  variant="format"
                  value={settings.settings.outputFormat}
                  options={outputFormats.map((format) => ({
                    value: format,
                    label: format.toUpperCase(),
                    description: capability.outputFormats.includes(format)
                      ? outputFormatDescriptions[format]
                      : `Not accepted by ${capability.name}`,
                    disabled: !capability.outputFormats.includes(format),
                  }))}
                  onSelect={(value) => {
                    settings.updateSettings('outputFormat', value);
                    close();
                  }}
                />
              )}
            </ComposerSettingPicker>
          )}
          {seedMaximum !== undefined && (
            <ComposerSettingPicker
              menuId="seed-strategy-menu"
              label="Seed"
              menuLabel="Seed"
              menuDescription="Control how each image picks its starting noise"
              value={
                settings.settings.seedMode === 'random' ? 'Random' : String(settings.settings.seed)
              }
              open={settingMenu === 'seed'}
              variant="seed"
              triggerContent={<Dice5 size={14} />}
              onOpenChange={(open) => {
                onSettingMenuChange('seed', open);
              }}
            >
              {() => (
                <>
                  <ComposerSettingOptions
                    label="Seed strategy"
                    variant="seed"
                    value={settings.settings.seedMode}
                    options={seedStrategies}
                    onSelect={(value) => {
                      settings.updateSettings('seedMode', value);
                    }}
                  />
                  <SeedValueInput
                    seed={settings.settings.seed}
                    seedMaximum={seedMaximum}
                    disabled={settings.settings.seedMode === 'random'}
                    onChange={(value) => {
                      settings.updateSettings('seed', value);
                    }}
                    onRandomSeed={settings.chooseRandomSeed}
                  />
                </>
              )}
            </ComposerSettingPicker>
          )}
        </div>
      )}
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
