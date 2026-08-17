import { ChevronLeft, ChevronRight, CloudOff } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { isTerminalWithoutOutputStatus, type RunStatus } from '../../history/run-presentation.js';
import type { LoadedImage } from '../use-loaded-image.js';

interface SettledImage {
  url: string;
  failed: boolean;
  ratio: number;
}

function progressMessage(status: RunStatus, hasOutput: boolean): string {
  if (hasOutput) return 'Loading image…';
  if (status === 'submitting') return 'Submitting request…';
  if (status === 'queued') return 'Waiting for the local worker…';
  if (status === 'running') return 'Creating your image…';
  if (status === 'completed') return 'Finalizing the saved image…';
  if (status === 'cancelled') return 'This run was cancelled.';
  if (status === 'interrupted') return 'The server stopped during this run.';
  return 'Generation failed.';
}

/** The right half of the main area: the loaded image and nothing that competes with it. */
export function ImageViewer({
  loaded,
  destination,
  onReset,
}: {
  loaded: LoadedImage;
  destination: ReactNode;
  onReset: () => void;
}) {
  const [settled, setSettled] = useState<SettledImage>();
  const { selectedOutput, selectedIndex, outputCount, requestedOutputCount } = loaded;
  const current = settled?.url === selectedOutput?.url ? settled : undefined;
  const failed = current?.failed === true;
  const visible = current !== undefined && !current.failed;

  return (
    <section className="loaded-image" aria-label="Loaded image">
      {/* The measured ratio makes this box exactly the rendered image, so the row above
          it lines up with the artwork rather than with the surrounding column. */}
      <div
        className={`loaded-image-figure ${visible ? '' : 'loaded-image-figure--fill'} ${failed ? 'loaded-image-figure--error' : ''}`}
        {...(visible ? { style: { aspectRatio: String(current.ratio) } } : {})}
      >
        <div className="loaded-image-header">
          {destination}
          <button type="button" className="loaded-image-reset" onClick={onReset}>
            Reset settings
          </button>
        </div>
        {selectedOutput && (
          <img
            key={selectedOutput.url}
            className={visible ? 'is-loaded' : ''}
            src={selectedOutput.url}
            alt={loaded.prompt.length > 0 ? loaded.prompt : 'Generated image'}
            onLoad={(event) => {
              const { naturalWidth, naturalHeight } = event.currentTarget;
              setSettled({
                url: selectedOutput.url,
                failed: false,
                ratio: naturalWidth / naturalHeight,
              });
            }}
            onError={() => {
              setSettled({ url: selectedOutput.url, failed: true, ratio: 1 });
            }}
          />
        )}
        {!visible && (
          <div className="loaded-image-progress" role="status" aria-live="polite">
            {failed || isTerminalWithoutOutputStatus(loaded.status) ? (
              <CloudOff size={26} />
            ) : (
              <span className="loader-ring" />
            )}
            <strong>
              {failed
                ? 'Image preview unavailable.'
                : progressMessage(loaded.status, selectedOutput !== undefined)}
            </strong>
            <small>
              {failed
                ? 'The image may still be available through Download in the Export tab.'
                : (loaded.error ??
                  `${String(requestedOutputCount)} image${requestedOutputCount === 1 ? '' : 's'} requested`)}
            </small>
          </div>
        )}
        {outputCount > 1 && (
          <>
            <button
              type="button"
              className="loaded-image-arrow loaded-image-arrow--previous"
              disabled={selectedIndex === 0}
              aria-label="Previous output"
              onClick={() => {
                loaded.showOutput(selectedIndex - 1);
              }}
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              className="loaded-image-arrow loaded-image-arrow--next"
              disabled={selectedIndex === outputCount - 1}
              aria-label="Next output"
              onClick={() => {
                loaded.showOutput(selectedIndex + 1);
              }}
            >
              <ChevronRight size={18} />
            </button>
          </>
        )}
      </div>
    </section>
  );
}
