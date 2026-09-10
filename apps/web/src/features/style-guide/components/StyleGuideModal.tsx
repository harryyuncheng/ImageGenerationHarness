import { ArrowLeft, Check, CloudOff, ImagePlus, Plus, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';
import { createPortal } from 'react-dom';
import { EmptyState } from '../../../shared/components/EmptyState.js';
import { LibraryInfo } from '../../../shared/components/LibraryInfo.js';
import { useModalDialog } from '../../../shared/hooks/use-modal-dialog.js';
import type { StyleGuideFolder, StyleGuideImage } from '../../../shared/types/domain.js';
import { styleGuideImageContentUrl } from '../api.js';
import { useStyleGuideTransition } from '../use-style-guide-transition.js';
import {
  StyleGuideFolderActions,
  StyleGuideFolderHeading,
  StyleGuideFolderPanel,
} from './StyleGuideFolderPanel.js';
import type { FanOrigin } from './StyleGuideStack.js';

const dialogId = 'style-guide-dialog';

interface StyleGuideModalProps {
  folders: StyleGuideFolder[];
  activeFolderId: string | null;
  appliedImages: readonly StyleGuideImage[];
  origins: readonly FanOrigin[];
  fanRef: RefObject<HTMLButtonElement | null>;
  isLoading: boolean;
  isMutating: boolean;
  feedback: ReactNode;
  error?: string;
  onClose: () => void;
  onCreateFolder: () => void;
  onRenameFolder: (folder: StyleGuideFolder, name: string) => void;
  onDeleteFolder: (folder: StyleGuideFolder) => void;
  onAddImages: (folderId: string) => void;
  onToggleActive: (folder: StyleGuideFolder) => void;
  onRenameImage: (image: StyleGuideImage, name: string) => void;
  onDeleteImage: (image: StyleGuideImage) => void;
  onToggleImage: (image: StyleGuideImage) => void;
  onRetry: () => void;
}

export function StyleGuideModal(props: StyleGuideModalProps) {
  const { folders, activeFolderId, origins } = props;
  const navigationButton = useRef<HTMLButtonElement>(null);
  const [viewedFolderId, setViewedFolderId] = useState<string | null>(activeFolderId);
  const viewedFolder = folders.find((folder) => folder.folderId === viewedFolderId);
  const transition = useStyleGuideTransition({
    fanRef: props.fanRef,
    origins,
    viewedFolderId: viewedFolder?.folderId,
    onClose: props.onClose,
  });
  const dialog = useModalDialog(transition.close);

  useEffect(() => {
    navigationButton.current?.focus({ preventScroll: true });
  }, [viewedFolder?.folderId]);

  return createPortal(
    <div ref={transition.backdropRef} className="style-guide-backdrop style-guide-backdrop--motion">
      <section
        {...dialog}
        inert={transition.closing}
        id={dialogId}
        className="style-guide-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${dialogId}-title`}
      >
        <header
          className={`style-guide-dialog__header ${viewedFolder ? 'style-guide-dialog__header--folder' : ''}`}
        >
          <div className="style-guide-dialog__title">
            {viewedFolder && (
              <button
                ref={navigationButton}
                type="button"
                className="icon-button"
                aria-label="Back to style guide gallery"
                title="All style guides"
                onClick={() => {
                  setViewedFolderId(null);
                }}
              >
                <ArrowLeft size={18} />
              </button>
            )}
            {viewedFolder ? (
              <StyleGuideFolderHeading
                folder={viewedFolder}
                titleId={`${dialogId}-title`}
                isMutating={props.isMutating}
                onRenameFolder={props.onRenameFolder}
              />
            ) : (
              <>
                <h2 id={`${dialogId}-title`}>Style guides</h2>
                <LibraryInfo label="What is a style guide?">
                  Style guide images help shape the look and feel of your generated image.
                </LibraryInfo>
              </>
            )}
          </div>
          <div className="style-guide-dialog__header-actions">
            {viewedFolder ? (
              <StyleGuideFolderActions
                folder={viewedFolder}
                applied={viewedFolder.folderId === activeFolderId}
                isMutating={props.isMutating}
                onDeleteFolder={props.onDeleteFolder}
                onAddImages={props.onAddImages}
                onToggleActive={(folder) => {
                  props.onToggleActive(folder);
                  if (folder.folderId !== activeFolderId) transition.close();
                }}
              />
            ) : (
              <button
                className="primary-small"
                onClick={props.onCreateFolder}
                disabled={props.isMutating}
              >
                <Plus size={16} /> New style guide
              </button>
            )}
            <button
              ref={viewedFolder ? undefined : navigationButton}
              type="button"
              className="icon-button"
              onClick={transition.close}
              aria-label="Close style guide"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        <div className="style-guide-dialog__body" key={viewedFolder?.folderId ?? 'gallery'}>
          {props.feedback}
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
          ) : viewedFolder ? (
            <StyleGuideFolderPanel
              folder={viewedFolder}
              appliedImages={props.appliedImages}
              isMutating={props.isMutating}
              onAddImages={props.onAddImages}
              onRenameImage={props.onRenameImage}
              onDeleteImage={props.onDeleteImage}
              onToggleImage={props.onToggleImage}
            />
          ) : folders.length > 0 ? (
            <StyleGuideGallery
              folders={folders}
              activeFolderId={activeFolderId}
              onOpenFolder={setViewedFolderId}
            />
          ) : (
            <EmptyState
              Icon={ImagePlus}
              title="Create your first style guide"
              body="Create visual guides to reuse styles, lighting, subjects and compositions across generations"
              action="Create a style guide"
              onAction={props.onCreateFolder}
            />
          )}
        </div>
      </section>
    </div>,
    document.body,
  );
}

function StyleGuideGallery({
  folders,
  activeFolderId,
  onOpenFolder,
}: {
  folders: StyleGuideFolder[];
  activeFolderId: string | null;
  onOpenFolder: (folderId: string) => void;
}) {
  return (
    <div className="style-guide-grid" role="group" aria-label="Style guide gallery">
      {folders.map((folder) => {
        const applied = folder.folderId === activeFolderId;
        return (
          <button
            key={folder.folderId}
            type="button"
            className={`style-guide-folder-card ${applied ? 'applied' : ''}`}
            aria-label={`Open ${folder.name}${applied ? ' (applied)' : ''}`}
            title={folder.name}
            onClick={() => {
              onOpenFolder(folder.folderId);
            }}
          >
            <span
              className="style-guide-folder-cover"
              data-image-count={Math.min(folder.images.length, 4)}
              aria-hidden="true"
            >
              {folder.images.slice(0, 4).map((image) => (
                <img
                  key={image.imageId}
                  src={styleGuideImageContentUrl(image.folderId, image.imageId)}
                  alt=""
                  loading="lazy"
                />
              ))}
              {folder.images.length === 0 && <Plus size={26} />}
            </span>
            <span className="style-guide-folder-label">
              <span>{folder.name}</span>
              {applied && <Check size={14} aria-hidden="true" />}
            </span>
          </button>
        );
      })}
    </div>
  );
}
