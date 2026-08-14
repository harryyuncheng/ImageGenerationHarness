import { Check, Monitor, Moon, Sun } from 'lucide-react';
import { themeOptions, type ThemePreference } from '../theme.js';

export function ThemeMenuButton({
  theme,
  onToggle,
}: {
  theme: ThemePreference;
  onToggle: () => void;
}) {
  return (
    <button className="icon-button" onClick={onToggle} aria-label="Choose theme">
      {theme === 'dark' ? (
        <Moon size={18} />
      ) : theme === 'light' ? (
        <Sun size={18} />
      ) : (
        <Monitor size={18} />
      )}
    </button>
  );
}

export function ThemeMenu({
  theme,
  selectedThemeIndex,
  onSelect,
}: {
  theme: ThemePreference;
  selectedThemeIndex: number;
  onSelect: (value: ThemePreference) => void;
}) {
  return (
    <div className="popover theme-menu surface-enter">
      <span
        className="theme-menu__indicator"
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
          <span className="theme-menu__label">
            <Icon size={16} />
            <span>{label}</span>
          </span>
          {theme === value && <Check className="theme-menu__check" size={15} aria-hidden="true" />}
        </button>
      ))}
    </div>
  );
}
