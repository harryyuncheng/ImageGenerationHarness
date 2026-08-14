/* eslint-disable @typescript-eslint/no-confusing-void-expression */
import { CAPABILITY_REGISTRY_VERSION } from '@harness/capabilities/catalog';
import {
  MAX_IMAGE_BYTES,
  MAX_REQUEST_IMAGES,
  MEDIA_TYPES,
  apiErrorSchema,
  capabilitiesResponseSchema,
  galleryResponseSchema,
  generatedImageSidecarSchema,
  isMediaType,
  projectAssetDtoSchema,
  projectDetailResponseSchema,
  projectDtoSchema,
  projectsResponseSchema,
  queuedRunResponseSchema,
  referenceFolderDtoSchema,
  referenceImageDtoSchema,
  referenceLibraryResponseSchema,
  repositoryStatusSchema,
  runSnapshotSchema,
  runsResponseSchema,
  type GeneratedImageSidecar,
  type RunsResponse,
} from '@harness/contracts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bookmark,
  Check,
  CircleHelp,
  CloudOff,
  Copy,
  ChevronDown,
  FolderOpen,
  Grid2X2,
  History,
  HardDrive,
  Image as ImageIcon,
  Menu,
  Monitor,
  Moon,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Plus,
  SlidersHorizontal,
  Sparkles,
  Sun,
  X,
  type LucideIcon,
} from 'lucide-react';
import {
  type ChangeEvent,
  type DragEvent,
  type KeyboardEvent,
  type SyntheticEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { flushSync } from 'react-dom';
import {
  CreateView,
  EditToolsPanel,
  EditView,
  GalleryView,
  HistoryView,
  ImageEditor,
  Modal,
  PresetsView,
  ReferenceLibraryView,
  SettingsPanel,
  ShortcutList,
} from './StudioViews.js';
import {
  buildGenerationSubmission,
  capabilityLabel,
  defaultCapabilities,
  defaultSettings,
  maximumSeed,
  needsImage,
  requiresPrompt,
  supportedOutputFormats,
  type Attachment,
  type CapabilitiesResponse,
  type Capability,
  type Destination,
  type GalleryImage,
  type GalleryResponse,
  type GenerationSettings,
  type Project,
  type ProjectAsset,
  type ProjectDetailResponse,
  type ProjectsResponse,
  type ReferenceFolder,
  type ReferenceImage,
  type ReferenceLibraryResponse,
  type RepositoryStatus,
  type StudioRun,
  type StudioView,
  type ThemePreference,
  type UploadAttachment,
} from './studio.js';

type ModalName = 'code' | 'request' | 'shortcuts' | 'metadata' | null;
interface Toast {
  id: string;
  tone: 'success' | 'error' | 'info';
  message: string;
}

type ImageEditorSelection =
  | {
      kind: 'run';
      localId: string;
      remoteId?: string;
      fallback: StudioRun;
    }
  | {
      kind: 'image';
      image: GalleryImage;
      location: string;
      intent: 'view' | 'edit';
    }
  | {
      kind: 'upload';
      id: string;
      file: File;
      previewUrl: string;
      createdAt: string;
    };

const navItems: readonly { value: StudioView; label: string; Icon: LucideIcon }[] = [
  { value: 'edit', label: 'Edit', Icon: Pencil },
  { value: 'gallery', label: 'Gallery', Icon: Grid2X2 },
  { value: 'references', label: 'References', Icon: FolderOpen },
  { value: 'history', label: 'History', Icon: History },
  { value: 'presets', label: 'Saved presets', Icon: Bookmark },
];

const themeOptions: readonly {
  value: ThemePreference;
  label: string;
  Icon: LucideIcon;
}[] = [
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
  { value: 'system', label: 'System', Icon: Monitor },
];

type ResolvedTheme = Exclude<ThemePreference, 'system'>;

function resolveTheme(theme: ThemePreference, systemIsDark: boolean): ResolvedTheme {
  return theme === 'system' ? (systemIsDark ? 'dark' : 'light') : theme;
}

function applyResolvedTheme(theme: ResolvedTheme) {
  document.documentElement.dataset['theme'] = theme;
  document.documentElement.style.colorScheme = theme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', theme === 'dark' ? '#101010' : '#f7f7f7');
}

async function getCapabilities(): Promise<CapabilitiesResponse> {
  const response = await requestJson(
    '/api/capabilities',
    capabilitiesResponseSchema,
    {},
    'Capability registry unavailable',
  );
  if (response.registryVersion !== CAPABILITY_REGISTRY_VERSION) {
    throw new Error('The browser and server capability registries do not match.');
  }
  return response;
}

async function responseError(response: Response, fallback: string): Promise<Error> {
  try {
    const parsed = apiErrorSchema.safeParse(await response.json());
    return new Error(parsed.success ? parsed.data.error : fallback);
  } catch {
    return new Error(fallback);
  }
}

interface ResponseSchema<T> {
  parse(value: unknown): T;
}

async function requestJson<T>(
  url: string,
  schema: ResponseSchema<T>,
  init: RequestInit = {},
  fallback = 'The operation could not be completed.',
): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) throw await responseError(response, fallback);
  return schema.parse(await response.json());
}

async function requestVoid(
  url: string,
  init: RequestInit,
  fallback = 'The operation could not be completed.',
): Promise<void> {
  const response = await fetch(url, init);
  if (!response.ok) throw await responseError(response, fallback);
}

function getRepository(): Promise<RepositoryStatus> {
  return requestJson(
    '/api/repository',
    repositoryStatusSchema,
    {},
    'Repository status unavailable',
  );
}

function getProjects(): Promise<ProjectsResponse> {
  return requestJson('/api/projects', projectsResponseSchema, {}, 'Projects unavailable');
}

function getProjectDetail(projectId: string): Promise<ProjectDetailResponse> {
  return requestJson(
    `/api/projects/${projectId}`,
    projectDetailResponseSchema,
    {},
    'Project unavailable',
  );
}

function destinationQuery(destination: Destination): string {
  const query = new URLSearchParams({ destination: destination.kind });
  if (destination.kind !== 'main') query.set('projectId', destination.projectId);
  if (destination.kind === 'project-asset') {
    query.set('projectAssetId', destination.projectAssetId);
  }
  return query.toString();
}

function getRuns(): Promise<RunsResponse> {
  return requestJson(
    '/api/runs',
    runsResponseSchema,
    {},
    'Generation history unavailable',
  );
}

function getImages(destination?: Destination): Promise<GalleryResponse> {
  const suffix = destination ? `?${destinationQuery(destination)}` : '';
  return requestJson(`/api/images${suffix}`, galleryResponseSchema, {}, 'Gallery unavailable');
}

function getReferenceLibrary(): Promise<ReferenceLibraryResponse> {
  return requestJson(
    '/api/reference-library',
    referenceLibraryResponseSchema,
    {},
    'Reference library unavailable',
  );
}

function usePersistentState<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored ? (JSON.parse(stored) as T) : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue] as const;
}

function readAsData(file: File): Promise<UploadAttachment> {
  return new Promise((resolve, reject) => {
    if (!isMediaType(file.type)) {
      reject(new Error(`${file.name} is not a supported image type`));
      return;
    }
    const mediaType = file.type;
    const reader = new FileReader();
    reader.onerror = () => {
      reject(new Error(`Could not read ${file.name}`));
    };
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error(`Could not read ${file.name}`));
        return;
      }
      const comma = reader.result.indexOf(',');
      resolve({
        source: 'upload',
        id: crypto.randomUUID(),
        name: file.name,
        mediaType,
        byteLength: file.size,
        data: reader.result.slice(comma + 1),
        previewUrl: URL.createObjectURL(file),
      });
    };
    reader.readAsDataURL(file);
  });
}

function supportedImageFiles(files: readonly File[]): File[] {
  return files.filter((file) => isMediaType(file.type) && file.size <= MAX_IMAGE_BYTES);
}

function imageFileExtension(mediaType: GalleryImage['mediaType']): string {
  if (mediaType === 'image/jpeg') return 'jpg';
  if (mediaType === 'image/webp') return 'webp';
  return 'png';
}

async function readGalleryImageAsData(image: GalleryImage): Promise<UploadAttachment> {
  if (image.byteLength > MAX_IMAGE_BYTES) {
    throw new Error('This image is too large to use as an editing source.');
  }
  const response = await fetch(`/api/images/${image.imageId}/content`);
  if (!response.ok) throw new Error('Could not load the Baroque image.');
  const blob = await response.blob();
  if (blob.size > MAX_IMAGE_BYTES) {
    throw new Error('This image is too large to use as an editing source.');
  }
  const file = new File(
    [blob],
    `baroque-${image.imageId}.${imageFileExtension(image.mediaType)}`,
    { type: image.mediaType },
  );
  return readAsData(file);
}

function revokeUploadPreviews(attachments: readonly Attachment[]): void {
  for (const attachment of attachments) {
    if (attachment.source === 'upload') URL.revokeObjectURL(attachment.previewUrl);
  }
}

function resolveCapability(capabilities: readonly Capability[], targetId: string): Capability {
  const capability =
    capabilities.find((candidate) => candidate.canonicalId === targetId) ??
    capabilities.at(0) ??
    defaultCapabilities.at(0);
  if (!capability) throw new Error('The capability registry is empty');
  return capability;
}

export function App() {
  const queryClient = useQueryClient();
  const capabilitiesQuery = useQuery({ queryKey: ['capabilities'], queryFn: getCapabilities });
  const repositoryQuery = useQuery({
    queryKey: ['repository'],
    queryFn: getRepository,
    retry: false,
    refetchInterval: false,
  });
  const capabilities = capabilitiesQuery.data?.targets ?? defaultCapabilities;
  const activeRepositoryId = repositoryQuery.data?.active?.repositoryId;

  const [view, setView] = useState<StudioView>('create');
  const [destination, setDestination] = useState<Destination>({ kind: 'main' });
  const [selectedProjectId, setSelectedProjectId] = useState<string>();
  const [theme, setTheme] = usePersistentState<ThemePreference>('harness-theme', 'system');
  const selectedThemeIndex = Math.max(
    themeOptions.findIndex(({ value }) => value === theme),
    0,
  );
  const [persistedSettings, setSettings] = usePersistentState<GenerationSettings>(
    'harness-generation-settings',
    defaultSettings,
  );
  const settings = useMemo(
    () => ({ ...defaultSettings, ...persistedSettings }),
    [persistedSettings],
  );
  const [favoriteRunIds, setFavoriteRunIds] = usePersistentState<string[]>(
    'harness-favorite-runs',
    [],
  );
  const [optimisticRuns, setOptimisticRuns] = useState<StudioRun[]>([]);
  const [savedPrompts, setSavedPrompts] = usePersistentState<string[]>(
    'harness-saved-prompts',
    [],
  );
  const [prompt, setPrompt] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [selectedEditToolId, setSelectedEditToolId] = useState('service/inpaint');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(true);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [repositoryMenuOpen, setRepositoryMenuOpen] = useState(false);
  const [repositoryAttentionCount, setRepositoryAttentionCount] = useState(0);
  const [isRepositoryMutating, setIsRepositoryMutating] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [modal, setModal] = useState<ModalName>(null);
  const [imageEditor, setImageEditor] = useState<ImageEditorSelection>();
  const [metadata, setMetadata] = useState<GeneratedImageSidecar>();
  const [metadataError, setMetadataError] = useState<string>();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLibraryMutating, setIsLibraryMutating] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [libraryUploadFolderId, setLibraryUploadFolderId] = useState<string>();
  const fileInput = useRef<HTMLInputElement>(null);
  const libraryFileInput = useRef<HTMLInputElement>(null);
  const editFileInput = useRef<HTMLInputElement>(null);
  const promptInput = useRef<HTMLTextAreaElement>(null);
  const repositoryButton = useRef<HTMLButtonElement>(null);
  const repositoryAnchor = useRef<HTMLDivElement>(null);
  const handledFailureIds = useRef(new Set<string>());
  const discardedRunIds = useRef(new Set<string>());

  const projectsQuery = useQuery({
    queryKey: ['projects', activeRepositoryId],
    queryFn: getProjects,
    enabled: Boolean(activeRepositoryId),
    retry: false,
    refetchInterval: false,
  });
  const projects = projectsQuery.data?.projects ?? [];
  const selectedProjectQuery = useQuery({
    queryKey: ['project', activeRepositoryId, selectedProjectId],
    queryFn: () => getProjectDetail(selectedProjectId ?? ''),
    enabled: Boolean(activeRepositoryId && selectedProjectId),
    retry: false,
    refetchInterval: false,
  });
  const referenceLibraryQuery = useQuery({
    queryKey: ['reference-library', activeRepositoryId],
    queryFn: getReferenceLibrary,
    enabled: Boolean(activeRepositoryId),
    retry: false,
    refetchInterval: false,
  });
  const runsQuery = useQuery({
    queryKey: ['runs', activeRepositoryId, 'all'],
    queryFn: getRuns,
    enabled: Boolean(activeRepositoryId),
    retry: false,
    refetchInterval: 3000,
  });
  const imagesQuery = useQuery({
    queryKey: ['images', activeRepositoryId, 'all'],
    queryFn: () => getImages(),
    enabled: Boolean(
      activeRepositoryId &&
        (view === 'edit' || (selectedProjectId && view === 'gallery')),
    ),
    retry: false,
    refetchInterval: 3000,
  });

  const selectedCapability = resolveCapability(capabilities, settings.targetId);
  const editingTools = useMemo(
    () => capabilities.filter((capability) => capability.category === 'edit'),
    [capabilities],
  );
  const selectedEditingTool =
    editingTools.find((tool) => tool.canonicalId === selectedEditToolId) ??
    editingTools[0];
  const editingSelection = {
    tools: editingTools,
    selectedToolId: selectedEditingTool?.canonicalId ?? selectedEditToolId,
    onSelectTool: (toolId: string) => setSelectedEditToolId(toolId),
  };
  const requestBody = useMemo(
    () => buildGenerationSubmission(selectedCapability, prompt, settings, attachments, destination),
    [attachments, destination, prompt, selectedCapability, settings],
  );
  const favoriteRuns = useMemo(() => new Set(favoriteRunIds), [favoriteRunIds]);
  const generationFailures = useMemo(() => {
    const failures = new Map<string, { error: string; discarded: boolean }>();
    for (const failure of runsQuery.data?.failures ?? []) {
      failures.set(failure.runId, {
        error: failure.error,
        discarded: failure.discarded,
      });
    }
    for (const { run, jobs } of runsQuery.data?.runs ?? []) {
      if (run.status !== 'failed') continue;
      failures.set(run.runId, {
        error: jobs.find((job) => job.errorMessage)?.errorMessage ?? 'Generation failed.',
        discarded: true,
      });
    }
    return [...failures].map(([runId, failure]) => ({ runId, ...failure }));
  }, [runsQuery.data]);
  const durableRuns = useMemo<StudioRun[]>(
    () =>
      (runsQuery.data?.runs ?? []).filter(({ run }) => run.status !== 'failed').map(({ run, jobs }) => {
        const capability = resolveCapability(capabilities, run.targetId);
        const error = jobs.find((job) => job.errorMessage)?.errorMessage;
        return {
          id: run.runId,
          remoteId: run.runId,
          createdAt: run.createdAt,
          updatedAt: run.updatedAt,
          prompt: run.prompt ?? '',
          targetId: run.targetId,
          targetName: capabilityLabel(capability),
          aspectRatio: 'saved settings',
          outputCount: run.requestedJobCount,
          attachmentNames: [],
          outputImageIds: jobs.flatMap((job) => job.outputImageIds),
          destination: run.destination,
          status: run.status,
          ...(error ? { error } : {}),
          favorite: favoriteRuns.has(run.runId),
        };
      }),
    [capabilities, favoriteRuns, runsQuery.data?.runs],
  );
  const durableIds = new Set(durableRuns.map((run) => run.remoteId));
  const allRuns = [
    ...optimisticRuns.filter((run) => !durableIds.has(run.remoteId)),
    ...durableRuns,
  ].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  const recentRuns = [...allRuns].sort(
    (left, right) =>
      right.updatedAt.localeCompare(left.updatedAt) ||
      right.createdAt.localeCompare(left.createdAt),
  );
  const selectedEditorRun =
    imageEditor?.kind === 'run'
      ? allRuns.find(
          (run) =>
            run.id === imageEditor.localId ||
            (imageEditor.remoteId !== undefined &&
              (run.id === imageEditor.remoteId || run.remoteId === imageEditor.remoteId)),
        ) ?? imageEditor.fallback
      : undefined;
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const applyTheme = () => {
      applyResolvedTheme(resolveTheme(theme, media.matches));
    };
    applyTheme();
    media.addEventListener('change', applyTheme);
    return () => {
      media.removeEventListener('change', applyTheme);
    };
  }, [theme]);

  const changeTheme = (value: ThemePreference) => {
    if (value === theme) return;

    const updateTheme = () => {
      flushSync(() => {
        setTheme(value);
      });
      applyResolvedTheme(
        resolveTheme(value, window.matchMedia('(prefers-color-scheme: dark)').matches),
      );
    };

    if (
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      typeof document.startViewTransition !== 'function'
    ) {
      updateTheme();
      return;
    }

    document.startViewTransition(updateTheme);
  };

  useEffect(() => {
    const formats = supportedOutputFormats(selectedCapability);
    const seedMaximum = maximumSeed(selectedCapability);
    setSettings((current) => {
      const outputFormat = formats.includes(current.outputFormat)
        ? current.outputFormat
        : (formats.includes('png') ? 'png' : formats[0]) ?? 'png';
      const seed =
        seedMaximum === undefined ? current.seed : Math.min(current.seed, seedMaximum);
      return outputFormat === current.outputFormat && seed === current.seed
        ? current
        : { ...current, outputFormat, seed };
    });
  }, [selectedCapability.canonicalId, selectedCapability.outputFormats, selectedCapability.seedMaximum, setSettings]);

  useEffect(() => {
    setDestination({ kind: 'main' });
    setSelectedProjectId(undefined);
    setOptimisticRuns([]);
    handledFailureIds.current.clear();
    discardedRunIds.current.clear();
    setImageEditor(undefined);
    setAttachments((current) => {
      revokeUploadPreviews(current);
      return [];
    });
  }, [activeRepositoryId]);

  const uploadedEditorPreviewUrl =
    imageEditor?.kind === 'upload' ? imageEditor.previewUrl : undefined;
  useEffect(() => {
    if (!uploadedEditorPreviewUrl) return;
    return () => {
      URL.revokeObjectURL(uploadedEditorPreviewUrl);
    };
  }, [uploadedEditorPreviewUrl]);

  useEffect(() => {
    const unhandled = generationFailures.filter(
      (failure) => !handledFailureIds.current.has(failure.runId),
    );
    for (const failure of generationFailures) {
      if (failure.discarded) discardedRunIds.current.add(failure.runId);
    }
    for (const failure of unhandled) {
      handledFailureIds.current.add(failure.runId);
    }
    const failedIds = discardedRunIds.current;
    if (failedIds.size === 0 && unhandled.length === 0) return;
    setOptimisticRuns((current) => {
      const remaining = current.filter(
        (run) => !failedIds.has(run.id) && (!run.remoteId || !failedIds.has(run.remoteId)),
      );
      return remaining.length === current.length ? current : remaining;
    });
    setFavoriteRunIds((current) => {
      const remaining = current.filter((runId) => !failedIds.has(runId));
      return remaining.length === current.length ? current : remaining;
    });
    const failedEditorIsOpen =
      imageEditor?.kind === 'run' &&
      (failedIds.has(imageEditor.localId) ||
        (imageEditor.remoteId !== undefined && failedIds.has(imageEditor.remoteId)));
    if (failedEditorIsOpen) {
      setImageEditor(undefined);
      setView('create');
      window.setTimeout(() => promptInput.current?.focus(), 0);
    }
    for (const failure of unhandled) notify(failure.error, 'error');
  }, [generationFailures, imageEditor, optimisticRuns, setFavoriteRunIds]);

  useEffect(() => {
    const handleGlobalKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        setModal(null);
        setModelMenuOpen(false);
        setThemeMenuOpen(false);
        setRepositoryMenuOpen(false);
      }
      if ((event.metaKey || event.ctrlKey) && event.key === '/') {
        event.preventDefault();
        setModal('shortcuts');
      }
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'o') {
        event.preventDefault();
        fileInput.current?.click();
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        promptInput.current?.focus();
      }
    };
    window.addEventListener('keydown', handleGlobalKey);
    return () => {
      window.removeEventListener('keydown', handleGlobalKey);
    };
  }, []);

  useEffect(() => {
    if (!repositoryMenuOpen) return;
    const handleOutsidePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !repositoryAnchor.current?.contains(event.target)) {
        setRepositoryMenuOpen(false);
      }
    };
    document.addEventListener('pointerdown', handleOutsidePointerDown);
    return () => {
      document.removeEventListener('pointerdown', handleOutsidePointerDown);
    };
  }, [repositoryMenuOpen]);

  function updateSettings<K extends keyof GenerationSettings>(
    key: K,
    value: GenerationSettings[K],
  ) {
    setSettings((current) => ({ ...current, [key]: value }));
  }

  function notify(message: string, tone: Toast['tone'] = 'info') {
    const id = crypto.randomUUID();
    setToasts((current) => [...current, { id, message, tone }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 3800);
  }

  async function performMutation<T>(
    operation: () => Promise<T>,
    fallback: string,
  ): Promise<{ ok: true; value: T } | { ok: false }> {
    try {
      return { ok: true, value: await operation() };
    } catch (error) {
      notify(error instanceof Error ? error.message : fallback, 'error');
      return { ok: false };
    }
  }

  async function performLibraryMutation<T>(
    operation: () => Promise<T>,
    fallback: string,
  ): Promise<{ ok: true; value: T } | { ok: false }> {
    setIsLibraryMutating(true);
    try {
      return await performMutation(operation, fallback);
    } finally {
      setIsLibraryMutating(false);
    }
  }

  function clearRepositoryQueries() {
    queryClient.removeQueries({
      predicate: (query) =>
        ['projects', 'project', 'reference-library', 'runs', 'images'].includes(
          String(query.queryKey[0]),
        ),
    });
  }

  function requireRepository(action: string): boolean {
    if (activeRepositoryId) return true;
    setRepositoryMenuOpen(true);
    setRepositoryAttentionCount((current) => current + 1);
    notify(`Choose an image repository to ${action}.`);
    window.requestAnimationFrame(() => repositoryButton.current?.focus());
    return false;
  }

  async function selectRepository(endpoint: string) {
    setIsRepositoryMutating(true);
    try {
      const result = await performMutation(
        () => requestJson(endpoint, repositoryStatusSchema, { method: 'POST' }),
        'Could not select the repository.',
      );
      if (!result.ok) return;
      const status = result.value;
      clearRepositoryQueries();
      queryClient.setQueryData(['repository'], status);
      setRepositoryMenuOpen(false);
      if (status.active) notify(`Using ${status.active.name}.`, 'success');
    } finally {
      setIsRepositoryMutating(false);
    }
  }

  async function createProject(input: { name: string; description: string }) {
    if (!requireRepository('create a project')) return;
    const result = await performMutation(
      () =>
        requestJson(
        '/api/projects',
        projectDtoSchema,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(input),
        },
        'Could not create the project.',
        ),
      'Could not create the project.',
    );
    if (!result.ok) return;
    await queryClient.invalidateQueries({ queryKey: ['projects', activeRepositoryId] });
    setSelectedProjectId(result.value.projectId);
    notify('Project created.', 'success');
  }

  async function updateProject(
    projectId: string,
    input: { name: string; description: string },
  ) {
    const result = await performMutation(
      () =>
        requestJson(
          `/api/projects/${projectId}`,
          projectDtoSchema,
          {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(input),
          },
          'Could not update the project.',
        ),
      'Could not update the project.',
    );
    if (!result.ok) return;
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['projects', activeRepositoryId] }),
      queryClient.invalidateQueries({ queryKey: ['project', activeRepositoryId, projectId] }),
    ]);
    notify('Project updated.', 'success');
  }

  async function deleteProject(project: Project) {
    if (!window.confirm(`Delete “${project.name}”, its nested assets, and all of its images?`)) return;
    const result = await performMutation(
      () =>
        requestVoid(
          `/api/projects/${project.projectId}`,
          { method: 'DELETE' },
          'Could not delete the project.',
        ),
      'Could not delete the project.',
    );
    if (!result.ok) return;
    if (destination.kind !== 'main' && destination.projectId === project.projectId) {
      setDestination({ kind: 'main' });
    }
    setSelectedProjectId(undefined);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['projects', activeRepositoryId] }),
      queryClient.invalidateQueries({ queryKey: ['images', activeRepositoryId] }),
      queryClient.invalidateQueries({ queryKey: ['runs', activeRepositoryId] }),
    ]);
    notify('Project deleted.', 'success');
  }

  async function createProjectAsset(
    projectId: string,
    input: { name: string; description: string },
  ) {
    const result = await performMutation(
      () =>
        requestJson(
          `/api/projects/${projectId}/assets`,
          projectAssetDtoSchema,
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(input),
          },
          'Could not create the asset.',
        ),
      'Could not create the asset.',
    );
    if (!result.ok) return;
    await queryClient.invalidateQueries({
      queryKey: ['project', activeRepositoryId, projectId],
    });
    notify('Project asset created.', 'success');
  }

  async function editProjectAsset(asset: ProjectAsset) {
    const name = window.prompt('Asset name', asset.name);
    if (!name?.trim()) return;
    const description = window.prompt('Asset description', asset.description);
    if (description === null) return;
    const result = await performMutation(
      () =>
        requestJson(
          `/api/projects/${asset.projectId}/assets/${asset.assetId}`,
          projectAssetDtoSchema,
          {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ name: name.trim(), description }),
          },
          'Could not update the asset.',
        ),
      'Could not update the asset.',
    );
    if (!result.ok) return;
    await queryClient.invalidateQueries({
      queryKey: ['project', activeRepositoryId, asset.projectId],
    });
    notify('Project asset updated.', 'success');
  }

  async function deleteProjectAsset(asset: ProjectAsset) {
    if (!window.confirm(`Delete “${asset.name}” and all images generated in it?`)) return;
    const result = await performMutation(
      () =>
        requestVoid(
          `/api/projects/${asset.projectId}/assets/${asset.assetId}`,
          { method: 'DELETE' },
          'Could not delete the asset.',
        ),
      'Could not delete the asset.',
    );
    if (!result.ok) return;
    if (
      destination.kind === 'project-asset' &&
      destination.projectAssetId === asset.assetId
    ) {
      setDestination({ kind: 'project', projectId: asset.projectId });
    }
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ['project', activeRepositoryId, asset.projectId],
      }),
      queryClient.invalidateQueries({ queryKey: ['images', activeRepositoryId] }),
      queryClient.invalidateQueries({ queryKey: ['runs', activeRepositoryId] }),
    ]);
    notify('Project asset deleted.', 'success');
  }

  function generateTo(nextDestination: Destination) {
    setDestination(nextDestination);
    setView('create');
    window.setTimeout(() => promptInput.current?.focus(), 0);
  }

  async function viewMetadata(imageId: string) {
    setMetadata(undefined);
    setMetadataError(undefined);
    setModal('metadata');
    try {
      setMetadata(
        await requestJson(
          `/api/images/${imageId}/metadata`,
          generatedImageSidecarSchema,
          {},
          'Image metadata unavailable',
        ),
      );
    } catch (error) {
      setMetadataError(error instanceof Error ? error.message : 'Image metadata unavailable');
    }
  }

  async function cancelRun(run: StudioRun) {
    if (!run.remoteId) return;
    const result = await performMutation(
      () =>
        requestJson(
          `/api/runs/${run.remoteId ?? ''}/cancel`,
          runSnapshotSchema,
          { method: 'POST' },
          'Could not cancel the run.',
        ),
      'Could not cancel the run.',
    );
    if (!result.ok) return;
    await queryClient.invalidateQueries({ queryKey: ['runs', activeRepositoryId] });
    notify('Queued work cancelled. Active Bedrock calls may still finish.', 'success');
  }

  async function retryRun(run: StudioRun) {
    if (!run.remoteId) return;
    const result = await performMutation(
      () =>
        requestJson(
          `/api/runs/${run.remoteId ?? ''}/retry`,
          queuedRunResponseSchema,
          { method: 'POST' },
          'Could not retry the run.',
        ),
      'Could not retry the run.',
    );
    if (!result.ok) return;
    await queryClient.invalidateQueries({ queryKey: ['runs', activeRepositoryId] });
    notify('Run queued for an explicit retry.', 'success');
  }

  async function addFiles(files: File[]) {
    const accepted = supportedImageFiles(files);
    if (accepted.length !== files.length) {
      notify('Use PNG, JPEG, or WebP images up to 10 MB.', 'error');
    }
    const remainingSlots = Math.max(0, MAX_REQUEST_IMAGES - attachments.length);
    try {
      const loaded = await Promise.all(accepted.slice(0, remainingSlots).map(readAsData));
      setAttachments((current) => [...current, ...loaded]);
      if (accepted.length > remainingSlots) notify('A prompt can contain up to four images.');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not read the image.', 'error');
    }
  }

  function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    void addFiles(Array.from(event.target.files ?? []));
    event.target.value = '';
  }

  function openEditFile(files: readonly File[]) {
    const file = files[0];
    if (!file) return;
    if (supportedImageFiles([file]).length === 0) {
      notify('Use a PNG, JPEG, or WebP image up to 10 MB.', 'error');
      return;
    }
    setImageEditor({
      kind: 'upload',
      id: crypto.randomUUID(),
      file,
      previewUrl: URL.createObjectURL(file),
      createdAt: new Date().toISOString(),
    });
    setView('edit');
  }

  function handleEditFile(event: ChangeEvent<HTMLInputElement>) {
    openEditFile(Array.from(event.target.files ?? []));
    event.target.value = '';
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragActive(false);
    void addFiles(Array.from(event.dataTransfer.files));
  }

  function removeAttachment(id: string) {
    setAttachments((current) => {
      const attachment = current.find((item) => item.id === id);
      if (attachment?.source === 'upload') URL.revokeObjectURL(attachment.previewUrl);
      return current.filter((item) => item.id !== id);
    });
  }

  function resetWorkspace() {
    revokeUploadPreviews(attachments);
    setAttachments([]);
    setPrompt('');
    setDestination({ kind: 'main' });
    setImageEditor(undefined);
    setView('create');
    window.setTimeout(() => promptInput.current?.focus(), 0);
  }

  function selectModel(capability: Capability) {
    updateSettings('targetId', capability.canonicalId);
    setModelMenuOpen(false);
    if (needsImage(capability) && attachments.length === 0) {
      notify(`${capabilityLabel(capability)} needs a source image.`);
    }
  }

  async function refreshReferenceLibrary() {
    await referenceLibraryQuery.refetch();
  }

  async function renameReferenceRecord(options: {
    prompt: string;
    currentName: string;
    endpoint: string;
    fallback: string;
  }): Promise<void> {
    const name = window.prompt(options.prompt, options.currentName);
    if (!name?.trim() || name.trim() === options.currentName) return;
    await performLibraryMutation(async () => {
      await requestVoid(
        options.endpoint,
        {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name: name.trim() }),
        },
        options.fallback,
      );
      await refreshReferenceLibrary();
    }, options.fallback);
  }

  async function createReferenceFolder() {
    if (!requireRepository('create a reference folder')) return;
    const name = window.prompt('Folder name, such as “Editorial lighting” or “Anime styles”');
    if (!name?.trim()) return;
    const result = await performLibraryMutation(async () => {
      await requestJson(
        '/api/reference-folders',
        referenceFolderDtoSchema,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name: name.trim() }),
        },
        'Could not create the folder.',
      );
      await refreshReferenceLibrary();
    }, 'Could not create the folder.');
    if (result.ok) notify('Reference folder created.', 'success');
  }

  async function renameReferenceFolder(folder: ReferenceFolder) {
    await renameReferenceRecord({
      prompt: 'Rename folder',
      currentName: folder.name,
      endpoint: `/api/reference-folders/${folder.folderId}`,
      fallback: 'Could not rename the folder.',
    });
  }

  async function deleteReferenceFolder(folder: ReferenceFolder) {
    if (!window.confirm(`Delete “${folder.name}” and remove its images from the library?`)) return;
    const result = await performLibraryMutation(async () => {
      await requestVoid(
        `/api/reference-folders/${folder.folderId}`,
        { method: 'DELETE' },
        'Could not remove the folder.',
      );
      await refreshReferenceLibrary();
    }, 'Could not remove the folder.');
    if (!result.ok) return;
    setAttachments((current) =>
      current.filter(
        (attachment) =>
          attachment.source !== 'library' || attachment.folderId !== folder.folderId,
      ),
    );
    notify('Reference folder removed.', 'success');
  }

  function chooseLibraryUploads(folderId: string) {
    setLibraryUploadFolderId(folderId);
    libraryFileInput.current?.click();
  }

  async function handleLibraryFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    const folderId = libraryUploadFolderId;
    if (!folderId || files.length === 0) return;
    const accepted = supportedImageFiles(files);
    if (accepted.length !== files.length) {
      notify('Use PNG, JPEG, or WebP images up to 10 MB.', 'error');
    }
    if (accepted.length === 0) return;
    const result = await performLibraryMutation(async () => {
      const uploads: UploadAttachment[] = [];
      try {
        for (const file of accepted) {
          const upload = await readAsData(file);
          uploads.push(upload);
          await requestJson(
            `/api/reference-folders/${folderId}/images`,
            referenceImageDtoSchema,
            {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({
                name: upload.name,
                mediaType: upload.mediaType,
                data: upload.data,
              }),
            },
            'Could not upload the image.',
          );
        }
      } finally {
        revokeUploadPreviews(uploads);
      }
      await refreshReferenceLibrary();
    }, 'Could not upload the images.');
    if (!result.ok) {
      await refreshReferenceLibrary();
      return;
    }
    notify(
      `${String(accepted.length)} reference image${accepted.length === 1 ? '' : 's'} added.`,
      'success',
    );
  }

  async function renameReferenceImage(image: ReferenceImage) {
    await renameReferenceRecord({
      prompt: 'Rename reference image',
      currentName: image.name,
      endpoint: `/api/reference-folders/${image.folderId}/images/${image.imageId}`,
      fallback: 'Could not rename the image.',
    });
  }

  async function deleteReferenceImage(image: ReferenceImage) {
    if (!window.confirm(`Remove “${image.name}” from the reference library?`)) return;
    const result = await performLibraryMutation(async () => {
      await requestVoid(
        `/api/reference-folders/${image.folderId}/images/${image.imageId}`,
        { method: 'DELETE' },
        'Could not remove the image.',
      );
      await refreshReferenceLibrary();
    }, 'Could not remove the image.');
    if (!result.ok) return;
    setAttachments((current) =>
      current.filter(
        (attachment) =>
          attachment.source !== 'library' || attachment.imageId !== image.imageId,
      ),
    );
    notify('Reference image removed.', 'success');
  }

  function useReferenceImage(image: ReferenceImage) {
    if (
      attachments.some(
        (attachment) => attachment.source === 'library' && attachment.imageId === image.imageId,
      )
    ) {
      notify('That reference is already attached.');
      setView('create');
      return;
    }
    if (attachments.length >= MAX_REQUEST_IMAGES) {
      notify('A prompt can contain up to four images.', 'error');
      return;
    }
    setAttachments((current) => [
      ...current,
      {
        source: 'library',
        id: `library:${image.imageId}`,
        folderId: image.folderId,
        imageId: image.imageId,
        name: image.name,
        mediaType: image.mediaType,
        byteLength: image.byteLength,
        previewUrl: `/api/reference-folders/${image.folderId}/images/${image.imageId}/content`,
      },
    ]);
    if (selectedCapability.canonicalId === 'generation/core') {
      updateSettings('targetId', 'generation/sd3.5-large');
    }
    setView('create');
    notify('Reference image attached.', 'success');
  }

  async function generate(event?: SyntheticEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (!requireRepository('generate images')) return;
    if (!prompt.trim() && requiresPrompt(selectedCapability)) {
      notify('Describe the image you want to create.', 'error');
      promptInput.current?.focus();
      return;
    }
    if (needsImage(selectedCapability) && attachments.length === 0) {
      notify('Add a source image for this tool.', 'error');
      fileInput.current?.click();
      return;
    }
    if (selectedCapability.canonicalId === 'service/style-transfer' && attachments.length < 2) {
      notify('Style Transfer needs a source image and a style reference.', 'error');
      fileInput.current?.click();
      return;
    }
    if (
      selectedCapability.canonicalId === 'service/search-recolor' &&
      !settings.selectPrompt.trim()
    ) {
      notify('Describe the object or area to recolor in Run settings.', 'error');
      return;
    }
    if (
      selectedCapability.canonicalId === 'service/search-replace' &&
      !settings.searchPrompt.trim()
    ) {
      notify('Describe the object to replace in Run settings.', 'error');
      return;
    }

    const localId = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const baseRun: StudioRun = {
      id: localId,
      createdAt,
      updatedAt: createdAt,
      prompt,
      targetId: selectedCapability.canonicalId,
      targetName: capabilityLabel(selectedCapability),
      aspectRatio: settings.aspectRatio,
      outputCount: settings.outputCount,
      attachmentNames: attachments.map((attachment) => attachment.name),
      outputImageIds: [],
      destination,
      status: 'submitting',
      favorite: false,
    };
    setOptimisticRuns((current) => [baseRun, ...current].slice(0, 20));
    setImageEditor({ kind: 'run', localId, fallback: baseRun });
    setIsSubmitting(true);

    try {
      const { runId: remoteId } = await requestJson(
        '/api/runs',
        queuedRunResponseSchema,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(requestBody),
        },
        'The local control plane could not queue this run.',
      );
      setOptimisticRuns((current) =>
        current.map((run) =>
          run.id === localId ? { ...run, remoteId, status: 'queued' } : run,
        ),
      );
      setImageEditor((current) =>
        current?.kind === 'run' && current.localId === localId
          ? {
              ...current,
              remoteId,
              fallback: { ...current.fallback, remoteId, status: 'queued' },
            }
          : current,
      );
      void queryClient.invalidateQueries({ queryKey: ['runs', activeRepositoryId] });
      notify(
        `${String(settings.outputCount)} image${settings.outputCount === 1 ? '' : 's'} queued.`,
        'success',
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Generation could not be queued.';
      setOptimisticRuns((current) => current.filter((run) => run.id !== localId));
      setImageEditor((current) =>
        current?.kind === 'run' && current.localId === localId ? undefined : current,
      );
      setView('create');
      window.setTimeout(() => promptInput.current?.focus(), 0);
      notify(message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  }

  function handlePromptKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      void generate();
    }
  }

  function toggleFavorite(runId: string) {
    setFavoriteRunIds((current) =>
      current.includes(runId)
        ? current.filter((candidate) => candidate !== runId)
        : [runId, ...current],
    );
  }

  function reuseRun(run: StudioRun) {
    setPrompt(run.prompt);
    updateSettings('targetId', run.targetId);
    if (run.aspectRatio !== 'saved settings') updateSettings('aspectRatio', run.aspectRatio);
    setDestination(run.destination);
    setView('create');
    notify('Settings restored. Add source images again if needed.', 'success');
  }

  function selectStudioView(nextView: StudioView) {
    setImageEditor(undefined);
    setView(nextView);
  }

  function openRunEditor(run: StudioRun) {
    setImageEditor({
      kind: 'run',
      localId: run.id,
      ...(run.remoteId ? { remoteId: run.remoteId } : {}),
      fallback: run,
    });
  }

  function openImageEditor(
    image: GalleryImage,
    location: string,
    intent: 'view' | 'edit' = 'view',
  ) {
    setImageEditor({ kind: 'image', image, location, intent });
  }

  function editorMatchesRun(run: StudioRun): boolean {
    if (imageEditor?.kind === 'image') {
      return run.id === imageEditor.image.runId || run.remoteId === imageEditor.image.runId;
    }
    if (imageEditor?.kind !== 'run') return false;
    return (
      run.id === imageEditor.localId ||
      (imageEditor.remoteId !== undefined &&
        (run.remoteId === imageEditor.remoteId || run.id === imageEditor.remoteId))
    );
  }

  function runDestinationLabel(value: Destination): string {
    if (value.kind === 'main') return 'Main repository';
    const project = projects.find((candidate) => candidate.projectId === value.projectId);
    if (value.kind === 'project') return project?.name ?? 'Project';
    const asset =
      selectedProjectQuery.data?.project.projectId === value.projectId
        ? selectedProjectQuery.data.assets.find(
            (candidate) => candidate.assetId === value.projectAssetId,
          )
        : undefined;
    return asset
      ? `${project?.name ?? 'Project'} / ${asset.name}`
      : (project?.name ?? 'Project asset');
  }

  function imageDestination(image: GalleryImage): Destination {
    if (!image.projectId) return { kind: 'main' };
    if (!image.projectAssetId) return { kind: 'project', projectId: image.projectId };
    return {
      kind: 'project-asset',
      projectId: image.projectId,
      projectAssetId: image.projectAssetId,
    };
  }

  function replaceAttachmentsForEditing(attachment: UploadAttachment) {
    setAttachments((current) => {
      revokeUploadPreviews(current);
      return [attachment];
    });
  }

  async function editBaroqueImage(image: GalleryImage) {
    if (!selectedEditingTool) {
      notify('No image editing tools are available.', 'error');
      return;
    }
    const result = await performMutation(
      () => readGalleryImageAsData(image),
      'Could not prepare the Baroque image for editing.',
    );
    if (!result.ok) return;
    replaceAttachmentsForEditing(result.value);
    setPrompt(image.prompt ?? '');
    updateSettings('targetId', selectedEditingTool.canonicalId);
    setDestination(imageDestination(image));
    setImageEditor(undefined);
    setView('create');
    notify('Image added as the editing source.', 'success');
  }

  async function editUploadedImage(
    selection: Extract<ImageEditorSelection, { kind: 'upload' }>,
  ) {
    if (!selectedEditingTool) {
      notify('No image editing tools are available.', 'error');
      return;
    }
    const result = await performMutation(
      () => readAsData(selection.file),
      'Could not prepare the uploaded image for editing.',
    );
    if (!result.ok) return;
    replaceAttachmentsForEditing(result.value);
    setPrompt('');
    updateSettings('targetId', selectedEditingTool.canonicalId);
    setDestination({ kind: 'main' });
    setImageEditor(undefined);
    setView('create');
    notify('Image added as the editing source.', 'success');
  }

  function startSelectedEdit() {
    if (imageEditor?.kind === 'upload') {
      void editUploadedImage(imageEditor);
      return;
    }
    if (imageEditor?.kind === 'image' && imageEditor.intent === 'edit') {
      void editBaroqueImage(imageEditor.image);
    }
  }

  function remixImage(image: GalleryImage) {
    setPrompt(image.prompt ?? '');
    updateSettings('targetId', image.targetId);
    setDestination(imageDestination(image));
    setView('create');
    notify('Prompt, model, and destination restored. Add source images again if needed.', 'success');
  }

  function saveCurrentPrompt() {
    const value = prompt.trim();
    if (!value) {
      notify('Write a prompt before saving it.', 'error');
      return;
    }
    if (!savedPrompts.includes(value)) setSavedPrompts((current) => [value, ...current]);
    notify('Prompt saved to presets.', 'success');
  }

  async function copyText(value: string, message = 'Copied to clipboard.') {
    await navigator.clipboard.writeText(value);
    notify(message, 'success');
  }

  function chooseRandomSeed() {
    const value = crypto.getRandomValues(new Uint32Array(1)).at(0) ?? 0;
    const seedMaximum = maximumSeed(selectedCapability);
    updateSettings(
      'seed',
      seedMaximum === undefined ? 0 : value % (seedMaximum + 1),
    );
  }

  const codeExample = `const response = await fetch('/api/runs', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(${JSON.stringify(requestBody, null, 2)})
});

const run = await response.json();`;

const showCreateWorkspace = view === 'create' && imageEditor === undefined;
const showSettings = showCreateWorkspace && settingsOpen;
const showEditWorkspace =
  view === 'edit' &&
  (imageEditor === undefined ||
    imageEditor.kind === 'upload' ||
    (imageEditor.kind === 'image' && imageEditor.intent === 'edit'));
const hasEditSource =
  imageEditor?.kind === 'upload' ||
  (imageEditor?.kind === 'image' && imageEditor.intent === 'edit');
const panelCapable = showCreateWorkspace || showEditWorkspace;
const panelOpen = showSettings || showEditWorkspace;

return (
    <div className={`studio-shell ${panelCapable ? 'studio-shell--panel-capable' : ''} ${panelOpen ? 'studio-shell--panel-open' : ''}`}>
      <aside className={`left-rail ${sidebarOpen ? '' : 'left-rail--collapsed'}`}>
        <div className="brand-row">
          <button className="brand" onClick={resetWorkspace} aria-label="Open Baroque home">
            <span className="brand-mark"><Palette size={21} /></span>
            {sidebarOpen && <span>Baroque</span>}
          </button>
        </div>
        <button className="new-button" onClick={resetWorkspace}>
          <Plus size={18} />{sidebarOpen && <span>New image</span>}
        </button>
        <nav className="primary-nav" aria-label="Studio navigation">
          {navItems.map(({ value, label, Icon }) => (
            <button key={value} className={imageEditor === undefined && view === value ? 'active' : ''} onClick={() => selectStudioView(value)} title={sidebarOpen ? undefined : label}>
              <Icon size={18} />{sidebarOpen && <span>{label}</span>}
              {sidebarOpen && value === 'history' && allRuns.length > 0 && <span className="nav-count">{allRuns.length}</span>}
            </button>
          ))}
        </nav>
        {sidebarOpen && recentRuns.length > 0 && (
          <div className="recent-block">
            <p className="rail-label">Recent</p>
            <div className="recent-tabs" role="tablist" aria-label="Recent image editors">
              {recentRuns.slice(0, 12).map((run) => (
                <button key={run.id} role="tab" aria-selected={editorMatchesRun(run)} aria-controls={`image-editor-${run.remoteId ?? run.id}`} className={editorMatchesRun(run) ? 'active' : ''} onClick={() => openRunEditor(run)}><ImageIcon size={15} /><span>{run.prompt || run.targetName}</span></button>
              ))}
            </div>
          </div>
        )}
        <div className="rail-footer">
          <button onClick={() => setModal('shortcuts')}><CircleHelp size={18} />{sidebarOpen && <span>Help & shortcuts</span>}</button>
        </div>
      </aside>

      <div className="studio-main">
        <header className="top-bar">
          <div className="top-bar-left">
            <button className="icon-button mobile-menu" onClick={() => setMobileNavOpen((open) => !open)} aria-label="Open navigation"><Menu size={20} /></button>
            <button
              className="icon-button rail-collapse"
              onClick={() => setSidebarOpen((open) => !open)}
              aria-label={sidebarOpen ? 'Collapse navigation' : 'Expand navigation'}
            >
              {sidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
            </button>
          </div>
          <div className="top-actions">
            <div ref={repositoryAnchor} className="popover-anchor repository-anchor">
              <button key={repositoryAttentionCount} ref={repositoryButton} className={`repository-button ${activeRepositoryId ? '' : 'repository-button--empty'} ${!activeRepositoryId && repositoryAttentionCount > 0 ? 'repository-button--attention' : ''}`} onClick={() => setRepositoryMenuOpen((open) => !open)} aria-label={`Image repository: ${repositoryQuery.data?.active?.name ?? 'not selected'}`} aria-expanded={repositoryMenuOpen} disabled={repositoryQuery.isLoading || isRepositoryMutating}><HardDrive size={17} /><span><strong>{repositoryQuery.isLoading ? 'Loading…' : repositoryQuery.data?.active?.name ?? 'Choose a folder'}</strong></span><ChevronDown size={15} /></button>
              {repositoryMenuOpen && <div className="popover repository-menu surface-enter"><button className="repository-menu-heading" onClick={() => void selectRepository('/api/repository/choose')} disabled={isRepositoryMutating} aria-label="Choose folder"><HardDrive size={18} /><div><strong>{repositoryQuery.data?.active?.name ?? 'No active repository'}</strong><small>{activeRepositoryId ? 'Portable local images, projects, and metadata' : 'Choose a folder or create one in the picker before saving repository-backed work'}</small></div></button>{repositoryQuery.error instanceof Error && <p className="repository-menu-error" role="alert">{repositoryQuery.error.message}</p>}{(repositoryQuery.data?.recent.length ?? 0) > 0 && <div className="repository-recents"><p>Recent repositories</p>{repositoryQuery.data?.recent.map((repository) => <button key={repository.repositoryId} className={repository.repositoryId === activeRepositoryId ? 'selected' : ''} onClick={() => void selectRepository(`/api/repository/activate/${repository.repositoryId}`)}><HardDrive size={15} /><span>{repository.name}</span>{repository.repositoryId === activeRepositoryId && <Check size={14} />}</button>)}</div>}</div>}
            </div>
            <div className="popover-anchor">
              <button className="icon-button" onClick={() => setThemeMenuOpen((open) => !open)} aria-label="Choose theme">
                {theme === 'dark' ? <Moon size={18} /> : theme === 'light' ? <Sun size={18} /> : <Monitor size={18} />}
              </button>
              {themeMenuOpen && (
                <div className="popover theme-menu surface-enter">
                  <span
                    className="theme-menu__indicator"
                    aria-hidden="true"
                    style={{ transform: `translateY(${String(selectedThemeIndex * 100)}%)` }}
                  />
                  {themeOptions.map(({ value, label, Icon }) => (
                    <button
                      type="button"
                      key={value}
                      className={theme === value ? 'selected' : ''}
                      aria-pressed={theme === value}
                      onClick={() => changeTheme(value)}
                    >
                      <span className="theme-menu__label">
                        <Icon size={16} />
                        <span>{label}</span>
                      </span>
                      {theme === value && (
                        <Check className="theme-menu__check" size={15} aria-hidden="true" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {showCreateWorkspace && !settingsOpen && <button className="icon-button" onClick={() => setSettingsOpen(true)} aria-label="Open advanced settings"><SlidersHorizontal size={18} /></button>}
          </div>
        </header>

        {mobileNavOpen && <nav className="mobile-nav surface-enter" aria-label="Mobile studio navigation">{navItems.map(({ value, label, Icon }) => <button key={value} className={imageEditor === undefined && view === value ? 'active' : ''} onClick={() => { selectStudioView(value); setMobileNavOpen(false); }}><Icon size={17} /> {label}</button>)}</nav>}

        <div className="workspace">
          <main className="canvas">
            {imageEditor?.kind === 'image' && <ImageEditor id={`image-editor-${imageEditor.image.runId}`} key={`image:${imageEditor.image.imageId}`} prompt={imageEditor.image.prompt ?? ''} targetName={capabilityLabel(resolveCapability(capabilities, imageEditor.image.targetId))} location={imageEditor.location} createdAt={imageEditor.image.createdAt} status="completed" imageIds={[imageEditor.image.imageId]} expectedImageCount={1} onClose={() => setImageEditor(undefined)} onRemix={() => { if (imageEditor.intent === 'edit') void editBaroqueImage(imageEditor.image); else { setImageEditor(undefined); remixImage(imageEditor.image); } }} onMetadata={(imageId) => { void viewMetadata(imageId); }} {...(imageEditor.intent === 'edit' ? { statusLabel: 'Ready', editMode: true } : {})} />}
            {imageEditor?.kind === 'run' && selectedEditorRun && <ImageEditor id={`image-editor-${selectedEditorRun.remoteId ?? imageEditor.localId}`} key={`run:${imageEditor.localId}`} prompt={selectedEditorRun.prompt} targetName={selectedEditorRun.targetName} location={runDestinationLabel(selectedEditorRun.destination)} createdAt={selectedEditorRun.createdAt} status={selectedEditorRun.status} imageIds={selectedEditorRun.outputImageIds ?? []} expectedImageCount={selectedEditorRun.outputCount} {...(selectedEditorRun.error ? { error: selectedEditorRun.error } : {})} onClose={() => setImageEditor(undefined)} onRemix={() => { setImageEditor(undefined); reuseRun(selectedEditorRun); }} onMetadata={(imageId) => { void viewMetadata(imageId); }} {...(selectedEditorRun.remoteId ? { onCancel: () => void cancelRun(selectedEditorRun), onRetry: () => void retryRun(selectedEditorRun) } : {})} />}
            {imageEditor?.kind === 'upload' && <ImageEditor id={`image-editor-${imageEditor.id}`} key={`upload:${imageEditor.id}`} prompt={imageEditor.file.name} targetName="Uploaded image" location="This device" createdAt={imageEditor.createdAt} status="completed" statusLabel="Ready" imageIds={[]} localImage={{ id: imageEditor.id, name: imageEditor.file.name, url: imageEditor.previewUrl }} expectedImageCount={1} onClose={() => setImageEditor(undefined)} onRemix={() => void editUploadedImage(imageEditor)} editMode />}
            {imageEditor === undefined && view === 'create' && <CreateView prompt={prompt} setPrompt={setPrompt} promptInput={promptInput} selectedCapability={selectedCapability} settings={settings} updateSettings={updateSettings} attachments={attachments} dragActive={dragActive} isSubmitting={isSubmitting} onPromptKeyDown={handlePromptKeyDown} onSubmit={(event) => void generate(event)} onAddImage={() => fileInput.current?.click()} onOpenLibrary={() => selectStudioView('references')} onDrop={handleDrop} onDragActive={setDragActive} onRemoveAttachment={removeAttachment} onSavePrompt={saveCurrentPrompt} onOpenModels={() => setModelMenuOpen((open) => !open)} modelMenuOpen={modelMenuOpen} capabilities={capabilities} onSelectModel={selectModel} />}
            {imageEditor === undefined && view === 'edit' && <EditView images={imagesQuery.data?.images ?? []} projects={projects} isLoading={imagesQuery.isLoading} repositoryReady={Boolean(activeRepositoryId)} {...(imagesQuery.error instanceof Error ? { error: imagesQuery.error.message } : {})} onRepositoryRequired={() => { requireRepository('choose an image from Baroque'); }} onUpload={() => editFileInput.current?.click()} onDropFiles={openEditFile} onRetry={() => void imagesQuery.refetch()} onOpenImage={(image, location) => openImageEditor(image, location, 'edit')} />}
            {imageEditor === undefined && view === 'gallery' && <GalleryView projects={projects} {...(selectedProjectQuery.data ? { detail: selectedProjectQuery.data } : {})} images={imagesQuery.data?.images ?? []} isLoading={projectsQuery.isLoading || selectedProjectQuery.isLoading} repositoryReady={Boolean(activeRepositoryId)} {...(projectsQuery.error instanceof Error ? { error: projectsQuery.error.message } : selectedProjectQuery.error instanceof Error ? { error: selectedProjectQuery.error.message } : {})} onSelect={setSelectedProjectId} onRepositoryRequired={() => { requireRepository('create a project'); }} onCreate={createProject} onUpdate={updateProject} onDelete={(project) => void deleteProject(project)} onCreateAsset={createProjectAsset} onEditAsset={(asset) => void editProjectAsset(asset)} onDeleteAsset={(asset) => void deleteProjectAsset(asset)} onGenerate={generateTo} onOpenImage={openImageEditor} />}
            {imageEditor === undefined && view === 'references' && <ReferenceLibraryView folders={referenceLibraryQuery.data?.folders ?? []} isLoading={referenceLibraryQuery.isLoading} isMutating={isLibraryMutating} {...(referenceLibraryQuery.error instanceof Error ? { error: referenceLibraryQuery.error.message } : {})} onCreateFolder={() => void createReferenceFolder()} onRenameFolder={(folder) => void renameReferenceFolder(folder)} onDeleteFolder={(folder) => void deleteReferenceFolder(folder)} onAddImages={chooseLibraryUploads} onUseImage={useReferenceImage} onRenameImage={(image) => void renameReferenceImage(image)} onDeleteImage={(image) => void deleteReferenceImage(image)} onRetry={() => void refreshReferenceLibrary()} />}
            {imageEditor === undefined && view === 'history' && <HistoryView runs={allRuns} onCreate={() => selectStudioView('create')} onOpenRun={openRunEditor} onFavorite={toggleFavorite} />}
            {imageEditor === undefined && view === 'presets' && <PresetsView prompts={savedPrompts} onUse={(value) => { setPrompt(value); selectStudioView('create'); }} onDelete={(value) => setSavedPrompts((current) => current.filter((item) => item !== value))} onCreate={() => selectStudioView('create')} />}
          </main>
        </div>
      </div>

      {showCreateWorkspace && <SettingsPanel open={settingsOpen} capability={selectedCapability} settings={settings} updateSettings={updateSettings} onRandomSeed={chooseRandomSeed} onViewRequest={() => setModal('request')} onGetCode={() => setModal('code')} onClose={() => setSettingsOpen(false)} />}
      {showEditWorkspace && <EditToolsPanel selection={editingSelection} hasImage={hasEditSource} {...(hasEditSource ? { onStart: startSelectedEdit } : {})} />}

      <input ref={fileInput} className="visually-hidden" type="file" accept={MEDIA_TYPES.join(',')} multiple onChange={handleFiles} />
      <input ref={editFileInput} className="visually-hidden" type="file" accept={MEDIA_TYPES.join(',')} aria-label="Upload image to edit" onChange={handleEditFile} />
      <input ref={libraryFileInput} className="visually-hidden" type="file" accept={MEDIA_TYPES.join(',')} multiple onChange={(event) => void handleLibraryFiles(event)} />

      {modal && <Modal title={modal === 'code' ? 'Get code' : modal === 'request' ? 'Request preview' : modal === 'metadata' ? 'Generated image metadata' : 'Keyboard shortcuts'} onClose={() => setModal(null)}>{modal === 'shortcuts' ? <ShortcutList /> : modal === 'metadata' ? metadataError ? <div className="metadata-error"><CloudOff size={22} /><p>{metadataError}</p></div> : metadata === undefined ? <div className="metadata-loading"><span className="loader-ring" /><p>Loading authoritative sidecar metadata…</p></div> : <><div className="code-toolbar"><span>Versioned image sidecar</span><button className="text-button" onClick={() => void copyText(JSON.stringify(metadata, null, 2))}><Copy size={15} /> Copy</button></div><pre className="code-block metadata-code"><code>{JSON.stringify(metadata, null, 2)}</code></pre></> : <><div className="code-toolbar"><span>{modal === 'code' ? 'JavaScript' : 'JSON'}</span><button className="text-button" onClick={() => void copyText(modal === 'code' ? codeExample : JSON.stringify(requestBody, null, 2))}><Copy size={15} /> Copy</button></div><pre className="code-block"><code>{modal === 'code' ? codeExample : JSON.stringify(requestBody, null, 2)}</code></pre><p className="modal-note">Credentials remain in the loopback server. The browser only submits the exact prompt, explicit model settings, and chosen destination.</p></>}</Modal>}

      <div className="toast-stack" aria-live="polite">{toasts.map((toast) => <div key={toast.id} className={`toast toast--${toast.tone}`}>{toast.tone === 'success' ? <Check size={16} /> : toast.tone === 'error' ? <X size={16} /> : <Sparkles size={16} />}<span>{toast.message}</span><button onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))} aria-label="Dismiss notification"><X size={14} /></button></div>)}</div>
    </div>
  );
}
