import { Dice5 } from 'lucide-react';
import type { Capability } from '../../../shared/types/domain.js';
import { hasParameter, maximumSeed, supportedOutputFormats } from '../capabilities.js';
import type { GenerationSettings, UpdateSettings } from '../settings.js';
import { SettingGroup } from './SettingControls.js';

interface OutputSettingsProps {
  capability: Capability;
  settings: GenerationSettings;
  updateSettings: UpdateSettings;
  onRandomSeed: () => void;
}

/** What the provider returns: negative prompt, encoding, and seed planning. */
export function OutputSettings({
  capability,
  settings,
  updateSettings,
  onRandomSeed,
}: OutputSettingsProps) {
  const seedMaximum = maximumSeed(capability);
  const outputFormats = supportedOutputFormats(capability);
  const selectedOutputFormatIndex = Math.max(outputFormats.indexOf(settings.outputFormat), 0);
  return (
    <>
      {hasParameter(capability, 'negative_prompt') && (
        <SettingGroup label="Negative prompt">
          <textarea
            rows={3}
            value={settings.negativePrompt}
            onChange={(event) => {
              updateSettings('negativePrompt', event.target.value);
            }}
            placeholder="What should not appear?"
          />
        </SettingGroup>
      )}
      {hasParameter(capability, 'output_format') && (
        <SettingGroup label="Output format">
          <div className="segmented-control" role="group" aria-label="Output format">
            <span
              className="segmented-control__indicator"
              aria-hidden="true"
              style={{
                width: `${String(100 / Math.max(outputFormats.length, 1))}%`,
                transform: `translateX(${String(selectedOutputFormatIndex * 100)}%)`,
              }}
            />
            {outputFormats.map((format) => (
              <button
                type="button"
                key={format}
                className={settings.outputFormat === format ? 'selected' : ''}
                aria-pressed={settings.outputFormat === format}
                onClick={() => {
                  updateSettings('outputFormat', format);
                }}
              >
                {format.toUpperCase()}
              </button>
            ))}
          </div>
        </SettingGroup>
      )}
      {seedMaximum !== undefined && (
        <SettingGroup label="Seed strategy">
          <select
            value={settings.seedMode}
            onChange={(event) => {
              updateSettings('seedMode', event.target.value as GenerationSettings['seedMode']);
            }}
          >
            <option value="random">Random per image</option>
            <option value="fixed">Repeat one seed</option>
            <option value="sequential">Sequential seeds</option>
          </select>
          {settings.seedMode !== 'random' && (
            <div className="seed-input">
              <input
                type="number"
                min="0"
                max={seedMaximum}
                value={settings.seed}
                onChange={(event) => {
                  updateSettings('seed', Number(event.target.value));
                }}
              />
              <button className="icon-button" onClick={onRandomSeed} title="Random seed">
                <Dice5 size={17} />
              </button>
            </div>
          )}
        </SettingGroup>
      )}
    </>
  );
}
