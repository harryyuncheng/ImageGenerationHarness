import { X } from 'lucide-react';
import { useStudioNavigate } from '../../../app/use-studio-navigate.js';
import type { Capability } from '../../../shared/types/domain.js';
import { ImageViewer } from '../../editor/components/ImageViewer.js';
import type { LoadedImage } from '../../editor/use-loaded-image.js';
import { mainSourceImage } from '../model-presentation.js';
import type { AttachmentsController } from '../use-attachments.js';

const outputDragType = 'application/x-harness-output';

export function ImageInputs({
  attachments,
  capability,
  loaded,
  onSourceImageReady,
  onOutputDrag,
}: {
  attachments: AttachmentsController;
  capability: Capability;
  loaded: LoadedImage | undefined;
  onSourceImageReady: (image: HTMLImageElement | null) => void;
  onOutputDrag: (dragging: boolean) => void;
}) {
  const navigate = useStudioNavigate();
  const input = mainSourceImage(attachments.inputs);
  const output = loaded?.selectedOutput;
  const label = capability.canonicalId === 'service/style-transfer' ? 'Content' : 'Source';
  const showPreview =
    loaded !== undefined && (loaded.isPending || loaded.selectedOutput !== undefined);

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
              image={input}
              onImageReady={onSourceImageReady}
              onRemove={() => {
                attachments.removeInput('source');
                navigate.closeFocus();
              }}
            />
          </section>
        )}
        {showPreview && (
          <section className="image-input-panel">
            <ImageViewer
              image={loaded}
              onRemove={navigate.closeFocus}
              {...(output
                ? {
                    onDragStart: (event) => {
                      event.dataTransfer.setData(outputDragType, output.imageId);
                      event.dataTransfer.effectAllowed = 'move';
                      onOutputDrag(true);
                    },
                    onDragEnd: () => {
                      onOutputDrag(false);
                    },
                  }
                : {})}
            />
          </section>
        )}
      </div>
    </section>
  );
}

export function ReferenceInputs({
  attachments,
  loaded,
  draggingOutput,
  onOutputDrag,
}: {
  attachments: AttachmentsController;
  loaded: LoadedImage | undefined;
  draggingOutput: boolean;
  onOutputDrag: (dragging: boolean) => void;
}) {
  const navigate = useStudioNavigate();
  const references = attachments.inputs.references.filter(
    (image) => image.source !== 'style-guide',
  );
  if (references.length === 0 && !draggingOutput) return null;

  return (
    <section
      className={`image-reference-stack ${draggingOutput ? 'image-reference-stack--drop-target' : ''}`}
      data-input-role="references"
      aria-label="Reference images"
      onDragOver={(event) => {
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = event.dataTransfer.types.includes(outputDragType)
          ? 'move'
          : 'copy';
      }}
      onDrop={(event) => {
        event.stopPropagation();
        if (!event.dataTransfer.types.includes(outputDragType)) {
          attachments.handleDrop(event, 'references');
          return;
        }
        event.preventDefault();
        onOutputDrag(false);
        const output = loaded?.selectedOutput;
        if (event.dataTransfer.getData(outputDragType) !== output?.imageId) {
          attachments.feedback.reportError('The displayed image changed. Drag the image again.');
          return;
        }
        if (
          attachments.moveOutputToReferences({
            source: 'repository',
            id: output.imageId,
            imageId: output.imageId,
            name: output.name,
            previewUrl: output.url,
            mediaType: output.mediaType,
            byteLength: output.byteLength,
          })
        )
          navigate.closeFocus();
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
