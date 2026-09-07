import { ImagePlus, Upload, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { formatBytes } from '../../../shared/format.js';
import type { Attachment } from '../../../shared/types/attachments.js';
import type { Capability } from '../../../shared/types/domain.js';
import { ImageViewer } from '../../editor/components/ImageViewer.js';
import type { LoadedImage } from '../../editor/use-loaded-image.js';
import { inputRoleLabel, mainImageInputs } from '../model-presentation.js';
import type { AttachmentsController } from '../use-attachments.js';

export function ImageInputs({
  attachments,
  capability,
  loaded,
  destination,
  onSourceImageReady,
  onReset,
}: {
  attachments: AttachmentsController;
  capability: Capability;
  loaded: LoadedImage | undefined;
  destination: ReactNode;
  onSourceImageReady: (image: HTMLImageElement | null) => void;
  onReset: () => void;
}) {
  const inputs = mainImageInputs(attachments.inputs);
  const references = inputs
    .filter((input) => input.role === 'references')
    .map((input) => input.image);
  const gridReferences = capability.maxInputImages !== undefined && references.length > 0;
  const singleInputs = inputs.filter((input) => input.role === 'source' || !gridReferences);
  const referenceGeneration =
    capability.maxInputImages !== undefined && capability.category === 'generation';
  const showPreview =
    loaded?.selectedOutput !== undefined && (attachments.roles.length === 0 || referenceGeneration);
  const controls = (
    <>
      {destination}
      <button type="button" className="loaded-image-reset" onClick={onReset}>
        Reset settings
      </button>
    </>
  );

  return (
    <section
      className="image-workspace"
      aria-label={inputs.length > 0 ? 'Image inputs' : 'Image output'}
    >
      <div
        className={`image-input-grid ${referenceGeneration && gridReferences && showPreview ? 'image-input-grid--with-preview' : ''}`}
      >
        {singleInputs.map(({ role, image: input }, index) => {
          const label = inputRoleLabel(capability, role);
          const displayed =
            role === 'source' && loaded && loaded.selectedOutput?.imageId === input.id
              ? loaded
              : input;
          return (
            <section
              key={role}
              className="image-input-panel"
              data-input-role={role}
              data-input-id={input.id}
              aria-label={`${label} image input`}
              onDrop={(event) => {
                event.stopPropagation();
                attachments.handleDrop(event, role);
              }}
            >
              <ImageViewer
                image={displayed}
                {...(role === 'source' ? { onImageReady: onSourceImageReady } : {})}
                header={
                  <>
                    {role === 'references' && <span className="image-input-caption">{label}</span>}
                    {index === 0 && controls}
                    <div className="image-input-actions">
                      <button
                        type="button"
                        className="icon-button"
                        title={`Replace ${label.toLowerCase()} image`}
                        aria-label={`Replace ${label.toLowerCase()} image`}
                        onClick={() => {
                          attachments.chooseFiles(role);
                        }}
                      >
                        <Upload size={14} />
                      </button>
                      <button
                        type="button"
                        className="icon-button"
                        title={`Remove ${label.toLowerCase()} image`}
                        aria-label={`Remove ${label.toLowerCase()} image`}
                        onClick={() => {
                          attachments.removeInput(role, input.id);
                        }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </>
                }
              />
            </section>
          );
        })}
        {gridReferences && (
          <ReferenceInputs
            attachments={attachments}
            capability={capability}
            references={references}
            controls={singleInputs.length === 0 && !showPreview ? controls : null}
          />
        )}
        {showPreview && (
          <section className="image-input-panel">
            <ImageViewer
              image={loaded}
              header={
                <>
                  <span
                    className="image-input-caption"
                    title={
                      referenceGeneration
                        ? 'Only the selected references are sent; this preview is not an input.'
                        : 'This model uses text only; the preview is not sent.'
                    }
                  >
                    Output preview
                  </span>
                  {controls}
                </>
              }
            />
          </section>
        )}
      </div>
    </section>
  );
}

function ReferenceInputs({
  attachments,
  capability,
  references,
  controls,
}: {
  attachments: AttachmentsController;
  capability: Capability;
  references: readonly Attachment[];
  controls: ReactNode;
}) {
  const allReferences = attachments.inputs.references;
  const full = allReferences.length >= attachments.referenceLimit;
  const referenceGeneration = capability.category === 'generation';

  return (
    <section
      className="image-input-panel image-input-panel--references"
      data-input-role="references"
      aria-label="Reference images"
      onDrop={(event) => {
        event.stopPropagation();
        attachments.handleDrop(event, 'references');
      }}
    >
      {controls && <div className="image-input-header">{controls}</div>}
      <header className="image-input-header">
        <span>
          <strong>References (optional)</strong>
          <small>
            {allReferences.length} / {attachments.referenceLimit} references
          </small>
        </span>
        <button
          type="button"
          className="icon-button"
          title="Add references"
          aria-label="Add references"
          disabled={full}
          onClick={() => {
            attachments.chooseFiles('references');
          }}
        >
          <ImagePlus size={14} />
        </button>
        <button
          type="button"
          className="icon-button"
          title="Remove all references"
          aria-label="Remove all references"
          onClick={() => {
            attachments.removeInput('references');
          }}
        >
          <X size={14} />
        </button>
      </header>
      <p className="image-reference-help">
        {referenceGeneration
          ? 'Create a new image using these references. Describe their style or role in your prompt.'
          : 'The source is image 1; its mask never applies to these references.'}
      </p>
      <div className="image-reference-grid">
        {references.map((image) => {
          const index = allReferences.findIndex((reference) => reference.id === image.id);
          return (
            <figure className="image-reference" key={image.id} data-input-id={image.id}>
              <img src={image.previewUrl} alt={image.name} />
              <span className="image-reference-number" title="Image number in the request">
                {index + (referenceGeneration ? 1 : 2)}
              </span>
              <button
                type="button"
                className="image-reference-remove"
                title={`Remove ${image.name}`}
                aria-label={`Remove reference ${String(index + 1)}: ${image.name}`}
                onClick={() => {
                  attachments.removeInput('references', image.id);
                }}
              >
                <X size={12} />
              </button>
              <figcaption title={`${image.name} · ${formatBytes(image.byteLength)}`}>
                {image.name}
              </figcaption>
            </figure>
          );
        })}
      </div>
    </section>
  );
}
