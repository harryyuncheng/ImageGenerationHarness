import type { Capability } from '../../../shared/types/domain.js';
import { hasParameter } from '../capabilities.js';
import type { GenerationSettings, UpdateSettings } from '../settings.js';
import { RangeSetting } from './SettingControls.js';

interface CapabilityRangeSettingsProps {
  capability: Capability;
  settings: GenerationSettings;
  updateSettings: UpdateSettings;
}

/** Continuous controls, each shown only when the capability accepts it. */
export function CapabilityRangeSettings({
  capability,
  settings,
  updateSettings,
}: CapabilityRangeSettingsProps) {
  return (
    <>
      {capability.category === 'control' && capability.canonicalId.includes('control-') && (
        <RangeSetting
          label="Control strength"
          value={settings.controlStrength}
          min={0}
          max={1}
          step={0.05}
          onChange={(value) => {
            updateSettings('controlStrength', value);
          }}
        />
      )}
      {capability.canonicalId === 'service/style-guide' && (
        <RangeSetting
          label="Style fidelity"
          value={settings.fidelity}
          min={0}
          max={1}
          step={0.05}
          onChange={(value) => {
            updateSettings('fidelity', value);
          }}
        />
      )}
      {capability.canonicalId === 'service/style-transfer' && (
        <>
          <RangeSetting
            label="Composition fidelity"
            value={settings.compositionFidelity}
            min={0}
            max={1}
            step={0.05}
            onChange={(value) => {
              updateSettings('compositionFidelity', value);
            }}
          />
          <RangeSetting
            label="Style strength"
            value={settings.styleStrength}
            min={0}
            max={1}
            step={0.05}
            onChange={(value) => {
              updateSettings('styleStrength', value);
            }}
          />
          <RangeSetting
            label="Change strength"
            value={settings.changeStrength}
            min={0.1}
            max={1}
            step={0.05}
            onChange={(value) => {
              updateSettings('changeStrength', value);
            }}
          />
        </>
      )}
      {(capability.category === 'upscale' || capability.canonicalId === 'service/outpaint') &&
        capability.canonicalId !== 'service/fast-upscale' && (
          <RangeSetting
            label="Creativity"
            value={settings.creativity}
            min={0.1}
            max={capability.category === 'upscale' ? 0.5 : 1}
            step={0.05}
            onChange={(value) => {
              updateSettings('creativity', value);
            }}
          />
        )}
      {hasParameter(capability, 'grow_mask') && (
        <RangeSetting
          label="Mask growth (px)"
          value={settings.growMask}
          min={0}
          max={20}
          step={1}
          onChange={(value) => {
            updateSettings('growMask', value);
          }}
        />
      )}
    </>
  );
}
