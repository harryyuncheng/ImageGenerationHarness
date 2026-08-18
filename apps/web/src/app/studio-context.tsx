import { createContext, use, type ReactNode } from 'react';
import { useLoadedImage } from '../features/editor/use-loaded-image.js';
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
import { useRepository, type RepositoryController } from '../features/repository/use-repository.js';
import { useTheme, type ThemeController } from '../features/theme/use-theme.js';
import { useToasts, type Notify, type Toast } from '../shared/hooks/use-toasts.js';
import type { Capability, Destination } from '../shared/types/domain.js';
import { useStudioNavigate } from './use-studio-navigate.js';

interface ScopeProps {
  notify: Notify;
  repository: RepositoryController;
  capabilities: readonly Capability[];
  focusedImageId: string | undefined;
  focusedRunId: string | undefined;
  selectedProjectId: string | undefined;
}

function useStudioValue({
  notify,
  repository,
  capabilities,
  focusedImageId,
  focusedRunId,
  selectedProjectId,
}: ScopeProps) {
  const navigate = useStudioNavigate();
  const activeRepositoryId = repository.activeRepositoryId;

  const promptDraft = usePromptDraft();
  const settings = useGenerationSettings(capabilities);
  const attachments = useAttachments(notify);
  const destination = useDestination();
  const favorites = useFavorites();
  const savedPrompts = useSavedPrompts(notify);

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
  const viewer = useLoadedImage({
    activeRepositoryId,
    imageId: focusedImageId,
    runId: focusedRunId,
    runs: runs.allRuns,
    onLoadImage: draftActions.loadImageDraft,
    onLoadRun: (run) => {
      if (!runs.wasSubmittedHere(run)) draftActions.loadRunDraft(run);
    },
    onCancelRun: (run) => {
      void runs.cancel(run);
    },
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
    promptDraft,
    settings,
    attachments,
    destination,
    favorites,
    savedPrompts,
    runs,
    generation,
    draftActions,
    projects,
    references,
    viewer,
    attachReferenceImage,
    describeDestination,
  };
}

export type StudioValue = ReturnType<typeof useStudioValue>;

interface ShellValue {
  toasts: Toast[];
  dismissToast: (id: string) => void;
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
  focusedImageId: string | undefined;
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
  const theme = useTheme();
  const repository = useRepository(notify);
  const { capabilities } = useCapabilities();

  return (
    <ShellContext value={{ toasts, dismissToast: dismiss, theme }}>
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
