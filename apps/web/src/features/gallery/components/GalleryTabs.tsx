import { CalendarDays, FolderTree } from 'lucide-react';
import { Link } from '@tanstack/react-router';

const tabs = [
  { to: '/gallery/history', label: 'Chronological', Icon: CalendarDays },
  { to: '/gallery/projects', label: 'By project', Icon: FolderTree },
] as const;

export function GalleryTabs() {
  return (
    <div className="gallery-sort-control">
      <span>Sort</span>
      <div role="group" aria-label="Sort gallery">
        {tabs.map(({ to, label, Icon }) => (
          <Link
            key={to}
            to={to}
            search={{ image: undefined, mode: undefined, run: undefined }}
            activeOptions={{ exact: false }}
            activeProps={{ className: 'selected', 'aria-current': 'page' }}
          >
            <Icon size={14} /> {label}
          </Link>
        ))}
      </div>
    </div>
  );
}
