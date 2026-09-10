import {
  presetDtoSchema,
  presetsResponseSchema,
  type CreatePresetRequest,
  type PresetDto,
  type UpdatePresetRequest,
} from '@harness/contracts';
import { jsonBody, requestJson, requestVoid } from '../../shared/api/http.js';

export function getPresets() {
  return requestJson('/api/presets', presetsResponseSchema, {}, 'Saved presets unavailable.');
}

export function createPreset(input: CreatePresetRequest) {
  return requestJson(
    '/api/presets',
    presetDtoSchema,
    { method: 'POST', ...jsonBody(input) },
    'Could not save the preset.',
  );
}

export function updatePreset(presetId: string, input: UpdatePresetRequest) {
  return requestJson(
    `/api/presets/${presetId}`,
    presetDtoSchema,
    { method: 'PATCH', ...jsonBody(input) },
    'Could not update the preset.',
  );
}

export function deletePreset(presetId: string) {
  return requestVoid(
    `/api/presets/${presetId}`,
    { method: 'DELETE' },
    'Could not delete the preset.',
  );
}

export function presetCoverUrl(preset: PresetDto): string | undefined {
  return preset.cover
    ? `/api/presets/${preset.presetId}/cover?imageId=${preset.cover.imageId}`
    : undefined;
}
