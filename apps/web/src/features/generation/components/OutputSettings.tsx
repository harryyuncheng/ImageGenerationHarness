import type { Capability } from '../../../shared/types/domain.js';
import { hasParameter, maximumSeed, supportedOutputFormats } from '../capabilities.js';
import { seedStrategies, type GenerationSettings, type UpdateSettings } from '../settings.js';
import { SeedValueInput, SettingGroup } from './SettingControls.js';

interface OutputSettingsProps {
  capability: Capability;
  settings: GenerationSettings;
  updateSettings: UpdateSettings;
  onRandomSeed: () => void;
}

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
          <SeedValueInput
            seed={settings.seed}
            seedMaximum={seedMaximum}
            disabled={settings.seedMode === 'random'}
            onChange={(value) => {
              updateSettings('seed', value);
            }}
            onRandomSeed={onRandomSeed}
          />
        </SettingGroup>
      )}
    </>
  );
}
