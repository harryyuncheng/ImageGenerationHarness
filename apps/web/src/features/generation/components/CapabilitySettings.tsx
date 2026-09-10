import { Brush, Crosshair, Gauge, Layers, Replace, ScanFace } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { RequestParameter } from '@harness/contracts';
import { hasParameter } from '../capabilities.js';
import { toolbarRangeSettings } from '../model-presentation.js';
import { stylePresets, type GenerationSettings } from '../settings.js';
import {
  ComposerSettingOptions,
  ComposerSettingPicker,
  type ComposerSettingGroupProps,
} from './ComposerSettingPicker.js';
import { OutpaintSettings } from './OutpaintSettings.js';
import { formatRangeValue, RangeSetting } from './SettingControls.js';

const textSettings = [
  {
    parameter: 'select_prompt',
    key: 'selectPrompt',
    label: 'Select object or area',
    placeholder: 'e.g. the red jacket',
    icon: Crosshair,
  },
  {
    parameter: 'search_prompt',
    key: 'searchPrompt',
    label: 'Object to replace',
    placeholder: 'e.g. the wooden chair',
    icon: Replace,
  },
] as const;

const choiceSettings = [
  {
    parameter: 'quality',
    key: 'quality',
    label: 'Quality',
    icon: Gauge,
    options: [
      { value: 'low', label: 'Low', description: 'Fastest and least expensive' },
      { value: 'medium', label: 'Medium', description: 'Balanced detail and cost' },
      { value: 'high', label: 'High', description: 'The most detail' },
    ],
  },
  {
    parameter: 'background',
    key: 'background',
    label: 'Background',
    icon: Layers,
    options: [
      { value: 'auto', label: 'Auto', description: 'Let the model decide' },
      { value: 'transparent', label: 'Transparent', description: 'Requires PNG output' },
    ],
  },
  {
    parameter: 'input_fidelity',
    key: 'inputFidelity',
    label: 'Input fidelity',
    icon: ScanFace,
    options: [
      { value: 'low', label: 'Low', description: 'Reinterpret freely' },
      { value: 'high', label: 'High', description: 'Preserve style and faces' },
    ],
  },
] as const satisfies readonly {
  parameter: RequestParameter;
  key: keyof GenerationSettings;
  label: string;
  icon: LucideIcon;
  options: readonly { value: string; label: string; description: string }[];
}[];

/** The chips a capability adds beyond the shape, count, format and seed every target shares. */
export function CapabilitySettings({
  settings,
  settingMenu,
  onSettingMenuChange,
}: ComposerSettingGroupProps) {
  const capability = settings.selectedCapability;
  const current = settings.settings;
  const stylePresetName =
    stylePresets.find(([value]) => value === current.stylePreset)?.[1] ?? 'None';

  return (
    <>
      {textSettings
        .filter((setting) => hasParameter(capability, setting.parameter))
        .map((setting) => {
          const Icon = setting.icon;
          const value = current[setting.key];
          return (
            <ComposerSettingPicker
              key={setting.key}
              menuId={`${setting.key}-menu`}
              label={setting.label}
              menuLabel={setting.label}
              value={value || 'Not set'}
              open={settingMenu === setting.key}
              variant="text"
              triggerContent={
                <>
                  <Icon size={14} />
                  <span className="composer-setting-value">{value || 'Not set'}</span>
                </>
              }
              onOpenChange={(open) => {
                onSettingMenuChange(setting.key, open);
              }}
            >
              {() => (
                <div className="composer-setting-field">
                  <input
                    value={value}
                    aria-label={setting.label}
                    placeholder={setting.placeholder}
                    onChange={(event) => {
                      settings.updateSettings(setting.key, event.target.value);
                    }}
                  />
                </div>
              )}
            </ComposerSettingPicker>
          );
        })}
      {choiceSettings
        .filter((setting) => hasParameter(capability, setting.parameter))
        .map((setting) => {
          const Icon = setting.icon;
          const value = current[setting.key];
          const selectedLabel =
            setting.options.find((option) => option.value === value)?.label ?? value;
          return (
            <ComposerSettingPicker
              key={setting.key}
              menuId={`${setting.key}-menu`}
              label={setting.label}
              menuLabel={setting.label}
              value={selectedLabel}
              open={settingMenu === setting.key}
              variant="format"
              triggerContent={
                <>
                  <Icon size={14} />
                  <span className="composer-setting-value">{selectedLabel}</span>
                </>
              }
              onOpenChange={(open) => {
                onSettingMenuChange(setting.key, open);
              }}
            >
              {(close) => (
                <ComposerSettingOptions
                  label={setting.label}
                  variant="format"
                  value={value}
                  options={setting.options.map((option) => ({
                    ...option,
                    disabled: option.value === 'transparent' && current.outputFormat !== 'png',
                  }))}
                  onSelect={(next) => {
                    settings.updateSettings(setting.key, next);
                    close();
                  }}
                />
              )}
            </ComposerSettingPicker>
          );
        })}
      {hasParameter(capability, 'left') && (
        <OutpaintSettings
          settings={settings}
          settingMenu={settingMenu}
          onSettingMenuChange={onSettingMenuChange}
        />
      )}
      {toolbarRangeSettings(capability).map((range) => {
        const Icon = range.icon;
        const value = formatRangeValue(current[range.key], range.step);
        return (
          <ComposerSettingPicker
            key={range.key}
            menuId={`${range.key}-menu`}
            label={range.label}
            menuLabel={range.label}
            value={value}
            open={settingMenu === range.key}
            variant="range"
            triggerContent={
              <>
                <Icon size={14} />
                <span className="composer-setting-value">{value}</span>
              </>
            }
            onOpenChange={(open) => {
              onSettingMenuChange(range.key, open);
            }}
          >
            {() => (
              <RangeSetting
                label={range.label}
                value={current[range.key]}
                min={range.min}
                max={range.max}
                step={range.step}
                onChange={(next) => {
                  settings.updateSettings(range.key, next);
                }}
              />
            )}
          </ComposerSettingPicker>
        );
      })}
      {hasParameter(capability, 'style_preset') && (
        <ComposerSettingPicker
          menuId="style-preset-menu"
          label="Style preset"
          menuLabel="Style preset"
          value={stylePresetName}
          open={settingMenu === 'style'}
          variant="style"
          triggerContent={
            <>
              <Brush size={14} />
              <span className="composer-setting-value">{stylePresetName}</span>
            </>
          }
          onOpenChange={(open) => {
            onSettingMenuChange('style', open);
          }}
        >
          {(close) => (
            <ComposerSettingOptions
              label="Style preset"
              variant="style"
              value={current.stylePreset || 'none'}
              options={stylePresets.map(([value, label]) => ({ value, label }))}
              onSelect={(value) => {
                settings.updateSettings('stylePreset', value === 'none' ? '' : value);
                close();
              }}
            />
          )}
        </ComposerSettingPicker>
      )}
    </>
  );
}
