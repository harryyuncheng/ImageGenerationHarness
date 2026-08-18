import { X } from 'lucide-react';
import type { Capability } from '../../../shared/types/domain.js';
import { hasParameter } from '../capabilities.js';
import {
  outpaintDirections,
  stylePresets,
  type GenerationSettings,
  type UpdateSettings,
} from '../settings.js';
import { CapabilityRangeSettings } from './CapabilityRangeSettings.js';
import { OutputSettings } from './OutputSettings.js';
import { SettingGroup } from './SettingControls.js';

interface SettingsPanelProps {
  open: boolean;
  capability: Capability;
  settings: GenerationSettings;
  updateSettings: UpdateSettings;
  onRandomSeed: () => void;
  onClose: () => void;
}

/** Only the controls the selected Bedrock capability actually accepts are rendered. */
export function SettingsPanel({
  open,
  capability,
  settings,
  updateSettings,
  onRandomSeed,
  onClose,
}: SettingsPanelProps) {
  const showStyle = hasParameter(capability, 'style_preset');
  return (
    <aside
      className={`settings-panel ${open ? 'settings-panel--open' : ''}`}
      aria-label="Generation settings"
      aria-hidden={open ? undefined : true}
      inert={!open}
    >
      <header className="settings-panel-header">
        <h2>Advanced settings</h2>
        <button
          type="button"
          className="icon-button"
          onClick={onClose}
          aria-label="Close advanced settings"
        >
          <X size={18} />
        </button>
      </header>
      <div className="settings-scroll">
        {showStyle && (
          <SettingGroup label="Style preset">
            <select
              value={settings.stylePreset || 'none'}
              onChange={(event) => {
                updateSettings(
                  'stylePreset',
                  event.target.value === 'none' ? '' : event.target.value,
                );
              }}
            >
              {stylePresets.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </SettingGroup>
        )}

        {capability.canonicalId === 'service/search-recolor' && (
          <SettingGroup label="Select object or area">
            <input
              value={settings.selectPrompt}
              onChange={(event) => {
                updateSettings('selectPrompt', event.target.value);
              }}
              placeholder="e.g. the red jacket"
            />
          </SettingGroup>
        )}
        {capability.canonicalId === 'service/search-replace' && (
          <SettingGroup label="Object to replace">
            <input
              value={settings.searchPrompt}
              onChange={(event) => {
                updateSettings('searchPrompt', event.target.value);
              }}
              placeholder="e.g. the wooden chair"
            />
          </SettingGroup>
        )}

        <CapabilityRangeSettings
          capability={capability}
          settings={settings}
          updateSettings={updateSettings}
        />

        {capability.canonicalId === 'service/outpaint' && (
          <SettingGroup label="Expand canvas (px)">
            <div className="number-grid">
              {outpaintDirections.map(({ label, key }) => (
                <label key={key}>
                  <span>{label}</span>
                  <input
                    type="number"
                    min="0"
                    max="2000"
                    value={settings[key]}
                    onChange={(event) => {
                      updateSettings(key, Number(event.target.value));
                    }}
                  />
                </label>
              ))}
            </div>
          </SettingGroup>
        )}

        <OutputSettings
          capability={capability}
          settings={settings}
          updateSettings={updateSettings}
          onRandomSeed={onRandomSeed}
        />
      </div>
    </aside>
  );
}
