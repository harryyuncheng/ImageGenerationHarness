import { createContext, use, useRef, useState, type ReactNode, type RefObject } from 'react';
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
  capabilityBlockedReason: string | undefined;
  createShortcut: ShortcutBinding | null;
  focusedImageId: string | undefined;
  focusedRunId: string | undefined;
  focusedJobId: string | undefined;
  focusedOutputIndex: number | undefined;
}

function useStudioValue({
  confirm,
  prompt,
  repository,
  capabilities,
  providers,
  capabilityBlockedReason,
  createShortcut,
  focusedImageId,
  focusedRunId,
  focusedJobId,
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
  const selectedProvider = providers.find(
    (provider) => provider.providerId === settings.selectedCapability.providerId,
  );
  const styleGuide = useStyleGuide({
    activeRepositoryId,
    confirm,
    prompt,
    requireRepository: repository.requireRepository,
    attachments,
    settings,
  });
  const draftActions = useDraftActions({
    activeRepositoryId,
    promptDraft,
    settings,
    attachments,
    styleGuide,
    releaseRunDraft: runs.releaseDraft,
  });
  const viewer = useLoadedImage({
    activeRepositoryId,
    imageId: focusedImageId,
    runId: focusedRunId,
    jobId: focusedJobId,
    outputIndex: focusedOutputIndex,
    runs: runs.allRuns,
    runsLoading: runs.runsQuery.isLoading,
    shouldRestoreRun: (run) => !runs.wasSubmittedHere(run),
    onLoadSetup: draftActions.loadSetup,
    onCancelRun: (run) => {
      void runs.cancel(run);
    },
  });
  const generation = useGeneration({
    activeRepositoryId,
    promptDraft,
    settings,
    attachments,
    runs,
    createShortcut,
    capabilityBlockedReason:
      viewer?.setupBlockedReason ??
      capabilityBlockedReason ??
      (selectedProvider && !selectedProvider.configured ? selectedProvider.setupHint : undefined),
    requireRepository: repository.requireRepository,
  });

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
  focusedJobId: string | undefined;
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
  const { capabilities, providers, capabilitiesQuery } = useCapabilities();

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
        capabilityBlockedReason={
          capabilitiesQuery.error?.message ??
          (capabilitiesQuery.isPending ? 'Loading model configuration.' : undefined)
        }
        createShortcut={shortcuts.bindings.create}
        {...scope}
      >
        {children}
      </RepositoryScope>
    </ShellContext>
  );
}
