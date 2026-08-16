import type { UseQueryResult } from '@tanstack/react-query';
import { EditView } from '../features/editor/components/EditView.js';
import type { EditSourceController } from '../features/editor/use-edit-source.js';
import type { EditorSelectionController } from '../features/editor/use-editor-selection.js';
import { GalleryView } from '../features/gallery/components/GalleryView.js';
import type { ProjectsController } from '../features/gallery/use-projects.js';
import { CreateView } from '../features/generation/components/CreateView.js';
import type { AttachmentsController } from '../features/generation/use-attachments.js';
import type { DraftActionsController } from '../features/generation/use-draft-actions.js';
import type { GenerationController } from '../features/generation/use-generation.js';
import type { GenerationSettingsController } from '../features/generation/use-generation-settings.js';
import type { PromptDraftController } from '../features/generation/use-prompt-draft.js';
import type { FavoritesController } from '../features/history/use-favorites.js';
import type { RunsController } from '../features/history/use-runs.js';
import { PresetsView } from '../features/presets/components/PresetsView.js';
import type { SavedPromptsController } from '../features/presets/use-saved-prompts.js';
import { ReferenceLibraryView } from '../features/references/components/ReferenceLibraryView.js';
import type { ReferenceLibraryController } from '../features/references/use-reference-library.js';
import type { RepositoryController } from '../features/repository/use-repository.js';
import type {
  Capability,
  GalleryImage,
  GalleryResponse,
  ReferenceImage,
} from '../shared/types/domain.js';
import type { StudioNavigation } from './use-studio-navigation.js';

export interface CanvasViewsProps {
  navigation: StudioNavigation;
  repository: RepositoryController;
  capabilities: readonly Capability[];
  promptDraft: PromptDraftController;
  settings: GenerationSettingsController;
  attachments: AttachmentsController;
  draftActions: DraftActionsController;
  generation: GenerationController;
  editor: EditorSelectionController;
  editSource: EditSourceController;
  imagesQuery: UseQueryResult<GalleryResponse>;
  projects: ProjectsController;
  references: ReferenceLibraryController;
  runs: RunsController;
  favorites: FavoritesController;
  savedPrompts: SavedPromptsController;
  onSavePrompt: () => void;
  onAttachReferenceImage: (image: ReferenceImage) => void;
}

export function CanvasViews(props: CanvasViewsProps) {
  const { navigation, repository, projects, references, runs, imagesQuery, editor } = props;
  const repositoryReady = Boolean(repository.activeRepositoryId);
  const images = imagesQuery.data?.images ?? [];
  const imagesError = imagesQuery.error;
  const openImageEditor = (image: GalleryImage, location: string) => {
    editor.openImage(image, location);
  };

  return (
    <>
      {navigation.showsView('create') && (
        <CreateView
          promptDraft={props.promptDraft}
          settings={props.settings}
          attachments={props.attachments}
          draftActions={props.draftActions}
          generation={props.generation}
          capabilities={props.capabilities}
          onOpenLibrary={() => {
            navigation.selectStudioView('references');
          }}
          onSavePrompt={props.onSavePrompt}
        />
      )}
      {navigation.showsView('edit') && (
        <EditView
          images={images}
          projects={projects.projects}
          isLoading={imagesQuery.isLoading}
          repositoryReady={repositoryReady}
          {...(imagesError instanceof Error ? { error: imagesError.message } : {})}
          onRepositoryRequired={() => {
            repository.requireRepository('choose an image from Baroque');
          }}
          onUpload={() => {
            props.editSource.editFileInput.current?.click();
          }}
          onDropFiles={props.editSource.openEditFile}
          onRetry={() => {
            void imagesQuery.refetch();
          }}
          onOpenImage={(image, location) => {
            editor.openImage(image, location, 'edit');
          }}
        />
      )}
      {navigation.showsView('gallery') && (
        <GalleryView
          projects={projects}
          images={images}
          sort={navigation.gallerySort}
          repositoryReady={repositoryReady}
          onRepositoryRequired={() => {
            repository.requireRepository('create a project');
          }}
          onGenerate={props.draftActions.generateTo}
          onOpenImage={openImageEditor}
          runs={runs.allRuns}
          onCreate={() => {
            navigation.selectStudioView('create');
          }}
          onOpenRun={editor.openRun}
          onFavorite={props.favorites.toggleFavorite}
          onSortChange={navigation.setGallerySort}
        />
      )}
      {navigation.showsView('references') && (
        <ReferenceLibraryView
          folders={references.referenceLibraryQuery.data?.folders ?? []}
          isLoading={references.referenceLibraryQuery.isLoading}
          isMutating={references.isMutating}
          {...(references.referenceLibraryQuery.error instanceof Error
            ? { error: references.referenceLibraryQuery.error.message }
            : {})}
          onCreateFolder={() => {
            void references.createFolder();
          }}
          onRenameFolder={(folder) => {
            void references.renameFolder(folder);
          }}
          onDeleteFolder={(folder) => {
            void references.deleteFolder(folder);
          }}
          onAddImages={references.chooseUploads}
          onUseImage={props.onAttachReferenceImage}
          onRenameImage={(image) => {
            void references.renameImage(image);
          }}
          onDeleteImage={(image) => {
            void references.deleteImage(image);
          }}
          onRetry={() => {
            void references.refresh();
          }}
        />
      )}
      {navigation.showsView('presets') && (
        <PresetsView
          prompts={props.savedPrompts.savedPrompts}
          onUse={(value) => {
            props.promptDraft.setPrompt(value);
            navigation.selectStudioView('create');
          }}
          onDelete={props.savedPrompts.deletePrompt}
          onCreate={() => {
            navigation.selectStudioView('create');
          }}
        />
      )}
    </>
  );
}
