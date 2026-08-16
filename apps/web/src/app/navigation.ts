import { Bookmark, FolderOpen, type LucideIcon } from 'lucide-react';

export type StudioView = 'create' | 'edit' | 'gallery' | 'references' | 'presets';
export type GallerySort = 'chronological' | 'project';

export const navItems: readonly { value: StudioView; label: string; Icon: LucideIcon }[] = [
  { value: 'references', label: 'References', Icon: FolderOpen },
  { value: 'presets', label: 'Saved presets', Icon: Bookmark },
];
