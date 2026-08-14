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
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="setting-group range-setting">
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
