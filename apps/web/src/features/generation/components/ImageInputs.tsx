import { X } from 'lucide-react';
import type { Capability } from '../../../shared/types/domain.js';
import { ImageViewer } from '../../editor/components/ImageViewer.js';
import type { LoadedImage } from '../../editor/use-loaded-image.js';
import { mainSourceImage } from '../model-presentation.js';
import type { AttachmentsController } from '../use-attachments.js';

export function ImageInputs({
  attachments,
  capability,
  loaded,
  onSourceImageReady,
}: {
  attachments: AttachmentsController;
  capability: Capability;
  loaded: LoadedImage | undefined;
  onSourceImageReady: (image: HTMLImageElement | null) => void;
}) {
  const input = mainSourceImage(attachments.inputs);
  const label = capability.canonicalId === 'service/style-transfer' ? 'Content' : 'Source';
  const referenceGeneration =
    capability.maxInputImages !== undefined && capability.category === 'generation';
  const showPreview =
    loaded !== undefined &&
    ((loaded.isPending && input === undefined) ||
      (loaded.selectedOutput !== undefined &&
        (attachments.roles.length === 0 || referenceGeneration)));

  return (
    <section className="image-workspace" aria-label={input ? 'Image inputs' : 'Image output'}>
      <div className="image-input-grid">
        {input && (
          <section
            className="image-input-panel"
            data-input-role="source"
            data-input-id={input.id}
            aria-label={`${label} image input`}
            onDrop={(event) => {
              event.stopPropagation();
              attachments.handleDrop(event, 'source');
            }}
          >
            <ImageViewer
              image={
                loaded && (loaded.isPending || loaded.selectedOutput?.imageId === input.id)
                  ? loaded
                  : input
              }
              onImageReady={onSourceImageReady}
            >
              <button
                type="button"
                className="image-input-remove"
                title={`Remove ${label.toLowerCase()} image`}
                aria-label={`Remove ${label.toLowerCase()} image`}
                onClick={() => {
                  attachments.removeInput('source', input.id);
                }}
              >
                <X size={20} aria-hidden="true" />
              </button>
            </ImageViewer>
          </section>
        )}
        {showPreview && (
          <section className="image-input-panel">
            <ImageViewer image={loaded} />
          </section>
        )}
      </div>
    </section>
  );
}

export function ReferenceInputs({ attachments }: { attachments: AttachmentsController }) {
  const references = attachments.inputs.references.filter(
    (image) => image.source !== 'style-guide',
  );
  if (references.length === 0) return null;

  return (
    <section
      className="image-reference-stack"
      data-input-role="references"
      aria-label="Reference images"
      onDrop={(event) => {
        event.stopPropagation();
        attachments.handleDrop(event, 'references');
      }}
    >
      {references.map((image) => (
        <figure className="image-reference" key={image.id} data-input-id={image.id}>
          <img src={image.previewUrl} alt={image.name} />
          <button
            type="button"
            className="image-input-remove"
            aria-label={`Remove reference: ${image.name}`}
            onClick={() => {
              attachments.removeInput('references', image.id);
            }}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </figure>
      ))}
    </section>
  );
}
