import { useState } from 'react';
import { useEditSource } from '../features/editor/use-edit-source.js';
import { useEditTools } from '../features/editor/use-edit-tools.js';
import { useEditorSelection } from '../features/editor/use-editor-selection.js';
import { useImageMetadata } from '../features/editor/use-image-metadata.js';
import { useImages } from '../features/gallery/use-images.js';
import { useProjects } from '../features/gallery/use-projects.js';
import { useAttachments } from '../features/generation/use-attachments.js';
import { useCapabilities } from '../features/generation/use-capabilities.js';
import { useDestination } from '../features/generation/use-destination.js';
import { useDraftActions } from '../features/generation/use-draft-actions.js';
import { useGeneration } from '../features/generation/use-generation.js';
import { useGenerationSettings } from '../features/generation/use-generation-settings.js';
import { usePromptDraft } from '../features/generation/use-prompt-draft.js';
import { useReferenceAttachment } from '../features/generation/use-reference-attachment.js';
import { runDestinationLabel } from '../features/history/run-presentation.js';
import { useFavorites } from '../features/history/use-favorites.js';
import { useRuns } from '../features/history/use-runs.js';
import { useSavedPrompts } from '../features/presets/use-saved-prompts.js';
import { useReferenceLibrary } from '../features/references/use-reference-library.js';
import { useRepository } from '../features/repository/use-repository.js';
import { useTheme } from '../features/theme/use-theme.js';
import { useClipboard } from '../shared/hooks/use-clipboard.js';
import { useToasts } from '../shared/hooks/use-toasts.js';
import type { Destination } from '../shared/types/domain.js';
import { AppSettings } from './AppSettings.js';
import { StudioMain } from './StudioMain.js';
import { StudioOverlays } from './StudioOverlays.js';
import { StudioPanels } from './StudioPanels.js';
import { useGlobalShortcuts } from './use-global-shortcuts.js';
import { useStudioNavigation } from './use-studio-navigation.js';

export function App() {
  const { toasts, notify, dismiss } = useToasts();
  const copyText = useClipboard(notify);
  const theme = useTheme();
  const [appSettingsOpen, setAppSettingsOpen] = useState(false);
  const repository = useRepository(notify);
  const activeRepositoryId = repository.activeRepositoryId;
  const { capabilities } = useCapabilities();

  const editor = useEditorSelection(activeRepositoryId);
  const navigation = useStudioNavigation(editor);
  const promptDraft = usePromptDraft();
  const settings = useGenerationSettings(capabilities);
  const attachments = useAttachments(notify, activeRepositoryId);
  const destination = useDestination(activeRepositoryId);
  const favorites = useFavorites();
  const savedPrompts = useSavedPrompts(notify);

  const runs = useRuns({
    activeRepositoryId,
    capabilities,
    favorites,
    editor,
    notify,
    onFailedRunDismissed: () => {
      editor.close();
      navigation.goToCreate();
      promptDraft.focusPromptSoon();
    },
  });
  const generation = useGeneration({
    promptDraft,
    settings,
    attachments,
    destination,
    runs,
    editor,
    notify,
    requireRepository: repository.requireRepository,
    onSubmissionFailed: () => {
      navigation.goToCreate();
      promptDraft.focusPromptSoon();
    },
  });
  const draftActions = useDraftActions({
    promptDraft,
    settings,
    attachments,
    destination,
    notify,
    goToCreate: navigation.goToCreate,
  });
  const projects = useProjects({
    activeRepositoryId,
    destination,
    notify,
    requireRepository: repository.requireRepository,
  });
  const imagesQuery = useImages(
    activeRepositoryId,
    navigation.view === 'edit' ||
      (navigation.view === 'gallery' &&
        navigation.gallerySort === 'project' &&
        Boolean(projects.selectedProjectId)),
  );
  const references = useReferenceLibrary({
    activeRepositoryId,
    notify,
    requireRepository: repository.requireRepository,
    removeLibraryImages: attachments.removeLibraryImages,
  });
  const editTools = useEditTools(capabilities);
  const editSource = useEditSource({
    promptDraft,
    settings,
    attachments,
    destination,
    editor,
    editTools,
    notify,
    goToEdit: () => {
      navigation.setView('edit');
    },
    goToCreate: navigation.goToCreate,
  });
  const metadata = useImageMetadata(() => {
    navigation.setModal('metadata');
  });
  const attachReferenceImage = useReferenceAttachment({
    attachments,
    settings,
    notify,
    onAttached: navigation.goToCreate,
  });

  useGlobalShortcuts({
    closeOverlays: () => {
      navigation.setModal(null);
      draftActions.closeModelMenu();
      setAppSettingsOpen(false);
      repository.setMenuOpen(false);
    },
    openSettings: () => {
      navigation.setModal(null);
      setAppSettingsOpen(true);
    },
    fileInput: attachments.fileInput,
    promptInput: promptDraft.promptInput,
  });

  const describeDestination = (value: Destination) =>
    runDestinationLabel(value, projects.projects, projects.selectedProjectQuery.data);

  const activeDestination = destination.destination;
  const destinationLabel =
    activeDestination.kind === 'main' ? undefined : describeDestination(activeDestination);

  return (
    <div
      className={`studio-shell ${navigation.panelCapable ? 'studio-shell--panel-capable' : ''} ${navigation.panelOpen ? 'studio-shell--panel-open' : ''}`}
    >
      <AppSettings open={appSettingsOpen} theme={theme} onOpenChange={setAppSettingsOpen} />

      <StudioMain
        navigation={navigation}
        repository={repository}
        capabilities={capabilities}
        promptDraft={promptDraft}
        settings={settings}
        attachments={attachments}
        draftActions={draftActions}
        generation={generation}
        editor={editor}
        editSource={editSource}
        imagesQuery={imagesQuery}
        projects={projects}
        references={references}
        runs={runs}
        favorites={favorites}
        savedPrompts={savedPrompts}
        describeDestination={describeDestination}
        {...(destinationLabel === undefined ? {} : { destinationLabel })}
        onViewMetadata={(imageId) => {
          void metadata.viewMetadata(imageId);
        }}
        onSavePrompt={() => {
          savedPrompts.savePrompt(promptDraft.prompt);
        }}
        onAttachReferenceImage={attachReferenceImage}
      />

      <StudioPanels
        navigation={navigation}
        settings={settings}
        editTools={editTools}
        editSource={editSource}
      />

      <StudioOverlays
        navigation={navigation}
        attachments={attachments}
        editSource={editSource}
        references={references}
        generation={generation}
        metadata={metadata}
        toasts={toasts}
        onDismissToast={dismiss}
        onCopy={copyText}
      />
    </div>
  );
}
