import {
  createContext,
  use,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { useLoadedImage } from '../features/editor/use-loaded-image.js';
import { useAttachments } from '../features/generation/use-attachments.js';
import { useCapabilities } from '../features/generation/use-capabilities.js';
import { useDraftActions } from '../features/generation/use-draft-actions.js';
import { useGeneration } from '../features/generation/use-generation.js';
import { useGenerationSettings } from '../features/generation/use-generation-settings.js';
import { usePromptDraft } from '../features/generation/use-prompt-draft.js';
import { useRuns } from '../features/history/use-runs.js';
import { useSavedPrompts } from '../features/presets/use-saved-prompts.js';
import { useStyleGuide } from '../features/style-guide/use-style-guide.js';
import { useRepository, type RepositoryController } from '../features/repository/use-repository.js';
import { useTheme, type ThemeController } from '../features/theme/use-theme.js';
import {
  useDialogs,
  type Confirm,
  type DialogController,
  type Prompt,
} from '../shared/hooks/use-dialogs.js';
import { useShortcuts, type ShortcutController } from '../shared/hooks/use-shortcuts.js';
import type { ShortcutBinding } from '../shared/shortcuts.js';
import type { Capability, ProviderDescriptor } from '../shared/types/domain.js';
import type { SettingsTab } from './SettingsPanels.js';
import { useStudioNavigate } from './use-studio-navigate.js';

interface ScopeProps {
  confirm: Confirm;
  prompt: Prompt;
  repository: RepositoryController;
  capabilities: readonly Capability[];
  providers: readonly ProviderDescriptor[];
  createShortcut: ShortcutBinding | null;
  focusedImageId: string | undefined;
  focusedRunId: string | undefined;
  focusedOutputIndex: number | undefined;
}

function useStudioValue({
  confirm,
  prompt,
  repository,
  capabilities,
  providers,
  createShortcut,
  focusedImageId,
  focusedRunId,
  focusedOutputIndex,
}: ScopeProps) {
  const navigate = useStudioNavigate();
  const activeRepositoryId = repository.activeRepositoryId;

  const promptDraft = usePromptDraft();
  const settings = useGenerationSettings(capabilities);
  const attachments = useAttachments(settings.selectedCapability);
  const savedPrompts = useSavedPrompts({
    activeRepositoryId,
    requireRepository: repository.requireRepository,
    confirm,
    promptDraft,
  });

  const runs = useRuns({
    activeRepositoryId,
    capabilities,
    focusedRunId,
    onFocusedRunFailed: () => {
      navigate.closeFocus();
      promptDraft.focusPromptSoon();
    },
  });
  const generation = useGeneration({
    promptDraft,
    settings,
    attachments,
    runs,
    createShortcut,
    requireRepository: repository.requireRepository,
  });
  const draftActions = useDraftActions({
    promptDraft,
    settings,
    attachments,
  });
  const styleGuide = useStyleGuide({
    activeRepositoryId,
    confirm,
    prompt,
    requireRepository: repository.requireRepository,
    attachments,
    settings,
  });
  const viewer = useLoadedImage({
    activeRepositoryId,
    imageId: focusedImageId,
    runId: focusedRunId,
    outputIndex: focusedOutputIndex,
    runs: runs.allRuns,
    onLoadImage: draftActions.loadImageDraft,
    onLoadRun: (run) => {
      if (!runs.wasSubmittedHere(run)) draftActions.loadRunDraft(run);
    },
    onCancelRun: (run) => {
      void runs.cancel(run);
    },
  });
  const output = viewer?.selectedOutput;
  const { setSource } = attachments;
  useLayoutEffect(() => {
    if (!output) return;
    setSource({
      source: 'repository',
      id: output.imageId,
      imageId: output.imageId,
      name: output.name,
      previewUrl: output.url,
      mediaType: output.mediaType,
      byteLength: output.byteLength,
    });
  }, [
    output?.imageId,
    output?.url,
    output?.name,
    output?.mediaType,
    output?.byteLength,
    setSource,
  ]);

  return {
    navigate,
    activeRepositoryId,
    repository,
    capabilities,
    providers,
    promptDraft,
    settings,
    attachments,
    savedPrompts,
    runs,
    generation,
    draftActions,
    styleGuide,
    viewer,
  };
}

export type StudioValue = ReturnType<typeof useStudioValue>;

interface ShellValue {
  theme: ThemeController;
  dialogs: DialogController;
  shortcuts: ShortcutController;
  settingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;
  settingsTab: SettingsTab;
  setSettingsTab: (tab: SettingsTab) => void;
  settingsScrollPositions: RefObject<Partial<Record<SettingsTab, number>>>;
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
  focusedOutputIndex: number | undefined;
  children: ReactNode;
}

/**
 * Repository-scoped state remounts whenever the active repository changes, which is
 * what keeps drafts and optimistic runs from crossing repositories.
 */
export function StudioProvider({ children, ...scope }: StudioProviderProps) {
  const dialogs = useDialogs();
  const theme = useTheme();
  const shortcuts = useShortcuts();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('repository');
  const settingsScrollPositions = useRef<Partial<Record<SettingsTab, number>>>({});
  const repository = useRepository((open) => {
    if (open) setSettingsTab('repository');
    setSettingsOpen(open);
  });
  const { capabilities, providers } = useCapabilities();

  return (
    <ShellContext
      value={{
        theme,
        dialogs,
        shortcuts,
        settingsOpen,
        setSettingsOpen,
        settingsTab,
        setSettingsTab,
        settingsScrollPositions,
      }}
    >
      <RepositoryScope
        key={repository.activeRepositoryId ?? 'none'}
        confirm={dialogs.confirm}
        prompt={dialogs.prompt}
        repository={repository}
        capabilities={capabilities}
        providers={providers}
        createShortcut={shortcuts.bindings.create}
        {...scope}
      >
        {children}
      </RepositoryScope>
    </ShellContext>
  );
}
