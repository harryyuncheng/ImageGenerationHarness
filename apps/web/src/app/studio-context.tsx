import { createContext, use, type ReactNode } from 'react';
import { useEditSource } from '../features/editor/use-edit-source.js';
import { useEditTools } from '../features/editor/use-edit-tools.js';
import { useUploadSelection } from '../features/editor/use-editor-focus.js';
import { useProjects } from '../features/gallery/use-projects.js';
import { imageDestination } from '../features/generation/destination.js';
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
import { useRepository, type RepositoryController } from '../features/repository/use-repository.js';
import { useTheme, type ThemeController } from '../features/theme/use-theme.js';
import { useClipboard } from '../shared/hooks/use-clipboard.js';
import { useToasts, type Notify, type Toast } from '../shared/hooks/use-toasts.js';
import type { Capability, Destination, GalleryImage } from '../shared/types/domain.js';
import { useStudioNavigate } from './use-studio-navigate.js';

interface ScopeProps {
  notify: Notify;
  repository: RepositoryController;
  capabilities: readonly Capability[];
  focusedRunId: string | undefined;
  selectedProjectId: string | undefined;
}

function useStudioValue({
  notify,
  repository,
  capabilities,
  focusedRunId,
  selectedProjectId,
}: ScopeProps) {
  const navigate = useStudioNavigate();
  const activeRepositoryId = repository.activeRepositoryId;

  const upload = useUploadSelection();
  const promptDraft = usePromptDraft();
  const settings = useGenerationSettings(capabilities);
  const attachments = useAttachments(notify);
  const destination = useDestination();
  const favorites = useFavorites();
  const savedPrompts = useSavedPrompts(notify);
  const editTools = useEditTools(capabilities);

  const runs = useRuns({
    activeRepositoryId,
    capabilities,
    favorites,
    notify,
    focusedRunId,
    onFocusedRunFailed: () => {
      navigate.goToCreate();
      promptDraft.focusPromptSoon();
    },
  });
  const generation = useGeneration({
    promptDraft,
    settings,
    attachments,
    destination,
    runs,
    notify,
    requireRepository: repository.requireRepository,
  });
  const draftActions = useDraftActions({
    promptDraft,
    settings,
    attachments,
    destination,
    notify,
  });
  const projects = useProjects({
    activeRepositoryId,
    selectedProjectId,
    destination,
    notify,
    requireRepository: repository.requireRepository,
  });
  const references = useReferenceLibrary({
    activeRepositoryId,
    notify,
    requireRepository: repository.requireRepository,
    removeLibraryImages: attachments.removeLibraryImages,
  });
  const editSource = useEditSource({
    promptDraft,
    settings,
    attachments,
    destination,
    upload,
    editTools,
    notify,
  });
  const attachReferenceImage = useReferenceAttachment({ attachments, settings, notify });

  const describeDestination = (value: Destination) =>
    runDestinationLabel(value, projects.projects, projects.selectedProjectQuery.data);

  return {
    navigate,
    notify,
    activeRepositoryId,
    repository,
    capabilities,
    upload,
    promptDraft,
    settings,
    attachments,
    destination,
    favorites,
    savedPrompts,
    editTools,
    runs,
    generation,
    draftActions,
    projects,
    references,
    editSource,
    attachReferenceImage,
    describeDestination,
    describeImageLocation: (image: GalleryImage) => describeDestination(imageDestination(image)),
  };
}

export type StudioValue = ReturnType<typeof useStudioValue>;

interface ShellValue {
  toasts: Toast[];
  dismissToast: (id: string) => void;
  copyText: (value: string, message?: string) => Promise<void>;
  theme: ThemeController;
}

const StudioContext = createContext<StudioValue | undefined>(undefined);
const ShellContext = createContext<ShellValue | undefined>(undefined);

export function useStudio(): StudioValue {
  const value = use(StudioContext);
  if (!value) throw new Error('useStudio must be used inside StudioProvider');
  return value;
}

export function useStudioShell(): ShellValue {
  const value = use(ShellContext);
  if (!value) throw new Error('useStudioShell must be used inside StudioProvider');
  return value;
}

function RepositoryScope({ children, ...scope }: ScopeProps & { children: ReactNode }) {
  const value = useStudioValue(scope);
  return <StudioContext value={value}>{children}</StudioContext>;
}

interface StudioProviderProps {
  focusedRunId: string | undefined;
  selectedProjectId: string | undefined;
  children: ReactNode;
}

/**
 * Repository-scoped state remounts whenever the active repository changes, which is
 * what keeps drafts, destinations, and optimistic runs from crossing repositories.
 */
export function StudioProvider({ children, ...scope }: StudioProviderProps) {
  const { toasts, notify, dismiss } = useToasts();
  const copyText = useClipboard(notify);
  const theme = useTheme();
  const repository = useRepository(notify);
  const { capabilities } = useCapabilities();

  return (
    <ShellContext value={{ toasts, dismissToast: dismiss, copyText, theme }}>
      <RepositoryScope
        key={repository.activeRepositoryId ?? 'none'}
        notify={notify}
        repository={repository}
        capabilities={capabilities}
        {...scope}
      >
        {children}
      </RepositoryScope>
    </ShellContext>
  );
}
