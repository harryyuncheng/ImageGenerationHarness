import { Palette, Plus } from 'lucide-react';
import { navItems, type StudioView } from './navigation.js';

interface LeftRailProps {
  sidebarOpen: boolean;
  isActiveView: (view: StudioView) => boolean;
  onSelectView: (view: StudioView) => void;
  onReset: () => void;
}

export function LeftRail(props: LeftRailProps) {
  const { sidebarOpen } = props;
  return (
    <aside className={`left-rail ${sidebarOpen ? '' : 'left-rail--collapsed'}`}>
      <div className="brand-row">
        <button className="brand" onClick={props.onReset} aria-label="Open Baroque home">
          <span className="brand-mark">
            <Palette size={21} />
          </span>
          {sidebarOpen && <span>Baroque</span>}
        </button>
      </div>
      <button className="new-button" onClick={props.onReset}>
        <Plus size={18} />
        {sidebarOpen && <span>New image</span>}
      </button>
      <nav className="primary-nav" aria-label="Studio navigation">
        {navItems.map(({ value, label, Icon }) => (
          <button
            key={value}
            className={props.isActiveView(value) ? 'active' : ''}
            onClick={() => {
              props.onSelectView(value);
            }}
            title={sidebarOpen ? undefined : label}
          >
            <Icon size={18} />
            {sidebarOpen && <span>{label}</span>}
          </button>
        ))}
      </nav>
      <div className="rail-footer-spacer" aria-hidden="true" />
    </aside>
  );
}
