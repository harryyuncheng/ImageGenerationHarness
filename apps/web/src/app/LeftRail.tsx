import { Image as ImageIcon, Palette, Plus } from 'lucide-react';
import type { StudioRun } from '../features/history/run-presentation.js';
import { navItems, type StudioView } from './navigation.js';

interface LeftRailProps {
  sidebarOpen: boolean;
  runCount: number;
  recentRuns: StudioRun[];
  isActiveView: (view: StudioView) => boolean;
  isActiveRun: (run: StudioRun) => boolean;
  onSelectView: (view: StudioView) => void;
  onOpenRun: (run: StudioRun) => void;
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
            {sidebarOpen && value === 'history' && props.runCount > 0 && (
              <span className="nav-count">{props.runCount}</span>
            )}
          </button>
        ))}
      </nav>
      {sidebarOpen && props.recentRuns.length > 0 && (
        <div className="recent-block">
          <p className="rail-label">Recent</p>
          <div className="recent-tabs" role="tablist" aria-label="Recent image editors">
            {props.recentRuns.slice(0, 12).map((run) => (
              <button
                key={run.id}
                role="tab"
                aria-selected={props.isActiveRun(run)}
                aria-controls={`image-editor-${run.remoteId ?? run.id}`}
                className={props.isActiveRun(run) ? 'active' : ''}
                onClick={() => {
                  props.onOpenRun(run);
                }}
              >
                <ImageIcon size={15} />
                <span>{run.prompt || run.targetName}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="rail-footer-spacer" aria-hidden="true" />
    </aside>
  );
}
