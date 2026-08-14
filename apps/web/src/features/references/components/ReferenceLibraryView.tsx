import { CloudOff, FolderOpen, FolderPlus, ImagePlus, Pencil, Trash2, Upload } from 'lucide-react';
import { EmptyState } from '../../../shared/components/EmptyState.js';
import { formatBytes } from '../../../shared/format.js';
import type { ReferenceFolder, ReferenceImage } from '../../../shared/types/domain.js';
import { referenceImageContentUrl } from '../api.js';

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
        <button
          className="primary-small"
          onClick={props.onCreateFolder}
          disabled={props.isMutating}
        >
          <FolderPlus size={16} /> New folder
        </button>
      </div>
      {props.error ? (
        <EmptyState
          Icon={CloudOff}
          title="Reference library unavailable"
          body={props.error}
          action="Try again"
          onAction={props.onRetry}
        />
      ) : props.isLoading ? (
        <div className="reference-loading">
          <span className="loader-ring" />
          <p>Loading your reference library…</p>
        </div>
      ) : props.folders.length === 0 ? (
        <EmptyState
          Icon={FolderOpen}
          title="Create your first reference folder"
          body="Make folders for visual styles, lighting, characters, products, compositions, or any category you want to reuse."
          action="Create a folder"
          onAction={props.onCreateFolder}
        />
      ) : (
        <div className="reference-folders">
          {props.folders.map((folder) => (
            <section className="reference-folder" key={folder.folderId}>
              <header>
                <div>
                  <span>
                    <FolderOpen size={18} />
                  </span>
                  <div>
                    <h3>{folder.name}</h3>
                    <p>
                      {folder.images.length} image{folder.images.length === 1 ? '' : 's'}
                    </p>
                  </div>
                </div>
                <div className="reference-folder-actions">
                  <button
                    className="text-button"
                    onClick={() => {
                      props.onAddImages(folder.folderId);
                    }}
                    disabled={props.isMutating}
                  >
                    <Upload size={15} /> Add images
                  </button>
                  <button
                    className="icon-button"
                    onClick={() => {
                      props.onRenameFolder(folder);
                    }}
                    aria-label={`Rename ${folder.name}`}
                    disabled={props.isMutating}
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    className="icon-button danger"
                    onClick={() => {
                      props.onDeleteFolder(folder);
                    }}
                    aria-label={`Delete ${folder.name}`}
                    disabled={props.isMutating}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </header>
              {folder.images.length === 0 ? (
                <button
                  className="reference-folder-empty"
                  onClick={() => {
                    props.onAddImages(folder.folderId);
                  }}
                  disabled={props.isMutating}
                >
                  <ImagePlus size={22} />
                  <span>Add PNG, JPEG, or WebP references</span>
                  <small>Up to 10 MB each</small>
                </button>
              ) : (
                <div className="reference-grid">
                  {folder.images.map((image) => (
                    <article className="reference-card" key={image.imageId}>
                      <button
                        className="reference-preview"
                        onClick={() => {
                          props.onUseImage(image);
                        }}
                        title="Use this reference"
                      >
                        <img
                          src={referenceImageContentUrl(image.folderId, image.imageId)}
                          alt={image.name}
                        />
                        <span>Use reference</span>
                      </button>
                      <div className="reference-card-meta">
                        <div>
                          <strong>{image.name}</strong>
                          <small>
                            {image.width} × {image.height} · {formatBytes(image.byteLength)}
                          </small>
                        </div>
                        <button
                          className="icon-button"
                          onClick={() => {
                            props.onRenameImage(image);
                          }}
                          aria-label={`Rename ${image.name}`}
                          disabled={props.isMutating}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          className="icon-button danger"
                          onClick={() => {
                            props.onDeleteImage(image);
                          }}
                          aria-label={`Delete ${image.name}`}
                          disabled={props.isMutating}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
