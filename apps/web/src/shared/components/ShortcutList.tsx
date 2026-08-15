const shortcuts = [
  ['Focus prompt', '⌘ K'],
  ['Create', '⌘ Enter'],
  ['Add source image', '⌘ ⇧ O'],
  ['Open settings', '⌘ /'],
  ['Close menu or dialog', 'Esc'],
];

export function ShortcutList() {
  return (
    <div className="shortcut-list">
      {shortcuts.map(([label, keys]) => (
        <div key={label}>
          <span>{label}</span>
          <kbd>{keys}</kbd>
        </div>
      ))}
    </div>
  );
}
