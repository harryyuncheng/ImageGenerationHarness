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

const seedStrategies = [
  { value: 'random', label: 'Random', description: 'Use a fresh random seed for each image.' },
  { value: 'fixed', label: 'Fixed', description: 'Reuse the same seed for every image.' },
  {
    value: 'sequential',
    label: 'Sequential',
    description: 'Increase the seed by one for each image.',
  },
] as const satisfies readonly {
  value: GenerationSettings['seedMode'];
  label: string;
  description: string;
}[];

export function OutputSettings({
  capability,
  settings,
  updateSettings,
  onRandomSeed,
}: OutputSettingsProps) {
  const seedMaximum = maximumSeed(capability);
  const outputFormats = supportedOutputFormats(capability);
  const selectedOutputFormatIndex = Math.max(outputFormats.indexOf(settings.outputFormat), 0);
  const selectedSeedStrategyIndex = Math.max(
    seedStrategies.findIndex((strategy) => strategy.value === settings.seedMode),
    0,
  );
  const selectedSeedStrategy =
    seedStrategies.find((strategy) => strategy.value === settings.seedMode) ?? seedStrategies[0];
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
          <div
            className="segmented-control seed-strategy-control"
            role="group"
            aria-label="Seed strategy"
          >
            <span
              className="segmented-control__indicator"
              aria-hidden="true"
              style={{
                width: `${String(100 / seedStrategies.length)}%`,
                transform: `translateX(${String(selectedSeedStrategyIndex * 100)}%)`,
              }}
            />
            {seedStrategies.map((strategy) => (
              <button
                type="button"
                key={strategy.value}
                className={settings.seedMode === strategy.value ? 'selected' : ''}
                aria-pressed={settings.seedMode === strategy.value}
                onClick={() => {
                  updateSettings('seedMode', strategy.value);
                }}
              >
                {strategy.label}
              </button>
            ))}
          </div>
          <small className="seed-strategy-description">{selectedSeedStrategy.description}</small>
          <div className="seed-input">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={String(seedMaximum).length}
              value={settings.seedMode === 'random' ? '' : settings.seed}
              placeholder="Random per image"
              aria-label="Seed"
              disabled={settings.seedMode === 'random'}
              onChange={(event) => {
                if (!/^\d*$/.test(event.target.value)) return;
                updateSettings('seed', Math.min(Number(event.target.value || '0'), seedMaximum));
              }}
            />
            <button
              type="button"
              className="icon-button"
              onClick={onRandomSeed}
              title="Random seed"
              disabled={settings.seedMode === 'random'}
            >
              <Dice5 size={17} />
            </button>
          </div>
        </SettingGroup>
      )}
    </>
  );
}
