import { useEffect, useMemo } from 'react';
import { usePersistentState } from '../../shared/hooks/use-persistent-state.js';
import type { Capability } from '../../shared/types/domain.js';
import { maximumSeed, resolveCapability, supportedOutputFormats } from './capabilities.js';
import { defaultSettings, type GenerationSettings, type UpdateSettings } from './settings.js';

/**
 * Generation settings persist in this browser only and are always re-checked
 * against the capability the studio is about to call.
 */
export function useGenerationSettings(capabilities: readonly Capability[]) {
  const [persistedSettings, setSettings] = usePersistentState<GenerationSettings>(
    'harness-generation-settings',
    defaultSettings,
  );
  const settings = useMemo(
    () => ({ ...defaultSettings, ...persistedSettings }),
    [persistedSettings],
  );
  const selectedCapability = resolveCapability(capabilities, settings.targetId);

  useEffect(() => {
    const formats = supportedOutputFormats(selectedCapability);
    const seedMaximum = maximumSeed(selectedCapability);
    setSettings((current) => {
      const outputFormat = formats.includes(current.outputFormat)
        ? current.outputFormat
        : ((formats.includes('png') ? 'png' : formats[0]) ?? 'png');
      const seed = seedMaximum === undefined ? current.seed : Math.min(current.seed, seedMaximum);
      return outputFormat === current.outputFormat && seed === current.seed
        ? current
        : { ...current, outputFormat, seed };
    });
  }, [
    selectedCapability.canonicalId,
    selectedCapability.outputFormats,
    selectedCapability.seedMaximum,
    setSettings,
  ]);

  const updateSettings: UpdateSettings = (key, value) => {
    setSettings((current) => ({ ...current, [key]: value }));
  };

  function chooseRandomSeed() {
    const value = crypto.getRandomValues(new Uint32Array(1)).at(0) ?? 0;
    const seedMaximum = maximumSeed(selectedCapability);
    updateSettings('seed', seedMaximum === undefined ? 0 : value % (seedMaximum + 1));
  }

  function resetSettings() {
    setSettings(defaultSettings);
  }

  return { settings, updateSettings, selectedCapability, chooseRandomSeed, resetSettings };
}

export type GenerationSettingsController = ReturnType<typeof useGenerationSettings>;
