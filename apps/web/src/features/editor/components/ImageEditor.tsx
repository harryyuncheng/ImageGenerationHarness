import { ArrowLeft, CloudOff, Download, Maximize2, MoreHorizontal, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import type { RunStatus } from '../../history/run-presentation.js';
import { editorProgressMessage } from '../edit-tools-presentation.js';

export interface ImageEditorProps {
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

/** The canvas surface for a run, a saved image, or a local upload. */
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
  const imageLoaded = selectedImage !== undefined && loadedImageKey === selectedImage.key;
  const imageFailed = selectedImage !== undefined && failedImageKey === selectedImage.key;
  const active = ['submitting', 'queued', 'running'].includes(props.status);
  const terminal = ['failed', 'cancelled', 'interrupted'].includes(props.status);
  const terminalWithoutImage = selectedImage === undefined && terminal;

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
          <button
            className="icon-button"
            onClick={props.onClose}
            aria-label="Back from image editor"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <span>{props.location}</span>
            <h2>{props.prompt.length > 0 ? props.prompt : 'Generated image'}</h2>
          </div>
        </div>
        <span className={`image-editor-status image-editor-status--${props.status}`}>
          {props.statusLabel ?? props.status}
        </span>
      </header>
      <div className={`image-editor ${props.editMode ? 'image-editor--editing' : ''}`}>
        <div
          className={`image-editor-preview ${terminalWithoutImage || imageFailed ? 'image-editor-preview--error' : ''}`}
        >
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
              onError={() => {
                setFailedImageKey(selectedImage.key);
              }}
            />
          )}
          {!imageLoaded && (
            <div className="image-editor-progress" role="status" aria-live="polite">
              {terminalWithoutImage || imageFailed ? (
                <CloudOff size={30} />
              ) : (
                <span className="loader-ring" />
              )}
              <strong>
                {imageFailed
                  ? 'Image preview unavailable.'
                  : editorProgressMessage(props.status, selectedImage !== undefined)}
              </strong>
              <small>
                {imageFailed
                  ? 'The image may still be available through Full screen or Download.'
                  : (props.error ??
                    `${String(props.expectedImageCount)} image${props.expectedImageCount === 1 ? '' : 's'} requested`)}
              </small>
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
                    onClick={() => {
                      setSelectedIndex(index);
                    }}
                    aria-label={`View output ${String(index + 1)}`}
                    aria-pressed={image.key === selectedImage?.key}
                  >
                    <img src={image.url} alt="" />
                  </button>
                ))}
              </div>
            )}
            <dl>
              <div>
                <dt>Created</dt>
                <dd>{new Date(props.createdAt).toLocaleString()}</dd>
              </div>
              <div>
                <dt>Output</dt>
                <dd>
                  {selectedImage
                    ? `${String(selectedIndex + 1)} of ${String(images.length)}`
                    : `Waiting for ${String(props.expectedImageCount)}`}
                </dd>
              </div>
              {selectedImageId && (
                <div>
                  <dt>Image ID</dt>
                  <dd>{selectedImageId}</dd>
                </div>
              )}
            </dl>
            {props.error && <p className="image-editor-error">{props.error}</p>}
            <div className="image-editor-actions">
              {selectedImageId && props.onMetadata && (
                <button
                  className="text-button"
                  onClick={() => {
                    props.onMetadata?.(selectedImageId);
                  }}
                >
                  <MoreHorizontal size={15} /> Metadata
                </button>
              )}
              {selectedImage && (
                <a
                  className="text-button"
                  href={selectedImage.url}
                  download={selectedImage.downloadName ?? true}
                >
                  <Download size={15} /> Download
                </a>
              )}
              {selectedImage && (
                <a
                  className="text-button"
                  href={selectedImage.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Maximize2 size={15} /> Full screen
                </a>
              )}
              {active && props.onCancel && (
                <button className="text-button danger" onClick={props.onCancel}>
                  Cancel generation
                </button>
              )}
              {!active && terminal && props.onRetry && (
                <button className="text-button" onClick={props.onRetry}>
                  <RefreshCw size={15} /> Retry
                </button>
              )}
              <button className="primary-small" onClick={props.onRemix}>
                <RefreshCw size={15} /> Remix
              </button>
            </div>
          </aside>
        )}
      </div>
    </section>
  );
}
