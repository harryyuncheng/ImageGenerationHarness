/* eslint-disable @typescript-eslint/no-confusing-void-expression */
import {
  ArrowLeft,
  Bookmark,
  Braces,
  Check,
  ChevronDown,
  Clock3,
  Cloud,
  CloudOff,
  Code2,
  Command,
  Dice5,
  Download,
  Eraser,
  FolderOpen,
  FolderPlus,
  FolderTree,
  Image as ImageIcon,
  ImagePlus,
  Keyboard,
  Maximize2,
  MoreHorizontal,
  Paintbrush,
  Pencil,
  Plus,
  RefreshCw,
  Scaling,
  Search,
  Send,
  Save,
  Sparkles,
  Star,
  Trash2,
  Upload,
  WandSparkles,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type {
  DragEvent,
  KeyboardEvent,
  ReactNode,
  RefObject,
  SyntheticEvent,
} from 'react';
import { createPortal } from 'react-dom';
import {
  aspectRatios,
  capabilityLabel,
  hasParameter,
  maximumSeed,
  requiresPrompt,
  selectCreateGreeting,
  stylePresets,
  supportedOutputFormats,
  supportsPrompt,
  type Attachment,
  type Capability,
  type Destination,
  type GalleryImage,
  type GenerationSettings,
  type Project,
  type ProjectAsset,
  type ProjectDetailResponse,
  type ReferenceFolder,
  type ReferenceImage,
  type RunStatus,
  type StudioRun,
} from './studio.js';

const categoryMeta: Record<Capability['category'], { label: string; Icon: LucideIcon }> = {
  generation: { label: 'Generate', Icon: Sparkles },
  control: { label: 'Control & style', Icon: Paintbrush },
  upscale: { label: 'Upscale', Icon: Scaling },
  edit: { label: 'Edit', Icon: Eraser },
};

const outpaintDirections = [
  { label: 'Left', key: 'outpaintLeft' },
  { label: 'Right', key: 'outpaintRight' },
  { label: 'Up', key: 'outpaintUp' },
  { label: 'Down', key: 'outpaintDown' },
] as const;

const outputCounts = [1, 2, 3, 4] as const;

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${String(Math.max(1, Math.round(bytes / 1024)))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function shortModelName(name: string): string {
  return name.replace('Stable Diffusion', 'SD').replace('Stable Image', 'Stable');
}

function attachmentRole(capability: Capability, index: number): string {
  if (index === 0) return capability.canonicalId === 'service/style-transfer' ? 'Content' : 'Source';
  if (index === 1 && capability.canonicalId === 'service/style-transfer') return 'Style reference';
  if (index === 1 && hasParameter(capability, 'mask')) return 'Mask';
  return `Reference ${String(index)}`;
}

interface CreateViewProps {
  prompt: string;
  setPrompt: (value: string) => void;
  promptInput: RefObject<HTMLTextAreaElement | null>;
  selectedCapability: Capability;
  settings: GenerationSettings;
  updateSettings: <K extends keyof GenerationSettings>(
    key: K,
    value: GenerationSettings[K],
  ) => void;
  attachments: Attachment[];
  dragActive: boolean;
  isSubmitting: boolean;
  onPromptKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onSubmit: (event: SyntheticEvent<HTMLFormElement>) => void;
  onAddImage: () => void;
  onOpenLibrary: () => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
  onDragActive: (active: boolean) => void;
  onRemoveAttachment: (id: string) => void;
  onSavePrompt: () => void;
  onOpenModels: () => void;
  modelMenuOpen: boolean;
  capabilities: readonly Capability[];
  onSelectModel: (capability: Capability) => void;
}

function CreateGreeting() {
  const [greeting] = useState(() => selectCreateGreeting(new Date()));
  return (
    <section className="greeting-section">
      <h2 className="create-greeting">{greeting}</h2>
    </section>
  );
}

interface ComposerSettingOption {
  value: string;
  label: string;
  description: string;
  preview: ReactNode;
}

interface ComposerSettingPickerProps {
  menuId: string;
  label: string;
  menuLabel: string;
  menuDescription: string;
  value: string;
  options: readonly ComposerSettingOption[];
  open: boolean;
  variant: 'dimensions' | 'count';
  triggerContent: ReactNode;
  onOpenChange: (open: boolean) => void;
  onSelect: (value: string) => void;
}

function ComposerSettingPicker({
  menuId,
  label,
  menuLabel,
  menuDescription,
  value,
  options,
  open,
  variant,
  triggerContent,
  onOpenChange,
  onSelect,
}: ComposerSettingPickerProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    const menu = menuRef.current;
    if (!trigger || !menu) return;

    const viewportMargin = 12;
    const menuGap = 8;
    const positionMenu = () => {
      const triggerBounds = trigger.getBoundingClientRect();
      const menuWidth = menu.offsetWidth;
      const menuHeight = menu.offsetHeight;
      const visualViewport = window.visualViewport;
      const viewportLeft = visualViewport?.offsetLeft ?? 0;
      const viewportTop = visualViewport?.offsetTop ?? 0;
      const viewportWidth = visualViewport?.width ?? document.documentElement.clientWidth;
      const viewportHeight = visualViewport?.height ?? document.documentElement.clientHeight;
      const viewportRight = viewportLeft + viewportWidth;
      const viewportBottom = viewportTop + viewportHeight;
      const centeredLeft = triggerBounds.left + (triggerBounds.width - menuWidth) / 2;
      const left = Math.min(
        Math.max(centeredLeft, viewportLeft + viewportMargin),
        viewportRight - menuWidth - viewportMargin,
      );
      const spaceAbove = triggerBounds.top - viewportTop;
      const spaceBelow = viewportBottom - triggerBounds.bottom;
      const openAbove = spaceAbove >= menuHeight + menuGap || spaceAbove >= spaceBelow;
      const top = openAbove
        ? Math.max(viewportTop + viewportMargin, triggerBounds.top - menuHeight - menuGap)
        : Math.min(
            triggerBounds.bottom + menuGap,
            viewportBottom - menuHeight - viewportMargin,
          );

      menu.dataset['placement'] = openAbove ? 'above' : 'below';
      menu.dataset['positioned'] = 'true';
      Object.assign(menu.style, {
        left: `${String(left)}px`,
        maxHeight: `${String(viewportHeight - viewportMargin * 2)}px`,
        top: `${String(top)}px`,
      });
    };
    const closeFromOutside = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !trigger.contains(event.target) &&
        !menu.contains(event.target)
      ) {
        onOpenChange(false);
      }
    };
    const closeFromEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onOpenChange(false);
      trigger.focus();
    };

    positionMenu();
    menu
      .querySelector<HTMLButtonElement>('[role="option"][aria-selected="true"]')
      ?.focus({ preventScroll: true });
    const resizeObserver = new ResizeObserver(positionMenu);
    resizeObserver.observe(trigger);
    resizeObserver.observe(menu);
    document.addEventListener('pointerdown', closeFromOutside);
    window.addEventListener('keydown', closeFromEscape);
    window.addEventListener('resize', positionMenu);
    window.addEventListener('scroll', positionMenu, true);
    window.visualViewport?.addEventListener('resize', positionMenu);
    window.visualViewport?.addEventListener('scroll', positionMenu);
    return () => {
      resizeObserver.disconnect();
      document.removeEventListener('pointerdown', closeFromOutside);
      window.removeEventListener('keydown', closeFromEscape);
      window.removeEventListener('resize', positionMenu);
      window.removeEventListener('scroll', positionMenu, true);
      window.visualViewport?.removeEventListener('resize', positionMenu);
      window.visualViewport?.removeEventListener('scroll', positionMenu);
    };
  }, [open]);

  function moveOptionFocus(event: KeyboardEvent<HTMLDivElement>) {
    if (!['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft', 'Home', 'End'].includes(event.key)) {
      return;
    }
    const optionElements = Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]') ?? [],
    );
    if (optionElements.length === 0) return;
    event.preventDefault();
    const focusedIndex = optionElements.findIndex((option) => option === document.activeElement);
    let nextIndex = focusedIndex;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = optionElements.length - 1;
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      nextIndex = focusedIndex < 0 ? 0 : (focusedIndex + 1) % optionElements.length;
    }
    if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      nextIndex =
        focusedIndex < 0
          ? optionElements.length - 1
          : (focusedIndex - 1 + optionElements.length) % optionElements.length;
    }
    optionElements[nextIndex]?.focus();
  }

  function selectOption(nextValue: string) {
    onSelect(nextValue);
    onOpenChange(false);
    triggerRef.current?.focus();
  }

  return (
    <span className="composer-setting-picker">
      <button
        ref={triggerRef}
        type="button"
        className={`composer-setting composer-setting--${variant} ${open ? 'is-open' : ''}`}
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-describedby={`${menuId}-current-value`}
        title={label}
        onClick={() => onOpenChange(!open)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            onOpenChange(true);
          }
        }}
      >
        <span id={`${menuId}-current-value`} className="visually-hidden">
          Current value: {value}
        </span>
        {triggerContent}
        <ChevronDown className="composer-setting-chevron" size={13} />
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            className={`composer-setting-menu composer-setting-menu--${variant} popover surface-enter`}
          >
            <div className="composer-setting-menu-header">
              <strong>{menuLabel}</strong>
              <small>{menuDescription}</small>
            </div>
            <div
              id={menuId}
              className={`composer-setting-options composer-setting-options--${variant}`}
              role="listbox"
              aria-label={menuLabel}
              onKeyDown={moveOptionFocus}
            >
              {options.map((option) => {
                const selected = option.value === value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={`composer-setting-option composer-setting-option--${variant} ${selected ? 'selected' : ''}`}
                    role="option"
                    aria-label={
                      variant === 'count'
                        ? `${option.label} ${option.description}`
                        : `${option.description}, ${option.label}`
                    }
                    aria-selected={selected}
                    tabIndex={selected ? 0 : -1}
                    onClick={() => selectOption(option.value)}
                  >
                    <span className="composer-setting-option-preview">{option.preview}</span>
                    <span className="composer-setting-option-copy">
                      <strong>{option.label}</strong>
                      <small>{option.description}</small>
                    </span>
                    {selected && <Check className="composer-setting-option-check" size={14} />}
                  </button>
                );
              })}
            </div>
          </div>,
          document.body,
        )}
    </span>
  );
}

export function CreateView(props: CreateViewProps) {
  const ModelIcon = categoryMeta[props.selectedCapability.category].Icon;
  const [settingMenu, setSettingMenu] = useState<'dimensions' | 'count' | null>(null);

  function updateSettingMenu(menu: 'dimensions' | 'count', open: boolean) {
    if (open && props.modelMenuOpen) props.onOpenModels();
    setSettingMenu((current) => (open ? menu : current === menu ? null : current));
  }

  return (
    <div className="create-page surface-enter">
      <CreateGreeting />

      <form onSubmit={props.onSubmit} className="composer-wrap">
        <div className="composer-selectors">
          <div className="model-picker-wrap">
            <button
              type="button"
              className="model-picker"
              onClick={() => {
                setSettingMenu(null);
                props.onOpenModels();
              }}
            >
              <span className={`model-glyph model-glyph--${props.selectedCapability.category}`}><ModelIcon size={16} /></span>
              <span><small>{categoryMeta[props.selectedCapability.category].label}</small><strong>{shortModelName(capabilityLabel(props.selectedCapability))}</strong></span>
              <ChevronDown size={16} />
            </button>
            {props.modelMenuOpen && <ModelMenu capabilities={props.capabilities} selectedId={props.selectedCapability.canonicalId} onSelect={props.onSelectModel} />}
          </div>
        </div>

        <div
          className={`composer ${props.dragActive ? 'composer--drag' : ''}`}
          onDragEnter={(event) => { event.preventDefault(); props.onDragActive(true); }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={() => props.onDragActive(false)}
          onDrop={props.onDrop}
        >
          {props.dragActive && <div className="drop-overlay"><Upload size={24} /> Drop images here</div>}
          {props.attachments.length > 0 && (
            <div className="attachment-strip">
              {props.attachments.map((attachment, index) => (
                <div className="attachment" key={attachment.id}>
                  <img src={attachment.previewUrl} alt="" />
                  <span><strong>{attachmentRole(props.selectedCapability, index)}</strong><small>{attachment.name} · {formatBytes(attachment.byteLength)}</small></span>
                  <button type="button" onClick={() => props.onRemoveAttachment(attachment.id)} aria-label={`Remove ${attachment.name}`}><X size={14} /></button>
                </div>
              ))}
            </div>
          )}
          <textarea
            ref={props.promptInput}
            value={props.prompt}
            onChange={(event) => props.setPrompt(event.target.value)}
            onKeyDown={props.onPromptKeyDown}
            rows={4}
            maxLength={10_000}
            placeholder={supportsPrompt(props.selectedCapability) ? requiresPrompt(props.selectedCapability) ? 'Describe the image you want to create…' : 'Describe the desired result (optional)…' : 'This tool only needs a source image.'}
            aria-label="Image prompt"
          />
          <div className="composer-footer">
            <div className="composer-tools">
              <button type="button" className="round-tool" onClick={props.onAddImage} title="Add images (⌘⇧O)"><ImagePlus size={18} /></button>
              <button type="button" className="tool-chip" onClick={props.onOpenLibrary} title="Open reference library" aria-label="References"><FolderOpen size={16} /><span>References</span></button>
              <button type="button" className="tool-chip" onClick={props.onSavePrompt} title="Save prompt" aria-label="Save"><Bookmark size={16} /><span>Save</span></button>
              {hasParameter(props.selectedCapability, 'aspect_ratio') && (
                <ComposerSettingPicker
                  menuId="image-dimensions-menu"
                  label="Aspect ratio"
                  menuLabel="Image dimensions"
                  menuDescription="Choose the shape of generated images"
                  value={props.settings.aspectRatio}
                  options={aspectRatios.map((ratio) => ({
                    value: ratio.value,
                    label: ratio.value,
                    description: ratio.label,
                    preview: (
                      <span className={`ratio-shape ratio-${ratio.value.replace(':', '-')}`} />
                    ),
                  }))}
                  open={settingMenu === 'dimensions'}
                  variant="dimensions"
                  triggerContent={
                    <>
                      <span
                        className={`ratio-shape ratio-${props.settings.aspectRatio.replace(':', '-')}`}
                      />
                      <span className="composer-setting-value">{props.settings.aspectRatio}</span>
                    </>
                  }
                  onOpenChange={(open) => updateSettingMenu('dimensions', open)}
                  onSelect={(value) => props.updateSettings('aspectRatio', value)}
                />
              )}
              <ComposerSettingPicker
                menuId="image-count-menu"
                label="Number of images"
                menuLabel="Image count"
                menuDescription="Choose how many variations to generate"
                value={String(props.settings.outputCount)}
                options={outputCounts.map((count) => ({
                  value: String(count),
                  label: String(count),
                  description: count === 1 ? 'image' : 'images',
                  preview: <span className="image-count-preview">{count}</span>,
                }))}
                open={settingMenu === 'count'}
                variant="count"
                triggerContent={
                  <>
                    <ImageIcon size={14} />
                    <span className="composer-setting-value">{props.settings.outputCount}</span>
                  </>
                }
                onOpenChange={(open) => updateSettingMenu('count', open)}
                onSelect={(value) => props.updateSettings('outputCount', Number(value))}
              />
            </div>
            <div className="submit-area">
              <span className="key-hint"><Command size={12} /> Enter</span>
              <button className="generate-button" type="submit" disabled={props.isSubmitting}>
                {props.isSubmitting ? <RefreshCw className="spin" size={18} /> : <Send size={18} />}Generate
              </button>
            </div>
          </div>
        </div>
        <p className="composer-note"><Cloud size={13} /> Requests are queued privately through your local device. No information is ever retained from your requests or generations.</p>
      </form>
    </div>
  );
}

function ModelMenu({ capabilities, selectedId, onSelect }: { capabilities: readonly Capability[]; selectedId: string; onSelect: (capability: Capability) => void }) {
  const menuRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const menu = menuRef.current;
    const anchor = menu?.parentElement;
    if (!menu || !anchor) return;

    const viewportMargin = 12;
    const menuGap = 7;
    const preferredWidth = 430;
    const preferredHeight = 360;
    let animationFrame = 0;
    let lastLayout = '';

    const positionMenu = () => {
      const anchorBounds = anchor.getBoundingClientRect();
      const visualViewport = window.visualViewport;
      const viewportLeft = visualViewport?.offsetLeft ?? 0;
      const viewportTop = visualViewport?.offsetTop ?? 0;
      const viewportWidth = visualViewport?.width ?? document.documentElement.clientWidth;
      const viewportHeight = visualViewport?.height ?? document.documentElement.clientHeight;
      const viewportRight = viewportLeft + viewportWidth;
      const viewportBottom = viewportTop + viewportHeight;
      const width = Math.min(
        preferredWidth,
        Math.max(0, viewportWidth - viewportMargin * 2),
      );
      const left = Math.min(
        Math.max(anchorBounds.left, viewportLeft + viewportMargin),
        viewportRight - width - viewportMargin,
      );
      const spaceAbove = Math.max(
        0,
        anchorBounds.top - menuGap - viewportTop - viewportMargin,
      );
      const spaceBelow = Math.max(
        0,
        viewportBottom - anchorBounds.bottom - menuGap - viewportMargin,
      );
      const openAbove = spaceAbove > spaceBelow;
      const availableHeight = openAbove ? spaceAbove : spaceBelow;
      const maxHeight = Math.min(preferredHeight, availableHeight);
      const top = openAbove ? 'auto' : `${String(anchorBounds.bottom + menuGap)}px`;
      const bottom = openAbove
        ? `${String(document.documentElement.clientHeight - anchorBounds.top + menuGap)}px`
        : 'auto';
      const layout = [openAbove, left, width, maxHeight, top, bottom].join(':');

      if (layout !== lastLayout) {
        lastLayout = layout;
        menu.dataset['placement'] = openAbove ? 'above' : 'below';
        Object.assign(menu.style, {
          position: 'fixed',
          left: `${String(left)}px`,
          width: `${String(width)}px`,
          maxHeight: `${String(maxHeight)}px`,
          top,
          bottom,
        });
      }
      animationFrame = window.requestAnimationFrame(positionMenu);
    };
    const schedulePosition = () => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(positionMenu);
    };

    positionMenu();
    const resizeObserver = new ResizeObserver(schedulePosition);
    resizeObserver.observe(anchor);
    window.addEventListener('resize', schedulePosition);
    window.addEventListener('scroll', schedulePosition, true);
    window.visualViewport?.addEventListener('resize', schedulePosition);
    window.visualViewport?.addEventListener('scroll', schedulePosition);
    return () => {
      resizeObserver.disconnect();
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener('resize', schedulePosition);
      window.removeEventListener('scroll', schedulePosition, true);
      window.visualViewport?.removeEventListener('resize', schedulePosition);
      window.visualViewport?.removeEventListener('scroll', schedulePosition);
    };
  }, []);

  return (
    <div ref={menuRef} className="model-menu popover surface-enter">
      <div className="model-menu-header"><strong>Choose a tool</strong><small>Stability AI on Amazon Bedrock</small></div>
      {(['generation', 'control', 'upscale', 'edit'] as const).map((category) => {
        const group = capabilities.filter((capability) => capability.category === category);
        const Icon = categoryMeta[category].Icon;
        return group.length > 0 ? (
          <div className="model-group" key={category}>
            <p><Icon size={14} /> {categoryMeta[category].label}</p>
            {group.map((capability) => (
              <button type="button" key={capability.canonicalId} className={selectedId === capability.canonicalId ? 'selected' : ''} onClick={() => onSelect(capability)}>
                <span><strong>{capabilityLabel(capability)}</strong><small>{capability.modes.includes('image-to-image') ? 'Text or image prompt' : capability.modes.includes('text-to-image') ? 'Text prompt' : 'Source image required'}</small></span>
                {selectedId === capability.canonicalId && <Check size={16} />}
              </button>
            ))}
          </div>
        ) : null;
      })}
    </div>
  );
}

interface SettingsPanelProps {
  open: boolean;
  capability: Capability;
  settings: GenerationSettings;
  updateSettings: <K extends keyof GenerationSettings>(key: K, value: GenerationSettings[K]) => void;
  onRandomSeed: () => void;
  onViewRequest: () => void;
  onGetCode: () => void;
  onClose: () => void;
}

export function SettingsPanel({ open, capability, settings, updateSettings, onRandomSeed, onViewRequest, onGetCode, onClose }: SettingsPanelProps) {
  const showStyle = hasParameter(capability, 'style_preset');
  const seedMaximum = maximumSeed(capability);
  const outputFormats = supportedOutputFormats(capability);
  const selectedOutputFormatIndex = Math.max(outputFormats.indexOf(settings.outputFormat), 0);
  return (
    <aside
      className={`settings-panel ${open ? 'settings-panel--open' : ''}`}
      aria-label="Generation settings"
      aria-hidden={open ? undefined : true}
      inert={!open}
    >
      <header className="settings-panel-header">
        <h2>Advanced settings</h2>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Close advanced settings"><X size={18} /></button>
      </header>
      <div className="settings-scroll">
        {showStyle && <SettingGroup label="Style preset"><select value={settings.stylePreset || 'none'} onChange={(event) => updateSettings('stylePreset', event.target.value === 'none' ? '' : event.target.value)}>{stylePresets.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></SettingGroup>}

        {capability.canonicalId === 'service/search-recolor' && <SettingGroup label="Select object or area"><input value={settings.selectPrompt} onChange={(event) => updateSettings('selectPrompt', event.target.value)} placeholder="e.g. the red jacket" /></SettingGroup>}
        {capability.canonicalId === 'service/search-replace' && <SettingGroup label="Object to replace"><input value={settings.searchPrompt} onChange={(event) => updateSettings('searchPrompt', event.target.value)} placeholder="e.g. the wooden chair" /></SettingGroup>}

        {capability.modes.includes('image-to-image') && <RangeSetting label="Image strength" value={settings.strength} min={0} max={1} step={0.05} onChange={(value) => updateSettings('strength', value)} />}
        {capability.category === 'control' && capability.canonicalId.includes('control-') && <RangeSetting label="Control strength" value={settings.controlStrength} min={0} max={1} step={0.05} onChange={(value) => updateSettings('controlStrength', value)} />}
        {capability.canonicalId === 'service/style-guide' && <RangeSetting label="Style fidelity" value={settings.fidelity} min={0} max={1} step={0.05} onChange={(value) => updateSettings('fidelity', value)} />}
        {capability.canonicalId === 'service/style-transfer' && <>
          <RangeSetting label="Composition fidelity" value={settings.compositionFidelity} min={0} max={1} step={0.05} onChange={(value) => updateSettings('compositionFidelity', value)} />
          <RangeSetting label="Style strength" value={settings.styleStrength} min={0} max={1} step={0.05} onChange={(value) => updateSettings('styleStrength', value)} />
          <RangeSetting label="Change strength" value={settings.changeStrength} min={0.1} max={1} step={0.05} onChange={(value) => updateSettings('changeStrength', value)} />
        </>}
        {(capability.category === 'upscale' || capability.canonicalId === 'service/outpaint') && capability.canonicalId !== 'service/fast-upscale' && <RangeSetting label="Creativity" value={settings.creativity} min={0.1} max={capability.category === 'upscale' ? 0.5 : 1} step={0.05} onChange={(value) => updateSettings('creativity', value)} />}
        {hasParameter(capability, 'grow_mask') && <RangeSetting label="Mask growth (px)" value={settings.growMask} min={0} max={20} step={1} onChange={(value) => updateSettings('growMask', value)} />}

        {capability.canonicalId === 'service/outpaint' && (
          <SettingGroup label="Expand canvas (px)"><div className="number-grid">{outpaintDirections.map(({ label, key }) => <label key={key}><span>{label}</span><input type="number" min="0" max="2000" value={settings[key]} onChange={(event) => updateSettings(key, Number(event.target.value))} /></label>)}</div></SettingGroup>
        )}

        {hasParameter(capability, 'negative_prompt') && <SettingGroup label="Negative prompt"><textarea rows={3} value={settings.negativePrompt} onChange={(event) => updateSettings('negativePrompt', event.target.value)} placeholder="What should not appear?" /></SettingGroup>}
        {hasParameter(capability, 'output_format') && (
          <SettingGroup label="Output format">
            <div className="segmented-control" role="group" aria-label="Output format">
              <span
                className="segmented-control__indicator"
                aria-hidden="true"
                style={{
                  width: `${String(100 / Math.max(outputFormats.length, 1))}%`,
                  transform: `translateX(${String(selectedOutputFormatIndex * 100)}%)`,
                }}
              />
              {outputFormats.map((format) => (
                <button
                  type="button"
                  key={format}
                  className={settings.outputFormat === format ? 'selected' : ''}
                  aria-pressed={settings.outputFormat === format}
                  onClick={() => updateSettings('outputFormat', format)}
                >
                  {format.toUpperCase()}
                </button>
              ))}
            </div>
          </SettingGroup>
        )}
        {seedMaximum !== undefined && <SettingGroup label="Seed strategy"><select value={settings.seedMode} onChange={(event) => updateSettings('seedMode', event.target.value as GenerationSettings['seedMode'])}><option value="random">Random per image</option><option value="fixed">Repeat one seed</option><option value="sequential">Sequential seeds</option></select>{settings.seedMode !== 'random' && <div className="seed-input"><input type="number" min="0" max={seedMaximum} value={settings.seed} onChange={(event) => updateSettings('seed', Number(event.target.value))} /><button className="icon-button" onClick={onRandomSeed} title="Random seed"><Dice5 size={17} /></button></div>}</SettingGroup>}
      </div>
      <div className="settings-footer settings-footer--actions">
        <button className="text-button" onClick={onViewRequest}><Braces size={16} /> View request</button>
        <button className="text-button" onClick={onGetCode}><Code2 size={16} /> Get code</button>
      </div>
    </aside>
  );
}

function SettingGroup({ label, children }: { label: string; children: ReactNode }) {
  return <div className="setting-group"><label>{label}</label>{children}</div>;
}

function RangeSetting({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (value: number) => void }) {
  return <div className="setting-group range-setting"><label><span>{label}</span><output>{value.toFixed(2)}</output></label><input type="range" value={value} min={min} max={max} step={step} onChange={(event) => onChange(Number(event.target.value))} /><div className="range-labels"><span>Lower</span><span>Higher</span></div></div>;
}

function HistoryCard({
  run,
  onOpen,
  onFavorite,
}: {
  run: StudioRun;
  onOpen: (run: StudioRun) => void;
  onFavorite: (runId: string) => void;
}) {
  const firstImageId = run.outputImageIds?.at(0);
  const outputUrl = firstImageId ? `/api/images/${firstImageId}/content` : undefined;
  const imageName = run.prompt || run.targetName;
  const terminalWithoutOutput = ['failed', 'cancelled', 'interrupted'].includes(run.status);

  return (
    <article className={`history-card history-card--${run.status}`}>
      <button
        type="button"
        className="history-image"
        onClick={() => onOpen(run)}
        aria-label={`Open editor for ${imageName}`}
      >
        {outputUrl ? (
          <img src={outputUrl} alt={imageName || 'Generated image'} />
        ) : terminalWithoutOutput ? (
          <CloudOff size={30} />
        ) : run.status === 'completed' ? (
          <ImageIcon size={34} />
        ) : (
          <span className="loader-ring" />
        )}
      </button>
      <button
        type="button"
        className={`history-favorite ${run.favorite ? 'favorite' : ''}`}
        onClick={() => onFavorite(run.id)}
        aria-label={run.favorite ? 'Remove favorite' : 'Add favorite'}
      >
        <Star size={19} fill={run.favorite ? 'currentColor' : 'none'} />
      </button>
    </article>
  );
}

export function HistoryView({
  runs,
  onCreate,
  onOpenRun,
  onFavorite,
}: {
  runs: StudioRun[];
  onCreate: () => void;
  onOpenRun: (run: StudioRun) => void;
  onFavorite: (runId: string) => void;
}) {
  return (
    <div className="library-page history-page surface-enter">
      <div className="library-heading"><h2>Generation history</h2></div>
      {runs.length === 0 ? <EmptyState Icon={Clock3} title="No generations here yet" body="Generated images saved in this repository will appear here in chronological order." action="Create an image" onAction={onCreate} /> : <div className="history-grid">{runs.map((run) => <HistoryCard key={run.id} run={run} onOpen={onOpenRun} onFavorite={onFavorite} />)}</div>}
    </div>
  );
}

interface ImageEditorProps {
  id: string;
  prompt: string;
  targetName: string;
  location: string;
  createdAt: string;
  status: RunStatus;
  imageIds: readonly string[];
  localImage?: {
    id: string;
    name: string;
    url: string;
  };
  expectedImageCount: number;
  error?: string;
  onClose: () => void;
  onRemix: () => void;
  onMetadata?: (imageId: string) => void;
  statusLabel?: string;
  editMode?: boolean;
  onCancel?: () => void;
  onRetry?: () => void;
}

export interface EditingToolSelection {
  tools: readonly Capability[];
  selectedToolId: string;
  onSelectTool: (toolId: string) => void;
}

function editorProgressMessage(status: RunStatus, hasImage: boolean): string {
  if (hasImage) return 'Loading image…';
  if (status === 'submitting') return 'Submitting request…';
  if (status === 'queued') return 'Waiting for the local worker…';
  if (status === 'running') return 'Creating your image…';
  if (status === 'completed') return 'Finalizing the saved image…';
  if (status === 'cancelled') return 'This run was cancelled.';
  if (status === 'interrupted') return 'The server stopped during this run.';
  return 'Generation failed.';
}

function editToolDescription(capability: Capability): string {
  switch (capability.canonicalId) {
    case 'service/inpaint':
      return 'Paint new content into a selected area.';
    case 'service/outpaint':
      return 'Extend the image beyond its current frame.';
    case 'service/search-recolor':
      return 'Find an object and change its color.';
    case 'service/search-replace':
      return 'Find an object and replace it with something new.';
    case 'service/erase':
      return 'Remove a selected object or region.';
    case 'service/remove-background':
      return 'Isolate the subject on a transparent background.';
    default:
      return 'Edit this image with Stability on Bedrock.';
  }
}

function editToolIcon(capability: Capability): LucideIcon {
  switch (capability.canonicalId) {
    case 'service/inpaint':
      return Paintbrush;
    case 'service/outpaint':
      return Scaling;
    case 'service/search-recolor':
      return Search;
    case 'service/search-replace':
      return WandSparkles;
    case 'service/erase':
      return Eraser;
    case 'service/remove-background':
      return ImageIcon;
    default:
      return Pencil;
  }
}

export function EditToolsPanel({
  selection,
  hasImage,
  onStart,
}: {
  selection: EditingToolSelection;
  hasImage: boolean;
  onStart?: () => void;
}) {
  const selectedTool =
    selection.tools.find((tool) => tool.canonicalId === selection.selectedToolId) ??
    selection.tools[0];

  return (
    <aside
      className="settings-panel settings-panel--open edit-tools-panel"
      aria-label="Editing tools"
    >
      <header className="settings-panel-header">
        <h2>Editing tools</h2>
      </header>
      <div className="settings-scroll edit-tools-scroll">
        <div className="edit-tool-summary">
          <span>Selected tool</span>
          <h3>{selectedTool ? capabilityLabel(selectedTool) : 'No tools available'}</h3>
          <p>
            {selectedTool
              ? editToolDescription(selectedTool)
              : 'No image editing capabilities are available.'}
          </p>
        </div>
        <div className="edit-tool-list" role="group" aria-label="Editing tools">
          {selection.tools.map((tool) => {
            const selected = tool.canonicalId === selectedTool?.canonicalId;
            const ToolIcon = editToolIcon(tool);
            return (
              <button
                key={tool.canonicalId}
                className={selected ? 'selected' : ''}
                aria-pressed={selected}
                onClick={() => selection.onSelectTool(tool.canonicalId)}
              >
                <span><ToolIcon size={14} /></span>
                <span>
                  <strong>{capabilityLabel(tool)}</strong>
                  <small>{editToolDescription(tool)}</small>
                </span>
                {selected && <Check size={14} />}
              </button>
            );
          })}
        </div>
      </div>
      <div className="settings-footer edit-tool-footer">
        <p>
          {hasImage
            ? 'The selected tool will use this image as its source.'
            : 'Choose a source on the canvas. This tool selection will stay active.'}
        </p>
        {hasImage && onStart && <button className="primary-small" onClick={onStart}><Pencil size={15} /> Start editing</button>}
      </div>
    </aside>
  );
}

export function ImageEditor(props: ImageEditorProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loadedImageKey, setLoadedImageKey] = useState<string>();
  const [failedImageKey, setFailedImageKey] = useState<string>();
  const images: {
    key: string;
    url: string;
    imageId?: string;
    downloadName?: string;
  }[] = props.localImage
    ? [
        {
          key: props.localImage.id,
          url: props.localImage.url,
          downloadName: props.localImage.name,
        },
      ]
    : props.imageIds.map((imageId) => ({
        key: imageId,
        url: `/api/images/${imageId}/content`,
        imageId,
      }));
  const selectedImage = images[selectedIndex] ?? images[0];
  const selectedImageId = selectedImage?.imageId;
  const imageLoaded =
    selectedImage !== undefined && loadedImageKey === selectedImage.key;
  const imageFailed =
    selectedImage !== undefined && failedImageKey === selectedImage.key;
  const active = ['submitting', 'queued', 'running'].includes(props.status);
  const terminal = ['failed', 'cancelled', 'interrupted'].includes(props.status);
  const terminalWithoutImage =
    selectedImage === undefined && terminal;

  return (
    <section
      id={props.id}
      className="image-editor-page surface-enter"
      role="tabpanel"
      aria-label="Image editor"
      tabIndex={0}
    >
      <header className="image-editor-header">
        <div>
          <button className="icon-button" onClick={props.onClose} aria-label="Back from image editor"><ArrowLeft size={18} /></button>
          <div>
            <span>{props.location}</span>
            <h2>{props.prompt.length > 0 ? props.prompt : 'Generated image'}</h2>
          </div>
        </div>
        <span className={`image-editor-status image-editor-status--${props.status}`}>{props.statusLabel ?? props.status}</span>
      </header>
      <div className={`image-editor ${props.editMode ? 'image-editor--editing' : ''}`}>
        <div className={`image-editor-preview ${terminalWithoutImage || imageFailed ? 'image-editor-preview--error' : ''}`}>
          {selectedImage && (
            <img
              key={selectedImage.key}
              className={imageLoaded ? 'is-loaded' : ''}
              src={selectedImage.url}
              alt={props.prompt.length > 0 ? props.prompt : 'Generated image'}
              onLoad={() => {
                setFailedImageKey(undefined);
                setLoadedImageKey(selectedImage.key);
              }}
              onError={() => setFailedImageKey(selectedImage.key)}
            />
          )}
          {!imageLoaded && (
            <div className="image-editor-progress" role="status" aria-live="polite">
              {terminalWithoutImage || imageFailed ? <CloudOff size={30} /> : <span className="loader-ring" />}
              <strong>{imageFailed ? 'Image preview unavailable.' : editorProgressMessage(props.status, selectedImage !== undefined)}</strong>
              <small>{imageFailed ? 'The image may still be available through Full screen or Download.' : (props.error ?? `${String(props.expectedImageCount)} image${props.expectedImageCount === 1 ? '' : 's'} requested`)}</small>
            </div>
          )}
        </div>
        {!props.editMode && (
          <aside className="image-editor-sidebar">
          <div>
            <span className="image-editor-location">Image details</span>
            <h3>{props.targetName}</h3>
            <p>{props.location}</p>
          </div>
          {images.length > 1 && (
            <div className="image-editor-outputs" role="group" aria-label="Generated outputs">
              {images.map((image, index) => (
                <button
                  key={image.key}
                  className={image.key === selectedImage?.key ? 'selected' : ''}
                  onClick={() => setSelectedIndex(index)}
                  aria-label={`View output ${String(index + 1)}`}
                  aria-pressed={image.key === selectedImage?.key}
                >
                  <img src={image.url} alt="" />
                </button>
              ))}
            </div>
          )}
          <dl>
            <div><dt>Created</dt><dd>{new Date(props.createdAt).toLocaleString()}</dd></div>
            <div><dt>Output</dt><dd>{selectedImage ? `${String(selectedIndex + 1)} of ${String(images.length)}` : `Waiting for ${String(props.expectedImageCount)}`}</dd></div>
            {selectedImageId && <div><dt>Image ID</dt><dd>{selectedImageId}</dd></div>}
          </dl>
          {props.error && <p className="image-editor-error">{props.error}</p>}
          <div className="image-editor-actions">
            {selectedImageId && props.onMetadata && <button className="text-button" onClick={() => props.onMetadata?.(selectedImageId)}><MoreHorizontal size={15} /> Metadata</button>}
            {selectedImage && <a className="text-button" href={selectedImage.url} download={selectedImage.downloadName ?? true}><Download size={15} /> Download</a>}
            {selectedImage && <a className="text-button" href={selectedImage.url} target="_blank" rel="noreferrer"><Maximize2 size={15} /> Full screen</a>}
            {active && props.onCancel && <button className="text-button danger" onClick={props.onCancel}>Cancel generation</button>}
            {!active && terminal && props.onRetry && <button className="text-button" onClick={props.onRetry}><RefreshCw size={15} /> Retry</button>}
            <button className="primary-small" onClick={props.onRemix}><RefreshCw size={15} /> Remix</button>
          </div>
          </aside>
        )}
      </div>
    </section>
  );
}

function GeneratedImageCard({ image, subtitle, onOpen }: { image: GalleryImage; subtitle: string; onOpen: (image: GalleryImage) => void }) {
  const outputUrl = `/api/images/${image.imageId}/content`;
  const imageName = image.prompt?.length ? image.prompt : 'Generated image';
  return (
    <article className="gallery-card">
      <button
        className="gallery-image"
        onClick={() => onOpen(image)}
        aria-label={`Open editor for ${imageName}`}
      >
        <img src={outputUrl} alt={imageName} />
        <span className="gallery-open-hint"><Maximize2 size={15} /> Open</span>
      </button>
      <div>
        <strong>{imageName}</strong>
        <span>{subtitle}</span>
      </div>
    </article>
  );
}

interface EditViewProps {
  images: GalleryImage[];
  projects: Project[];
  isLoading: boolean;
  repositoryReady: boolean;
  error?: string;
  onRepositoryRequired: () => void;
  onUpload: () => void;
  onDropFiles: (files: File[]) => void;
  onRetry: () => void;
  onOpenImage: (image: GalleryImage, location: string) => void;
}

export function EditView(props: EditViewProps) {
  const [showBaroqueImages, setShowBaroqueImages] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  function openBaroqueImages() {
    if (!props.repositoryReady) {
      props.onRepositoryRequired();
      return;
    }
    setShowBaroqueImages(true);
  }

  function imageLocation(image: GalleryImage): string {
    if (!image.projectId) return 'Baroque / Main repository';
    const projectName =
      props.projects.find((project) => project.projectId === image.projectId)?.name ??
      'Project';
    return image.projectAssetId
      ? `Baroque / ${projectName} / Project asset`
      : `Baroque / ${projectName}`;
  }

  return (
    <section
      className="library-page edit-page surface-enter"
      role="tabpanel"
      aria-label="Image editor"
      tabIndex={0}
    >
      <div className="library-heading">
        <div>
          <h2>Edit</h2>
          <p>Choose an image and an editing tool to get started.</p>
        </div>
      </div>
      <div className="edit-canvas-editor">
        <div
          className={`image-editor-preview edit-canvas-stage ${dragActive ? 'edit-canvas-stage--drag' : ''}`}
          role="group"
          aria-label="Blank editing canvas"
          onDragEnter={(event) => {
            event.preventDefault();
            setDragActive(true);
          }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={() => setDragActive(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragActive(false);
            props.onDropFiles(Array.from(event.dataTransfer.files));
          }}
        >
          <div className="edit-canvas-empty">
            <span><ImagePlus size={27} /></span>
            <h3>Add an image to edit</h3>
            <p>Drop an image here, upload one, or choose from your Baroque repository.</p>
            <div>
              <button className="primary-small" onClick={props.onUpload}><Upload size={16} /> Upload image</button>
              <button className="text-button" onClick={openBaroqueImages}><ImageIcon size={16} /> Choose from Baroque</button>
            </div>
            <small>PNG, JPEG, or WebP up to 10 MB</small>
          </div>

          {showBaroqueImages && (
            <div
              className="edit-image-picker-backdrop surface-enter"
              onMouseDown={() => setShowBaroqueImages(false)}
            >
              <section
                className="edit-image-picker surface-enter"
                role="dialog"
                aria-modal="true"
                aria-label="Choose from Baroque"
                onMouseDown={(event) => event.stopPropagation()}
              >
                <header>
                  <div>
                    <span>Baroque repository</span>
                    <h3>Choose an image</h3>
                  </div>
                  <button
                    className="icon-button"
                    onClick={() => setShowBaroqueImages(false)}
                    aria-label="Close image picker"
                  >
                    <X size={17} />
                  </button>
                </header>
                <div className="edit-image-picker-content">
                  {props.error ? (
                    <div className="edit-picker-state">
                      <CloudOff size={25} />
                      <strong>Images unavailable</strong>
                      <p>{props.error}</p>
                      <button className="text-button" onClick={props.onRetry}>Try again</button>
                    </div>
                  ) : props.isLoading ? (
                    <div className="edit-picker-state"><span className="loader-ring" /><p>Loading images…</p></div>
                  ) : props.images.length === 0 ? (
                    <div className="edit-picker-state"><ImageIcon size={25} /><strong>No images yet</strong><p>Generated images saved in this repository will appear here.</p></div>
                  ) : (
                    <div className="gallery-grid">
                      {props.images.map((image) => {
                        const location = imageLocation(image);
                        return (
                          <GeneratedImageCard
                            key={image.imageId}
                            image={image}
                            subtitle={location.replace('Baroque / ', '')}
                            onOpen={(selected) => props.onOpenImage(selected, location)}
                          />
                        );
                      })}
                    </div>
                  )}
                </div>
              </section>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

interface GalleryViewProps {
  projects: Project[];
  detail?: ProjectDetailResponse;
  images: GalleryImage[];
  isLoading: boolean;
  repositoryReady: boolean;
  error?: string;
  onSelect: (projectId: string | undefined) => void;
  onRepositoryRequired: () => void;
  onCreate: (input: { name: string; description: string }) => Promise<void>;
  onUpdate: (projectId: string, input: { name: string; description: string }) => Promise<void>;
  onDelete: (project: Project) => void;
  onCreateAsset: (projectId: string, input: { name: string; description: string }) => Promise<void>;
  onEditAsset: (asset: ProjectAsset) => void;
  onDeleteAsset: (asset: ProjectAsset) => void;
  onGenerate: (destination: Destination) => void;
  onOpenImage: (image: GalleryImage, location: string) => void;
}

export function GalleryView(props: GalleryViewProps) {
  const [search, setSearch] = useState('');
  const [creatingProject, setCreatingProject] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [assetName, setAssetName] = useState('');
  const [assetDescription, setAssetDescription] = useState('');
  const [creatingAsset, setCreatingAsset] = useState(false);

  useEffect(() => {
    setEditName(props.detail?.project.name ?? '');
    setEditDescription(props.detail?.project.description ?? '');
    setAssetName('');
    setAssetDescription('');
    setCreatingAsset(false);
  }, [props.detail?.project.projectId, props.detail?.project.name, props.detail?.project.description]);

  function toggleProjectCreation() {
    if (!creatingProject && !props.repositoryReady) {
      props.onRepositoryRequired();
      return;
    }
    setCreatingProject((value) => !value);
  }

  if (props.detail) {
    const { project, assets } = props.detail;
    const projectImages = props.images.filter((image) => image.projectId === project.projectId);
    return (
      <div className="library-page project-dashboard surface-enter">
        <button className="project-back" onClick={() => props.onSelect(undefined)}><ArrowLeft size={16} /> All projects</button>
        <div className="project-dashboard-header">
          <div><span className="project-glyph"><FolderTree size={23} /></span><div><p>Project workspace</p><h2>{project.name}</h2></div></div>
          <div><button className="text-button danger" onClick={() => props.onDelete(project)}><Trash2 size={15} /> Delete</button><button className="primary-small" onClick={() => props.onGenerate({ kind: 'project', projectId: project.projectId })}><WandSparkles size={16} /> Generate to project</button></div>
        </div>

        <section className="project-editor">
          <div className="section-heading"><div><h3>Project details</h3><p>Organizational notes are never added to generation prompts.</p></div></div>
          <label><span>Name</span><input aria-label="Project name" value={editName} maxLength={120} onChange={(event) => setEditName(event.target.value)} /></label>
          <label><span>Description</span><textarea aria-label="Project description" rows={4} maxLength={4000} value={editDescription} onChange={(event) => setEditDescription(event.target.value)} placeholder="Purpose, visual direction, or other notes…" /></label>
          <div className="project-editor-actions"><small>Updated {new Date(project.updatedAt).toLocaleString()}</small><button className="primary-small" disabled={!editName.trim()} onClick={() => void props.onUpdate(project.projectId, { name: editName.trim(), description: editDescription })}><Save size={15} /> Save changes</button></div>
        </section>

        <section className="project-section">
          <div className="section-heading"><div><h3>Nested assets</h3><p>Focused spaces for a character, prop, product, logo, or location.</p></div><button className="text-button" onClick={() => setCreatingAsset((value) => !value)}><Plus size={15} /> New asset</button></div>
          {creatingAsset && <form className="inline-create-card surface-enter" onSubmit={(event) => { event.preventDefault(); if (!assetName.trim()) return; void props.onCreateAsset(project.projectId, { name: assetName.trim(), description: assetDescription }).then(() => { setAssetName(''); setAssetDescription(''); setCreatingAsset(false); }); }}><label><span>Asset name</span><input aria-label="Asset name" autoFocus value={assetName} maxLength={120} onChange={(event) => setAssetName(event.target.value)} placeholder="Hero product" /></label><label><span>Description</span><textarea aria-label="Asset description" rows={2} maxLength={4000} value={assetDescription} onChange={(event) => setAssetDescription(event.target.value)} placeholder="Private organizational note" /></label><div><button type="button" className="text-button" onClick={() => setCreatingAsset(false)}>Cancel</button><button className="primary-small" disabled={!assetName.trim()} type="submit">Create asset</button></div></form>}
          {assets.length === 0 ? <div className="project-mini-empty"><FolderPlus size={22} /><p>No nested assets yet.</p></div> : <div className="asset-grid">{assets.map((asset) => <article className="asset-card" key={asset.assetId}><span><ImageIcon size={18} /></span><div><h4>{asset.name}</h4><p>{asset.description.length > 0 ? asset.description : 'No description'}</p></div><div><button className="text-button" onClick={() => props.onGenerate({ kind: 'project-asset', projectId: project.projectId, projectAssetId: asset.assetId })}><WandSparkles size={14} /> Generate</button><button className="icon-button" onClick={() => props.onEditAsset(asset)} aria-label={`Edit ${asset.name}`}><Pencil size={14} /></button><button className="icon-button danger" onClick={() => props.onDeleteAsset(asset)} aria-label={`Delete ${asset.name}`}><Trash2 size={14} /></button></div></article>)}</div>}
        </section>

        <section className="project-section">
          <div className="section-heading"><div><h3>Project images</h3><p>Includes project-root and nested-asset outputs.</p></div></div>
          {projectImages.length === 0 ? <div className="project-mini-empty"><ImageIcon size={22} /><p>No images generated in this project yet.</p></div> : <div className="gallery-grid project-gallery">{projectImages.map((image) => { const asset = assets.find((candidate) => candidate.assetId === image.projectAssetId); const location = `${project.name} / ${asset?.name ?? 'Project root'}`; return <GeneratedImageCard key={image.imageId} image={image} subtitle={asset?.name ?? 'Project root'} onOpen={(selected) => props.onOpenImage(selected, location)} />; })}</div>}
        </section>
      </div>
    );
  }

  const filtered = props.projects.filter((project) => `${project.name} ${project.description}`.toLowerCase().includes(search.toLowerCase()));
  return (
    <div className="library-page projects-page surface-enter">
      <div className="library-heading"><div><h2>Gallery</h2><p>Keep generated images organized by project and nested visual asset.</p></div><button className="primary-small" onClick={toggleProjectCreation}><FolderPlus size={16} /> New project</button></div>
      {creatingProject && <form className="project-create surface-enter" onSubmit={(event) => { event.preventDefault(); if (!projectName.trim()) return; void props.onCreate({ name: projectName.trim(), description: projectDescription }).then(() => { setProjectName(''); setProjectDescription(''); setCreatingProject(false); }); }}><div><span className="project-glyph"><FolderTree size={21} /></span><div><h3>Create a project</h3><p>Descriptions stay organizational and never alter prompts.</p></div></div><label><span>Name</span><input aria-label="New project name" autoFocus maxLength={120} value={projectName} onChange={(event) => setProjectName(event.target.value)} placeholder="Autumn campaign" /></label><label><span>Description</span><textarea aria-label="New project description" rows={3} maxLength={4000} value={projectDescription} onChange={(event) => setProjectDescription(event.target.value)} placeholder="What belongs in this project?" /></label><div className="project-create-actions"><button type="button" className="text-button" onClick={() => setCreatingProject(false)}>Cancel</button><button className="primary-small" disabled={!projectName.trim()} type="submit">Create project</button></div></form>}
      <div className="library-toolbar"><label className="search-field"><Search size={17} /><input aria-label="Search projects" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search projects" /></label></div>
      {props.error ? <EmptyState Icon={CloudOff} title="Projects unavailable" body={props.error} action="Try again" onAction={() => props.onSelect(undefined)} /> : props.isLoading ? <div className="reference-loading"><span className="loader-ring" /><p>Loading projects…</p></div> : filtered.length === 0 ? <EmptyState Icon={FolderTree} title={props.projects.length === 0 ? 'Create your first project' : 'No matching projects'} body="Projects group generated images and focused nested assets without changing your prompts." action="New project" onAction={toggleProjectCreation} /> : <div className="projects-grid">{filtered.map((project) => <button className="project-card" key={project.projectId} onClick={() => props.onSelect(project.projectId)}><span className="project-glyph"><FolderTree size={20} /></span><div><h3>{project.name}</h3><p>{project.description || 'No description yet'}</p><small>Updated {new Date(project.updatedAt).toLocaleDateString()}</small></div><ArrowLeft className="project-open-arrow" size={17} /></button>)}</div>}
    </div>
  );
}

interface ReferenceLibraryViewProps {
  folders: ReferenceFolder[];
  isLoading: boolean;
  isMutating: boolean;
  error?: string;
  onCreateFolder: () => void;
  onRenameFolder: (folder: ReferenceFolder) => void;
  onDeleteFolder: (folder: ReferenceFolder) => void;
  onAddImages: (folderId: string) => void;
  onUseImage: (image: ReferenceImage) => void;
  onRenameImage: (image: ReferenceImage) => void;
  onDeleteImage: (image: ReferenceImage) => void;
  onRetry: () => void;
}

export function ReferenceLibraryView(props: ReferenceLibraryViewProps) {
  return (
    <div className="library-page reference-library-page surface-enter">
      <div className="library-heading">
        <div>
          <h2>Reference library</h2>
          <p>Organize reusable looks, categories, subjects, and styles in private folders.</p>
        </div>
        <button className="primary-small" onClick={props.onCreateFolder} disabled={props.isMutating}>
          <FolderPlus size={16} /> New folder
        </button>
      </div>
      {props.error ? (
        <EmptyState Icon={CloudOff} title="Reference library unavailable" body={props.error} action="Try again" onAction={props.onRetry} />
      ) : props.isLoading ? (
        <div className="reference-loading"><span className="loader-ring" /><p>Loading your reference library…</p></div>
      ) : props.folders.length === 0 ? (
        <EmptyState Icon={FolderOpen} title="Create your first reference folder" body="Make folders for visual styles, lighting, characters, products, compositions, or any category you want to reuse." action="Create a folder" onAction={props.onCreateFolder} />
      ) : (
        <div className="reference-folders">
          {props.folders.map((folder) => (
            <section className="reference-folder" key={folder.folderId}>
              <header>
                <div><span><FolderOpen size={18} /></span><div><h3>{folder.name}</h3><p>{folder.images.length} image{folder.images.length === 1 ? '' : 's'}</p></div></div>
                <div className="reference-folder-actions">
                  <button className="text-button" onClick={() => props.onAddImages(folder.folderId)} disabled={props.isMutating}><Upload size={15} /> Add images</button>
                  <button className="icon-button" onClick={() => props.onRenameFolder(folder)} aria-label={`Rename ${folder.name}`} disabled={props.isMutating}><Pencil size={15} /></button>
                  <button className="icon-button danger" onClick={() => props.onDeleteFolder(folder)} aria-label={`Delete ${folder.name}`} disabled={props.isMutating}><Trash2 size={15} /></button>
                </div>
              </header>
              {folder.images.length === 0 ? (
                <button className="reference-folder-empty" onClick={() => props.onAddImages(folder.folderId)} disabled={props.isMutating}><ImagePlus size={22} /><span>Add PNG, JPEG, or WebP references</span><small>Up to 10 MB each</small></button>
              ) : (
                <div className="reference-grid">
                  {folder.images.map((image) => {
                    const imageUrl = `/api/reference-folders/${image.folderId}/images/${image.imageId}/content`;
                    return (
                      <article className="reference-card" key={image.imageId}>
                        <button className="reference-preview" onClick={() => props.onUseImage(image)} title="Use this reference"><img src={imageUrl} alt={image.name} /><span>Use reference</span></button>
                        <div className="reference-card-meta"><div><strong>{image.name}</strong><small>{image.width} × {image.height} · {formatBytes(image.byteLength)}</small></div><button className="icon-button" onClick={() => props.onRenameImage(image)} aria-label={`Rename ${image.name}`} disabled={props.isMutating}><Pencil size={14} /></button><button className="icon-button danger" onClick={() => props.onDeleteImage(image)} aria-label={`Delete ${image.name}`} disabled={props.isMutating}><Trash2 size={14} /></button></div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

export function PresetsView({ prompts, onUse, onDelete, onCreate }: { prompts: string[]; onUse: (prompt: string) => void; onDelete: (prompt: string) => void; onCreate: () => void }) {
  return (
    <div className="library-page surface-enter"><div className="library-heading"><div><h2>Saved presets</h2><p>Reusable prompt directions stored only in this browser.</p></div><button className="primary-small" onClick={onCreate}><Plus size={16} /> New prompt</button></div>{prompts.length === 0 ? <EmptyState Icon={Bookmark} title="Save your best prompts" body="Use Save in the composer to build a reusable prompt library." action="Write a prompt" onAction={onCreate} /> : <div className="preset-grid">{prompts.map((value, index) => <article className="preset-card" key={value}><span>Preset {String(index + 1).padStart(2, '0')}</span><p>{value}</p><div><button onClick={() => onUse(value)}><WandSparkles size={15} /> Use preset</button><button className="icon-button" onClick={() => onDelete(value)} aria-label="Delete preset"><Trash2 size={15} /></button></div></article>)}</div>}</div>
  );
}

function EmptyState({ Icon, title, body, action, onAction }: { Icon: LucideIcon; title: string; body: string; action: string; onAction: () => void }) {
  return <div className="empty-state"><span><Icon size={30} /></span><h3>{title}</h3><p>{body}</p><button className="primary-small" onClick={onAction}>{action}</button></div>;
}

export function Modal({ title, className, onClose, children }: { title: string; className?: string; onClose: () => void; children: ReactNode }) {
  return <div className="modal-backdrop surface-enter" onMouseDown={onClose}><section className={`modal surface-enter ${className ?? ''}`} role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}><header><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={18} /></button></header><div className="modal-body">{children}</div></section></div>;
}

export function ShortcutList() {
  const shortcuts = [['Focus prompt', '⌘ K'], ['Create', '⌘ Enter'], ['Add source image', '⌘ ⇧ O'], ['Open shortcuts', '⌘ /'], ['Close menu or dialog', 'Esc']];
  return <div className="shortcut-list"><div className="shortcut-hero"><Keyboard size={25} /><p>Move quickly around Baroque.</p></div>{shortcuts.map(([label, keys]) => <div key={label}><span>{label}</span><kbd>{keys}</kbd></div>)}</div>;
}
