import { Brush, Crosshair, Frame, Replace } from 'lucide-react';
import { hasParameter } from '../capabilities.js';
import { toolbarRangeSettings } from '../model-presentation.js';
import { outpaintDirections, stylePresets } from '../settings.js';
import {
  ComposerSettingOptions,
  ComposerSettingPicker,
  type ComposerSettingGroupProps,
} from './ComposerSettingPicker.js';
import { formatRangeValue, RangeSetting } from './SettingControls.js';

const textSettings = [
  {
    parameter: 'select_prompt',
    key: 'selectPrompt',
    label: 'Select object or area',
    description: 'Name the object or area the model should change',
    placeholder: 'e.g. the red jacket',
    icon: Crosshair,
  },
  {
    parameter: 'search_prompt',
    key: 'searchPrompt',
    label: 'Object to replace',
    description: 'Name the object the model should replace',
    placeholder: 'e.g. the wooden chair',
    icon: Replace,
  },
] as const;

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
              menuDescription={setting.description}
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
      {hasParameter(capability, 'left') && (
        <ComposerSettingPicker
          menuId="expand-canvas-menu"
          label="Expand canvas"
          menuLabel="Expand canvas (px)"
          menuDescription="Choose how far each edge grows before painting"
          value={outpaintDirections
            .map(({ label, key }) => `${label} ${String(current[key])}`)
            .join(', ')}
          open={settingMenu === 'canvas'}
          variant="canvas"
          triggerContent={<Frame size={14} />}
          onOpenChange={(open) => {
            onSettingMenuChange('canvas', open);
          }}
        >
          {() => (
            <div className="composer-setting-field">
              <div className="number-grid">
                {outpaintDirections.map(({ label, key }) => (
                  <label key={key}>
                    <span>{label}</span>
                    <input
                      type="number"
                      min="0"
                      max="2000"
                      value={current[key]}
                      onChange={(event) => {
                        settings.updateSettings(key, Number(event.target.value));
                      }}
                    />
                  </label>
                ))}
              </div>
            </div>
          )}
        </ComposerSettingPicker>
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
            menuDescription={range.description}
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
                disabled={range.disabled ?? false}
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
          menuDescription="Bias the result toward a familiar look"
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
