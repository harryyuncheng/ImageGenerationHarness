import { Check, ImagePlus, Minus, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import { useState, type RefObject } from 'react';
import { formatBytes } from '../../../shared/format.js';
import type { StyleGuideFolder, StyleGuideImage } from '../../../shared/types/domain.js';
import { styleGuideImageContentUrl } from '../api.js';

export function StyleGuideFolderPanel({
  folder,
  applied,
  appliedImages,
  isMutating,
  gridRef,
  onRenameFolder,
  onDeleteFolder,
  onAddImages,
  onToggleActive,
  onRenameImage,
  onDeleteImage,
  onExcludeImage,
}: {
  folder: StyleGuideFolder;
  applied: boolean;
  appliedImages: readonly StyleGuideImage[];
  isMutating: boolean;
  gridRef: RefObject<HTMLDivElement | null>;
  onRenameFolder: (folder: StyleGuideFolder, name: string) => void;
  onDeleteFolder: (folder: StyleGuideFolder) => void;
  onAddImages: (folderId: string) => void;
  onToggleActive: (folder: StyleGuideFolder) => void;
  onRenameImage: (image: StyleGuideImage) => void;
  onDeleteImage: (image: StyleGuideImage) => void;
  onExcludeImage: (image: StyleGuideImage) => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState('');

  return (
    <>
      <div className="style-guide-folder-bar">
        <div>
          {renaming ? (
            <input
              className="style-guide-folder-name-input"
              value={draftName}
              aria-label="Style guide name"
              autoFocus
              onFocus={(event) => {
                event.target.select();
              }}
              onChange={(event) => {
                setDraftName(event.target.value);
              }}
              onBlur={() => {
                onRenameFolder(folder, draftName);
                setRenaming(false);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  event.currentTarget.blur();
                }
                if (event.key === 'Escape') {
                  event.stopPropagation();
                  setDraftName(folder.name);
                  setRenaming(false);
                }
              }}
            />
          ) : (
            <button
              type="button"
              className="style-guide-folder-name"
              title="Rename this style guide"
              onClick={() => {
                setDraftName(folder.name);
                setRenaming(true);
              }}
            >
              <h3>{folder.name}</h3>
            </button>
          )}
          <p>
            {folder.images.length} image{folder.images.length === 1 ? '' : 's'}
          </p>
        </div>
        <div className="style-guide-folder-actions">
          <button
            className={applied ? 'primary-small' : 'text-button'}
            onClick={() => {
              onToggleActive(folder);
            }}
            aria-pressed={applied}
            disabled={isMutating}
          >
            {applied ? <Check size={15} /> : null} {applied ? 'Applied' : 'Apply'}
          </button>
          <button
            className="text-button"
            onClick={() => {
              onAddImages(folder.folderId);
            }}
            disabled={isMutating}
          >
            <Upload size={15} /> Add images
          </button>
          <button
            className="text-button danger"
            onClick={() => {
              onDeleteFolder(folder);
            }}
            disabled={isMutating}
          >
            <Trash2 size={15} /> Delete guide
          </button>
        </div>
      </div>

      {folder.images.length === 0 ? (
        <button
          className="style-guide-folder-empty"
          onClick={() => {
            onAddImages(folder.folderId);
          }}
          disabled={isMutating}
        >
          <ImagePlus size={22} />
          <span>Add PNG, JPEG, or WebP images</span>
          <small>Up to 10 MB each</small>
        </button>
      ) : (
        <div className="style-guide-grid" ref={gridRef}>
          {folder.images.map((image) => (
            <article className="style-guide-card" key={image.imageId}>
              <div className="style-guide-preview">
                <img
                  src={styleGuideImageContentUrl(image.folderId, image.imageId)}
                  alt={image.name}
                />
              </div>
              <div className="style-guide-card-meta">
                <div>
                  <strong>{image.name}</strong>
                  <small>
                    {image.width} × {image.height} · {formatBytes(image.byteLength)}
                  </small>
                </div>
                {appliedImages.some((selected) => selected.imageId === image.imageId) && (
                  <button
                    type="button"
                    className="icon-button"
                    title="Remove from the request without deleting the image"
                    aria-label={`Exclude ${image.name} from request`}
                    onClick={() => {
                      onExcludeImage(image);
                    }}
                  >
                    <Minus size={14} />
                  </button>
                )}
                <button
                  className="icon-button"
                  onClick={() => {
                    onRenameImage(image);
                  }}
                  aria-label={`Rename ${image.name}`}
                  disabled={isMutating}
                >
                  <Pencil size={14} />
                </button>
                <button
                  className="icon-button danger"
                  onClick={() => {
                    onDeleteImage(image);
                  }}
                  aria-label={`Delete ${image.name}`}
                  disabled={isMutating}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </article>
          ))}
          <button
            type="button"
            className="style-guide-add-tile"
            aria-label="Add images to this style guide"
            title="Add images"
            onClick={() => {
              onAddImages(folder.folderId);
            }}
            disabled={isMutating}
          >
            <Plus size={26} />
          </button>
        </div>
      )}
    </>
  );
}
