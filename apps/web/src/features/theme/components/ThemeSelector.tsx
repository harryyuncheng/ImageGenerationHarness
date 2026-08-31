import { Check } from 'lucide-react';
import { previewFaces, themeGroups, type ThemePreference } from '../theme.js';

export function ThemeSelector({
  theme,
  onSelect,
}: {
  theme: ThemePreference;
  onSelect: (value: ThemePreference) => void;
}) {
  return (
    <div className="theme-selector">
      {themeGroups.map(({ id, label, hint, options }) => (
        <div key={id} className="theme-group" role="group" aria-label={label}>
          <header className="theme-group__header">
            <strong>{label}</strong>
            <small>{hint}</small>
          </header>
          <div className="theme-group__tiles">
            {options.map(({ value, label: optionLabel, Icon }) => {
              const [front, back] = previewFaces(value);
              return (
                <button
                  type="button"
                  key={value}
                  className={`theme-tile ${theme === value ? 'selected' : ''}`}
                  aria-pressed={theme === value}
                  onClick={() => {
                    onSelect(value);
                  }}
                >
                  <span className="theme-tile__preview" aria-hidden="true">
                    <span className="theme-tile__face" data-theme={front} />
                    <span className="theme-tile__face theme-tile__face--back" data-theme={back} />
                    {theme === value && <Check className="theme-tile__check" size={13} />}
                  </span>
                  <span className="theme-tile__label">
                    <Icon size={13} aria-hidden="true" />
                    <span>{optionLabel}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
