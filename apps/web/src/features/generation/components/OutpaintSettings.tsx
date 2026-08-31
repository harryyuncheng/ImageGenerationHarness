import { Frame } from 'lucide-react';
import { outpaintDirections } from '../settings.js';
import { ComposerSettingPicker, type ComposerSettingGroupProps } from './ComposerSettingPicker.js';

/** How far each edge of the canvas grows before the model paints into the new area. */
export function OutpaintSettings({
  settings,
  settingMenu,
  onSettingMenuChange,
}: ComposerSettingGroupProps) {
  const current = settings.settings;

  return (
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
  );
}
