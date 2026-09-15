import { Images, Upload, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Alert } from '../../../shared/components/Alert.js';
import { useAlert } from '../../../shared/hooks/use-alert.js';
import {
  generatedImageContentUrl,
  supportedImageFiles,
  unsupportedImageMessage,
} from '../../../shared/images/files.js';
import type { Preset } from '../../../shared/types/domain.js';
import { presetCoverUrl } from '../api.js';
import type { PresetDraft } from '../use-saved-prompts.js';
import { PresetCover } from './PresetCover.js';
import { PresetGalleryPicker } from './PresetGalleryPicker.js';

interface CoverSelection {
  input: NonNullable<PresetDraft['cover']>;
  url: string;
}

export function PresetEditor({
  preset,
  initialPrompt,
  repositoryId,
  isSaving,
  onSave,
  onCancel,
}: {
  preset: Preset | undefined;
  initialPrompt: string;
  repositoryId: string | undefined;
  isSaving: boolean;
  onSave: (draft: PresetDraft) => Promise<void>;
  onCancel: () => void;
}) {
  const feedback = useAlert();
  const fileInput = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(
    preset?.name ?? initialPrompt.trim().split(/\s+/u).slice(0, 6).join(' ').slice(0, 80),
  );
  const [prompt, setPrompt] = useState(initialPrompt);
  const [cover, setCover] = useState<CoverSelection | null>();
  const [choosingGallery, setChoosingGallery] = useState(false);
  const coverUrl = cover === undefined ? (preset ? presetCoverUrl(preset) : undefined) : cover?.url;

  useEffect(() => {
    return () => {
      if (cover?.input.source === 'upload') URL.revokeObjectURL(cover.url);
    };
  }, [cover]);

  if (choosingGallery) {
    return (
      <PresetGalleryPicker
        repositoryId={repositoryId}
        onBack={() => {
          setChoosingGallery(false);
        }}
        onSelect={(image) => {
          setCover({
            input: { source: 'gallery', imageId: image.imageId },
            url: generatedImageContentUrl(image.imageId),
          });
          setChoosingGallery(false);
        }}
      />
    );
  }

  return (
    <form
      className="preset-editor"
      onSubmit={(event) => {
        event.preventDefault();
        feedback.clearAlert();
        void onSave({
          name: name.trim(),
          prompt: prompt.trim(),
          ...(cover === undefined ? {} : { cover: cover?.input ?? null }),
        });
      }}
      aria-busy={isSaving}
    >
      <fieldset className="preset-editor-fields" disabled={isSaving}>
        <div className="preset-editor-cover">
          <div className="style-guide-preview">
            <PresetCover src={coverUrl} alt={name || 'Preset cover'} />
            {coverUrl && (
              <button
                type="button"
                className="preset-cover-remove"
                aria-label="Remove cover image"
                title="Remove cover image"
                onClick={() => {
                  setCover(null);
                }}
              >
                <X size={15} />
              </button>
            )}
          </div>
        </div>
        <div className="preset-cover-controls">
          <div className="preset-cover-actions">
            <button
              type="button"
              className="text-button"
              onClick={() => {
                feedback.clearAlert();
                setChoosingGallery(true);
              }}
            >
              <Images size={15} /> From gallery
            </button>
            <button
              type="button"
              className="text-button"
              onClick={() => {
                fileInput.current?.click();
              }}
            >
              <Upload size={15} /> Upload image
            </button>
          </div>
          <input
            ref={fileInput}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            hidden
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = '';
              if (!file) return;
              feedback.clearAlert();
              if (supportedImageFiles([file]).length === 0) {
                feedback.reportWarning(unsupportedImageMessage);
                return;
              }
              setCover({
                input: { source: 'upload', file },
                url: URL.createObjectURL(file),
              });
            }}
          />
          <Alert feedback={feedback} />
        </div>
        <div className="preset-editor-text">
          <input
            className="preset-name-input"
            aria-label="Preset name"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
            }}
            maxLength={80}
            placeholder="Soft afternoon light"
            required
            autoFocus
          />
          <textarea
            className="preset-prompt-input"
            aria-label="Preset prompt"
            value={prompt}
            onChange={(event) => {
              setPrompt(event.target.value);
            }}
            maxLength={10_000}
            placeholder="The lighting, texture, mood, or direction you want to reuse..."
            required
          />
        </div>
        <p className="preset-editor-count">{prompt.length.toLocaleString()} / 10,000</p>
      </fieldset>
      <div className="preset-editor-actions">
        <button type="button" className="text-button" onClick={onCancel} disabled={isSaving}>
          Cancel
        </button>
        <button
          type="submit"
          className="primary-small"
          disabled={isSaving || !name.trim() || !prompt.trim()}
        >
          {isSaving ? 'Saving...' : 'Save preset'}
        </button>
      </div>
    </form>
  );
}
