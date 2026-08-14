import { navItems, type StudioView } from './navigation.js';

export function MobileNav({
  isActiveView,
  onSelectView,
}: {
  isActiveView: (view: StudioView) => boolean;
  onSelectView: (view: StudioView) => void;
}) {
  return (
    <nav className="mobile-nav surface-enter" aria-label="Mobile studio navigation">
      {navItems.map(({ value, label, Icon }) => (
        <button
          key={value}
          className={isActiveView(value) ? 'active' : ''}
          onClick={() => {
            onSelectView(value);
          }}
        >
          <Icon size={17} /> {label}
        </button>
      ))}
    </nav>
  );
}
