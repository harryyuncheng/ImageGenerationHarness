import { Dice5 } from 'lucide-react';
import type { ReactNode } from 'react';

export function SettingGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="setting-group">
      <label>{label}</label>
      {children}
    </div>
  );
}

export function RangeSetting({
  label,
  value,
  min,
  max,
  step,
  disabled = false,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <div className={`setting-group range-setting${disabled ? ' range-setting--disabled' : ''}`}>
      <label>
        <span>{label}</span>
        <output>{value.toFixed(2)}</output>
      </label>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(event) => {
          onChange(Number(event.target.value));
        }}
      />
      <div className="range-labels">
        <span>Lower</span>
        <span>Higher</span>
      </div>
    </div>
  );
}

/** Seeds are only editable once a strategy pins them, so random disables the whole row. */
export function SeedValueInput({
  seed,
  seedMaximum,
  disabled,
  onChange,
  onRandomSeed,
}: {
  seed: number;
  seedMaximum: number;
  disabled: boolean;
  onChange: (value: number) => void;
  onRandomSeed: () => void;
}) {
  return (
    <div className="seed-input">
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={String(seedMaximum).length}
        value={disabled ? '' : seed}
        placeholder="Random per image"
        aria-label="Seed"
        disabled={disabled}
        onChange={(event) => {
          if (!/^\d*$/.test(event.target.value)) return;
          onChange(Math.min(Number(event.target.value || '0'), seedMaximum));
        }}
      />
      <button
        type="button"
        className="icon-button"
        onClick={onRandomSeed}
        title="Random seed"
        disabled={disabled}
      >
        <Dice5 size={17} />
      </button>
    </div>
  );
}
