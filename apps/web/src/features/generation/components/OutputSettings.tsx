import { Dice5, FileImage } from 'lucide-react';
import { hasParameter, maximumSeed } from '../capabilities.js';
import { outputFormatDescriptions, outputFormats, seedStrategies } from '../settings.js';
import {
  ComposerSettingOptions,
  ComposerSettingPicker,
  type ComposerSettingGroupProps,
} from './ComposerSettingPicker.js';
import { SeedValueInput } from './SettingControls.js';

/** How each generated file is written: its format and the noise it starts from. */
export function OutputSettings({
  settings,
  settingMenu,
  onSettingMenuChange,
}: ComposerSettingGroupProps) {
  const capability = settings.selectedCapability;
  const current = settings.settings;
  const seedMaximum = maximumSeed(capability);

  return (
    <>
      {hasParameter(capability, 'output_format') && (
        <ComposerSettingPicker
          menuId="output-format-menu"
          label="Output format"
          menuLabel="Output format"
          menuDescription="Choose the file type written to the repository"
          value={current.outputFormat.toUpperCase()}
          open={settingMenu === 'format'}
          variant="format"
          triggerContent={
            <>
              <FileImage size={14} />
              <span className="composer-setting-value">{current.outputFormat.toUpperCase()}</span>
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
              value={current.outputFormat}
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
          value={current.seedMode === 'random' ? 'Random' : String(current.seed)}
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
                value={current.seedMode}
                options={seedStrategies}
                onSelect={(value) => {
                  settings.updateSettings('seedMode', value);
                }}
              />
              <SeedValueInput
                seed={current.seed}
                seedMaximum={seedMaximum}
                disabled={current.seedMode === 'random'}
                onChange={(value) => {
                  settings.updateSettings('seed', value);
                }}
                onRandomSeed={settings.chooseRandomSeed}
              />
            </>
          )}
        </ComposerSettingPicker>
      )}
    </>
  );
}
