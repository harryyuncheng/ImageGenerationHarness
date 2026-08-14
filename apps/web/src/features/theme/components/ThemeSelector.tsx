import { Check } from 'lucide-react';
import { themeOptions, type ThemePreference } from '../theme.js';

export function ThemeSelector({
  theme,
  selectedThemeIndex,
  onSelect,
}: {
  theme: ThemePreference;
  selectedThemeIndex: number;
  onSelect: (value: ThemePreference) => void;
}) {
  return (
    <div className="theme-selector" role="group" aria-label="Theme">
      <span
        className="theme-selector__indicator"
        aria-hidden="true"
        style={{ transform: `translateY(${String(selectedThemeIndex * 100)}%)` }}
      />
      {themeOptions.map(({ value, label, Icon }) => (
        <button
          type="button"
          key={value}
          className={theme === value ? 'selected' : ''}
          aria-pressed={theme === value}
          onClick={() => {
            onSelect(value);
          }}
        >
          <span className="theme-selector__label">
            <Icon size={16} />
            <span>{label}</span>
          </span>
          {theme === value && (
            <Check className="theme-selector__check" size={15} aria-hidden="true" />
          )}
        </button>
      ))}
    </div>
  );
}
