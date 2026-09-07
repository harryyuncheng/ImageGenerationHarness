import { Check, CloudOff, ImagePlus, Info, Plus, X } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { EmptyState } from '../../../shared/components/EmptyState.js';
import type { StyleGuideFolder, StyleGuideImage } from '../../../shared/types/domain.js';
import { StyleGuideFolderPanel } from './StyleGuideFolderPanel.js';
import type { FanOrigin } from './StyleGuideStack.js';

const dialogId = 'style-guide-dialog';
const focusableSelector = [
  'button:not([disabled]):not([tabindex="-1"])',
  'a[href]',
  'input:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

const flyEasing = 'cubic-bezier(0.22, 1, 0.36, 1)';

interface StyleGuideModalProps {
  folders: StyleGuideFolder[];
  activeFolderId: string | null;
  appliedImages: readonly StyleGuideImage[];
  origins: readonly FanOrigin[];
  isLoading: boolean;
  isMutating: boolean;
  error?: string;
  onClose: () => void;
  onCreateFolder: () => void;
  onRenameFolder: (folder: StyleGuideFolder, name: string) => void;
  onDeleteFolder: (folder: StyleGuideFolder) => void;
  onAddImages: (folderId: string) => void;
  onToggleActive: (folder: StyleGuideFolder) => void;
  onRenameImage: (image: StyleGuideImage) => void;
  onDeleteImage: (image: StyleGuideImage) => void;
  onExcludeImage: (image: StyleGuideImage) => void;
  onRetry: () => void;
}

export function StyleGuideModal(props: StyleGuideModalProps) {
  const { folders, activeFolderId, origins } = props;
  const dialog = useRef<HTMLElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const [viewedFolderId, setViewedFolderId] = useState<string | null>(activeFolderId);
  const flown = useRef(false);

  const viewedFolder =
    folders.find((folder) => folder.folderId === viewedFolderId) ?? folders.at(0);

  useEffect(() => {
    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    return () => {
      if (previouslyFocused?.isConnected) previouslyFocused.focus({ preventScroll: true });
    };
  }, []);

  const { onClose } = props;
  useEffect(() => {
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [onClose]);

  /**
   * Flies the fan tiles from their on-screen geometry into the matching grid cells, then
   * fades the rest of the folder in behind them. Runs once per open.
   */
  useLayoutEffect(() => {
    if (flown.current || !grid.current) return;
    if (viewedFolder?.folderId !== activeFolderId || origins.length === 0) return;
    flown.current = true;

    const cells = Array.from(grid.current.querySelectorAll<HTMLElement>('.style-guide-card'));
    cells.forEach((cell, index) => {
      const target = cell.getBoundingClientRect();
      const origin = origins[index];
      if (!origin) {
        cell.animate(
          [
            { opacity: 0, transform: 'scale(0.94)' },
            { opacity: 1, transform: 'none' },
          ],
          { duration: 260, delay: 150 + index * 22, easing: flyEasing, fill: 'backwards' },
        );
        return;
      }
      const scale = origin.width / target.width;
      const deltaX = origin.centerX - (target.left + target.width / 2);
      const deltaY = origin.centerY - (target.top + target.height / 2);
      cell.animate(
        [
          {
            transform: `translate(${String(deltaX)}px, ${String(deltaY)}px) rotate(${origin.rotate}) scale(${String(scale)})`,
          },
          { transform: 'none' },
        ],
        { duration: 420, easing: flyEasing },
      );
      // Counter-scaled so the corners read as the fan tile's radius for the whole flight.
      cell
        .querySelector('.style-guide-preview')
        ?.animate([{ borderRadius: `${String(22 / scale)}px` }, { borderRadius: '' }], {
          duration: 420,
          easing: flyEasing,
        });
      // The fan shows bare images, so captions arrive only once the tile has landed.
      cell
        .querySelector('.style-guide-card-meta')
        ?.animate([{ opacity: 0 }, { opacity: 0, offset: 0.6 }, { opacity: 1 }], {
          duration: 520,
          easing: 'ease-out',
        });
    });
  }, [viewedFolder, activeFolderId, origins]);

  function trapFocus(event: ReactKeyboardEvent<HTMLElement>) {
    if (event.key !== 'Tab') return;
    const focusable = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(focusableSelector),
    );
    const first = focusable.at(0);
    const last = focusable.at(-1);
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return createPortal(
    <div
      className="style-guide-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) props.onClose();
      }}
    >
      <section
        ref={dialog}
        id={dialogId}
        className="style-guide-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${dialogId}-title`}
        onKeyDown={trapFocus}
      >
        <header className="style-guide-dialog__header">
          <div className="style-guide-dialog__title">
            <h2 id={`${dialogId}-title`}>Style guide</h2>
            <StyleGuideInfo />
          </div>
          <div className="style-guide-dialog__header-actions">
            <button
              className="primary-small"
              onClick={props.onCreateFolder}
              disabled={props.isMutating}
            >
              <Plus size={16} /> New style guide
            </button>
            <button
              type="button"
              className="icon-button"
              onClick={props.onClose}
              aria-label="Close style guide"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        {folders.length > 1 && (
          <div className="style-guide-folder-rail" role="tablist" aria-label="Style guides">
            {folders.map((folder) => (
              <button
                key={folder.folderId}
                type="button"
                role="tab"
                aria-selected={folder.folderId === viewedFolder?.folderId}
                className={`style-guide-folder-chip ${folder.folderId === viewedFolder?.folderId ? 'selected' : ''}`}
                onClick={() => {
                  setViewedFolderId(folder.folderId);
                }}
              >
                <span>{folder.name}</span>
                {folder.folderId === activeFolderId && <Check size={13} aria-label="Applied" />}
              </button>
            ))}
          </div>
        )}

        <div className="style-guide-dialog__body">
          {props.error ? (
            <EmptyState
              Icon={CloudOff}
              title="Style guide unavailable"
              body={props.error}
              action="Try again"
              onAction={props.onRetry}
            />
          ) : props.isLoading ? (
            <div className="library-loading">
              <span className="loader-ring" />
              <p>Loading your style guide…</p>
            </div>
          ) : !viewedFolder ? (
            <EmptyState
              Icon={ImagePlus}
              title="Create your first style guide"
              body="Create visual guides to reuse styles, lighting, subjects and compositions across generations"
              action="Create a style guide"
              onAction={props.onCreateFolder}
            />
          ) : (
            <>
              <StyleGuideFolderPanel
                folder={viewedFolder}
                applied={viewedFolder.folderId === activeFolderId}
                appliedImages={props.appliedImages}
                isMutating={props.isMutating}
                gridRef={grid}
                onRenameFolder={props.onRenameFolder}
                onDeleteFolder={props.onDeleteFolder}
                onAddImages={props.onAddImages}
                onToggleActive={props.onToggleActive}
                onRenameImage={props.onRenameImage}
                onDeleteImage={props.onDeleteImage}
                onExcludeImage={props.onExcludeImage}
              />
            </>
          )}
        </div>
      </section>
    </div>,
    document.body,
  );
}

function StyleGuideInfo() {
  return (
    <span className="style-guide-info">
      <button
        type="button"
        className="icon-button style-guide-info__trigger"
        aria-label="What is a style guide?"
        aria-describedby={`${dialogId}-info`}
      >
        <Info size={15} />
      </button>
      <p className="style-guide-info__bubble" id={`${dialogId}-info`} role="tooltip">
        A style guide is a set of images that share a look. Apply one to fill the model's image
        inputs. GPT Image 2 accepts up to 16 references in Create, or a source plus 15 references in
        Edit. Describe how to use them in your prompt. Active guides are previewed at the left;
        exclude images from the request here without deleting their files.
      </p>
    </span>
  );
}
