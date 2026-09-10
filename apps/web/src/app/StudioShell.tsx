import { Cloud, Images } from 'lucide-react';
import { useRef, useState } from 'react';
import { Outlet, useRouterState, useSearch } from '@tanstack/react-router';
import { CreateView } from '../features/generation/components/CreateView.js';
import { PresetsButton } from '../features/presets/components/PresetsButton.js';
import { PresetsView } from '../features/presets/components/PresetsView.js';
import { StyleGuideModal } from '../features/style-guide/components/StyleGuideModal.js';
import {
  StyleGuideStack,
  type FanOrigin,
} from '../features/style-guide/components/StyleGuideStack.js';
import { CuttingMat } from '../features/theme/components/CuttingMat.js';
import { InlineError } from '../shared/components/InlineError.js';
import { AppSettings } from './AppSettings.js';
import { StudioOverlays } from './StudioOverlays.js';
import { StudioProvider, useStudio, useStudioShell } from './studio-context.js';
import { useGlobalShortcuts } from './use-global-shortcuts.js';

function CreateWorkspace() {
  const studio = useStudio();
  return (
    <CreateView
      promptDraft={studio.promptDraft}
      settings={studio.settings}
      attachments={studio.attachments}
      generation={studio.generation}
      feedback={
        <>
          <InlineError feedback={studio.generation.feedback} />
          <InlineError feedback={studio.attachments.feedback} />
          <InlineError feedback={studio.savedPrompts.feedback} />
          <InlineError feedback={studio.runs.feedback} />
        </>
      }
      capabilities={studio.capabilities}
      providers={studio.providers}
      {...(studio.viewer === undefined ? {} : { loaded: studio.viewer })}
      onResetSettings={() => {
        studio.generation.feedback.clearError();
        studio.savedPrompts.feedback.clearError();
        studio.runs.feedback.clearError();
        studio.draftActions.resetDraft();
      }}
      onSavePrompt={() => {
        if (studio.savedPrompts.beginCreate(studio.promptDraft.prompt)) {
          studio.navigate.goToPresets();
        }
      }}
    />
  );
}

function StudioLayout() {
  const studio = useStudio();
  const { settingsOpen, setSettingsOpen, dialogs, shortcuts } = useStudioShell();
  const [fanOrigins, setFanOrigins] = useState<readonly FanOrigin[]>([]);
  const fanRef = useRef<HTMLButtonElement>(null);
  const canvasRef = useRef<HTMLElement>(null);
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  const styleGuideOpen = pathname === '/style-guide';
  const presetsOpen = pathname === '/presets';
  const showCreateWorkspace = pathname === '/' || styleGuideOpen || presetsOpen;
  const isGallery = pathname.startsWith('/gallery');

  useGlobalShortcuts({
    bindings: shortcuts.bindings,
    closeOverlays: () => {
      if (settingsOpen) setSettingsOpen(false);
      else if (isGallery && !dialogs.request) studio.navigate.returnToCanvas();
    },
    openSettings: () => {
      setSettingsOpen(true);
    },
    chooseImages: studio.attachments.chooseFiles,
    promptInput: studio.promptDraft.promptInput,
  });

  return (
    <div className="studio-shell">
      <AppSettings />

      <div
        className={`studio-main ${showCreateWorkspace ? 'studio-main--create' : ''} ${isGallery ? 'studio-main--overview' : ''}`}
      >
        <CuttingMat overview={isGallery} viewportRef={canvasRef} />

        <div className="workspace">
          <main ref={canvasRef} className="canvas" data-scroll-restoration-id="studio-canvas">
            {(showCreateWorkspace || isGallery) && (
              <div
                className="canvas-origin"
                hidden={!showCreateWorkspace}
                inert={!showCreateWorkspace}
              >
                <CreateWorkspace />
              </div>
            )}
            <Outlet />
          </main>
        </div>

        {showCreateWorkspace && (
          <StyleGuideStack
            stackRef={fanRef}
            activeFolder={studio.styleGuide.activeFolder}
            appliedImages={studio.styleGuide.appliedImages}
            onOpen={(origins) => {
              setFanOrigins(origins);
              studio.navigate.goToStyleGuide();
            }}
          />
        )}

        {showCreateWorkspace && <PresetsButton onOpen={studio.navigate.goToPresets} />}

        <button
          type="button"
          className="icon-button studio-corner-icon sheet-navigation"
          aria-label={isGallery ? 'Create' : 'Gallery'}
          title={isGallery ? 'Create' : 'Gallery'}
          onClick={isGallery ? studio.navigate.returnToCanvas : studio.navigate.goToHistory}
        >
          {isGallery ? (
            <Cloud size={20} aria-hidden="true" />
          ) : (
            <Images size={20} aria-hidden="true" />
          )}
        </button>
      </div>

      <StudioOverlays />

      {presetsOpen && (
        <PresetsView
          controller={studio.savedPrompts}
          repositoryId={studio.activeRepositoryId}
          onChooseRepository={() => {
            studio.navigate.returnToCanvas();
            studio.repository.requireRepository('save presets');
          }}
          onClose={studio.navigate.returnToCanvas}
        />
      )}

      {styleGuideOpen && (
        <StyleGuideModal
          folders={studio.styleGuide.folders}
          activeFolderId={studio.styleGuide.activeFolderId}
          appliedImages={studio.styleGuide.appliedImages}
          origins={fanOrigins}
          fanRef={fanRef}
          isLoading={studio.styleGuide.styleGuideQuery.isLoading}
          isMutating={studio.styleGuide.isMutating}
          feedback={<InlineError feedback={studio.styleGuide.feedback} />}
          {...(studio.styleGuide.styleGuideQuery.error instanceof Error
            ? { error: studio.styleGuide.styleGuideQuery.error.message }
            : {})}
          onClose={studio.navigate.goToCreate}
          onCreateFolder={() => {
            void studio.styleGuide.createFolder();
          }}
          onRenameFolder={(folder, name) => {
            void studio.styleGuide.renameFolder(folder, name);
          }}
          onDeleteFolder={(folder) => {
            void studio.styleGuide.deleteFolder(folder);
          }}
          onAddImages={studio.styleGuide.chooseUploads}
          onToggleActive={studio.styleGuide.toggleActiveFolder}
          onRenameImage={(image, name) => {
            void studio.styleGuide.renameImage(image, name);
          }}
          onDeleteImage={(image) => {
            void studio.styleGuide.deleteImage(image);
          }}
          onToggleImage={studio.styleGuide.toggleImage}
          onRetry={() => {
            void studio.styleGuide.refresh();
          }}
        />
      )}
    </div>
  );
}

/**
 * The root route renders the shell so every view shares the canvas frame,
 * panels, and overlays, while the addressed view swaps through the outlet.
 */
export function StudioShell() {
  const search = useSearch({ strict: false });

  return (
    <StudioProvider
      focusedImageId={search.image}
      focusedRunId={search.run}
      focusedOutputIndex={search.output}
    >
      <StudioLayout />
    </StudioProvider>
  );
}
