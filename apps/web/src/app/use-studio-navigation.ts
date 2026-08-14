import { useState } from 'react';
import type { EditorSelectionController } from '../features/editor/use-editor-selection.js';
import type { StudioView } from './navigation.js';

export type ModalName = 'code' | 'request' | 'metadata' | null;

/**
 * Owns which studio surface is visible: the primary view, the canvas editor
 * selection, the collapsible panels, and the active dialog.
 */
export function useStudioNavigation(editor: EditorSelectionController) {
  const [view, setView] = useState<StudioView>('create');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(true);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [modal, setModal] = useState<ModalName>(null);

  const selection = editor.selection;
  const showCreateWorkspace = view === 'create' && selection === undefined;
  const showSettings = showCreateWorkspace && settingsOpen;
  const hasEditSource =
    selection?.kind === 'upload' || (selection?.kind === 'image' && selection.intent === 'edit');
  const showEditWorkspace = view === 'edit' && (selection === undefined || hasEditSource);
  const showsView = (value: StudioView) => selection === undefined && view === value;

  function selectStudioView(nextView: StudioView) {
    editor.close();
    setView(nextView);
  }

  function goToCreate() {
    setView('create');
  }

  return {
    view,
    setView,
    showsView,
    selectStudioView,
    goToCreate,
    sidebarOpen,
    setSidebarOpen,
    settingsOpen,
    setSettingsOpen,
    mobileNavOpen,
    setMobileNavOpen,
    modal,
    setModal,
    showCreateWorkspace,
    showSettings,
    showEditWorkspace,
    hasEditSource,
    panelCapable: showCreateWorkspace || showEditWorkspace,
    panelOpen: showSettings || showEditWorkspace,
  };
}

export type StudioNavigation = ReturnType<typeof useStudioNavigation>;
