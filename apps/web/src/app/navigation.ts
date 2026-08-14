import { Bookmark, FolderOpen, Grid2X2, History, Pencil, type LucideIcon } from 'lucide-react';

export type StudioView = 'create' | 'edit' | 'gallery' | 'references' | 'history' | 'presets';

export const navItems: readonly { value: StudioView; label: string; Icon: LucideIcon }[] = [
  { value: 'edit', label: 'Edit', Icon: Pencil },
  { value: 'gallery', label: 'Gallery', Icon: Grid2X2 },
  { value: 'references', label: 'References', Icon: FolderOpen },
  { value: 'history', label: 'History', Icon: History },
  { value: 'presets', label: 'Saved presets', Icon: Bookmark },
];
