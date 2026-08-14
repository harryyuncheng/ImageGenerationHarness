import { Keyboard } from 'lucide-react';

const shortcuts = [
  ['Focus prompt', '⌘ K'],
  ['Create', '⌘ Enter'],
  ['Add source image', '⌘ ⇧ O'],
  ['Open shortcuts', '⌘ /'],
  ['Close menu or dialog', 'Esc'],
];

export function ShortcutList() {
  return (
    <div className="shortcut-list">
      <div className="shortcut-hero">
        <Keyboard size={25} />
        <p>Move quickly around Baroque.</p>
      </div>
      {shortcuts.map(([label, keys]) => (
        <div key={label}>
          <span>{label}</span>
          <kbd>{keys}</kbd>
        </div>
      ))}
    </div>
  );
}
