import { Check, Minus, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { formatBytes } from '../../../shared/format.js';
import type { StyleGuideFolder, StyleGuideImage } from '../../../shared/types/domain.js';
import { styleGuideImageContentUrl } from '../api.js';

export function StyleGuideFolderHeading({
  folder,
  titleId,
  isMutating,
  onRenameFolder,
}: {
  folder: StyleGuideFolder;
  titleId: string;
  isMutating: boolean;
  onRenameFolder: (folder: StyleGuideFolder, name: string) => void;
}) {
  return (
    <div className="style-guide-folder-heading">
      <h2 id={titleId} aria-label={folder.name}>
        <EditableName
          name={folder.name}
          label="Style guide name"
          disabled={isMutating}
          onRename={(name) => {
            onRenameFolder(folder, name);
          }}
        />
      </h2>
      <p>
        {folder.images.length} image{folder.images.length === 1 ? '' : 's'}
      </p>
    </div>
  );
}

function EditableName({
  name,
  label,
  disabled,
  onRename,
}: {
  name: string;
  label: string;
  disabled: boolean;
  onRename: (name: string) => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState('');

  return renaming ? (
    <input
      className="style-guide-name-input"
      value={draftName}
      aria-label={label}
      autoFocus
      disabled={disabled}
      onChange={(event) => {
        setDraftName(event.target.value);
      }}
      onBlur={() => {
        onRename(draftName);
        setRenaming(false);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          event.currentTarget.blur();
        }
        if (event.key === 'Escape') {
          event.stopPropagation();
          setDraftName(name);
          setRenaming(false);
        }
      }}
    />
  ) : (
    <button
      type="button"
      className="style-guide-name"
      title={`Rename ${name}`}
      disabled={disabled}
      onClick={() => {
        setDraftName(name);
        setRenaming(true);
      }}
    >
      {name}
    </button>
  );
}

export function StyleGuideFolderActions({
  folder,
  applied,
  isMutating,
  onDeleteFolder,
  onAddImages,
  onToggleActive,
}: {
  folder: StyleGuideFolder;
  applied: boolean;
  isMutating: boolean;
  onDeleteFolder: (folder: StyleGuideFolder) => void;
  onAddImages: (folderId: string) => void;
  onToggleActive: (folder: StyleGuideFolder) => void;
}) {
  return (
    <div className="style-guide-folder-actions">
      <button
        type="button"
        className={applied ? 'primary-small' : 'text-button'}
        onClick={() => {
          onToggleActive(folder);
        }}
        aria-label={applied ? 'Applied' : 'Apply'}
        title={applied ? 'Unapply style guide' : 'Apply style guide'}
        aria-pressed={applied}
        disabled={isMutating}
      >
        <Check size={15} /> <span>{applied ? 'Applied' : 'Apply'}</span>
      </button>
      <button
        type="button"
        className="text-button"
        aria-label="Add images"
        title="Add images"
        onClick={() => {
          onAddImages(folder.folderId);
        }}
        disabled={isMutating}
      >
        <Plus size={15} /> <span>Add images</span>
      </button>
      <button
        type="button"
        className="text-button danger"
        aria-label="Delete guide"
        title="Delete guide"
        onClick={() => {
          onDeleteFolder(folder);
        }}
        disabled={isMutating}
      >
        <Trash2 size={15} /> <span>Delete guide</span>
      </button>
    </div>
  );
}

export function StyleGuideFolderPanel({
  folder,
  appliedImages,
  isMutating,
  onAddImages,
  onRenameImage,
  onDeleteImage,
  onToggleImage,
}: {
  folder: StyleGuideFolder;
  appliedImages: readonly Pick<StyleGuideImage, 'imageId'>[];
  isMutating: boolean;
  onAddImages: (folderId: string) => void;
  onRenameImage: (image: StyleGuideImage, name: string) => void;
  onDeleteImage: (image: StyleGuideImage) => void;
  onToggleImage: (image: StyleGuideImage) => void;
}) {
  return (
    <div className="style-guide-grid">
      {folder.images.map((image) => {
        const included = appliedImages.some((selected) => selected.imageId === image.imageId);
        return (
          <article className="style-guide-card" key={image.imageId}>
            <div className="style-guide-preview" data-image-id={image.imageId}>
              <img
                src={styleGuideImageContentUrl(image.folderId, image.imageId)}
                alt={image.name}
              />
            </div>
            <div className="style-guide-card-meta">
              <div>
                <strong>
                  <EditableName
                    name={image.name}
                    label={`Image name for ${image.name}`}
                    disabled={isMutating}
                    onRename={(name) => {
                      onRenameImage(image, name);
                    }}
                  />
                </strong>
                <small>
                  {image.width} × {image.height} · {formatBytes(image.byteLength)}
                </small>
              </div>
              <button
                type="button"
                className="icon-button"
                title={included ? 'Remove from the request' : 'Include in the request'}
                aria-label={`${included ? 'Exclude' : 'Include'} ${image.name} ${included ? 'from' : 'in'} request`}
                aria-pressed={included}
                disabled={isMutating}
                onClick={() => {
                  onToggleImage(image);
                }}
              >
                {included ? <Minus size={14} /> : <Plus size={14} />}
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
        );
      })}
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
  );
}
