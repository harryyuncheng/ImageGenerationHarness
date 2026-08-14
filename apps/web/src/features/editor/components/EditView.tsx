import { CloudOff, Image as ImageIcon, ImagePlus, Upload, X } from 'lucide-react';
import { useState } from 'react';
import { GeneratedImageCard } from '../../../shared/components/GeneratedImageCard.js';
import type { GalleryImage, Project } from '../../../shared/types/domain.js';

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
      props.projects.find((project) => project.projectId === image.projectId)?.name ?? 'Project';
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
          onDragOver={(event) => {
            event.preventDefault();
          }}
          onDragLeave={() => {
            setDragActive(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setDragActive(false);
            props.onDropFiles(Array.from(event.dataTransfer.files));
          }}
        >
          <div className="edit-canvas-empty">
            <span>
              <ImagePlus size={27} />
            </span>
            <h3>Add an image to edit</h3>
            <p>Drop an image here, upload one, or choose from your Baroque repository.</p>
            <div>
              <button className="primary-small" onClick={props.onUpload}>
                <Upload size={16} /> Upload image
              </button>
              <button className="text-button" onClick={openBaroqueImages}>
                <ImageIcon size={16} /> Choose from Baroque
              </button>
            </div>
            <small>PNG, JPEG, or WebP up to 10 MB</small>
          </div>

          {showBaroqueImages && (
            <div
              className="edit-image-picker-backdrop surface-enter"
              onMouseDown={() => {
                setShowBaroqueImages(false);
              }}
            >
              <section
                className="edit-image-picker surface-enter"
                role="dialog"
                aria-modal="true"
                aria-label="Choose from Baroque"
                onMouseDown={(event) => {
                  event.stopPropagation();
                }}
              >
                <header>
                  <div>
                    <span>Baroque repository</span>
                    <h3>Choose an image</h3>
                  </div>
                  <button
                    className="icon-button"
                    onClick={() => {
                      setShowBaroqueImages(false);
                    }}
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
                      <button className="text-button" onClick={props.onRetry}>
                        Try again
                      </button>
                    </div>
                  ) : props.isLoading ? (
                    <div className="edit-picker-state">
                      <span className="loader-ring" />
                      <p>Loading images…</p>
                    </div>
                  ) : props.images.length === 0 ? (
                    <div className="edit-picker-state">
                      <ImageIcon size={25} />
                      <strong>No images yet</strong>
                      <p>Generated images saved in this repository will appear here.</p>
                    </div>
                  ) : (
                    <div className="gallery-grid">
                      {props.images.map((image) => {
                        const location = imageLocation(image);
                        return (
                          <GeneratedImageCard
                            key={image.imageId}
                            image={image}
                            subtitle={location.replace('Baroque / ', '')}
                            onOpen={(selected) => {
                              props.onOpenImage(selected, location);
                            }}
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
