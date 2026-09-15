import { useEffect, useMemo } from 'react';
import { usePersistentState } from '../../shared/hooks/use-persistent-state.js';
import type { Capability } from '../../shared/types/domain.js';
import { effectiveSeed, hasParameter, maximumSeed, resolveCapability } from './capabilities.js';
import { toolbarRangeSettings } from './model-presentation.js';
import { defaultSettings, type GenerationSettings, type UpdateSettings } from './settings.js';

/**
 * The current draft persists in this browser; saved setups replace it atomically.
 * Controls are re-checked against the capability the studio is about to call.
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
    const formats = selectedCapability.outputFormats;
    const seedMaximum = maximumSeed(selectedCapability);
    setSettings((stored) => {
      const current = { ...defaultSettings, ...stored };
      const outputFormat = formats.includes(current.outputFormat)
        ? current.outputFormat
        : ((formats.includes('png') ? 'png' : formats[0]) ?? 'png');
      const seed =
        seedMaximum === undefined
          ? current.seed
          : current.seedMode === 'random'
            ? Math.min(current.seed, seedMaximum)
            : effectiveSeed(selectedCapability, current.seed);
      const background =
        hasParameter(selectedCapability, 'background') && outputFormat !== 'png'
          ? 'auto'
          : current.background;
      const next = { ...current, outputFormat, seed, background };
      let changed =
        outputFormat !== current.outputFormat ||
        seed !== current.seed ||
        background !== current.background;
      for (const { key, min, max } of toolbarRangeSettings(selectedCapability)) {
        const value = Math.max(min, Math.min(current[key], max));
        if (value !== current[key]) {
          next[key] = value;
          changed = true;
        }
      }
      return changed ? next : stored;
    });
  }, [selectedCapability, settings.outputFormat, settings.seedMode, setSettings]);

  const updateSettings: UpdateSettings = (key, value) => {
    setSettings((current) => ({ ...current, [key]: value }));
  };

  function chooseRandomSeed() {
    const value = crypto.getRandomValues(new Uint32Array(1)).at(0) ?? 0;
    const seedMaximum = maximumSeed(selectedCapability);
    updateSettings('seed', seedMaximum === undefined ? 0 : (value % seedMaximum) + 1);
  }

  function resetSettings() {
    setSettings(defaultSettings);
  }

  return {
    settings,
    updateSettings,
    selectedCapability,
    chooseRandomSeed,
    resetSettings,
    restoreSettings: setSettings,
  };
}

export type GenerationSettingsController = ReturnType<typeof useGenerationSettings>;
