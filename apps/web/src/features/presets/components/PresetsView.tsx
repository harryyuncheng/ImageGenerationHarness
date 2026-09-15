import { ArrowLeft, Bookmark, Check, CloudOff, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { EmptyState } from '../../../shared/components/EmptyState.js';
import { Alert } from '../../../shared/components/Alert.js';
import { LibraryInfo } from '../../../shared/components/LibraryInfo.js';
import { useModalDialog } from '../../../shared/hooks/use-modal-dialog.js';
import type { Preset } from '../../../shared/types/domain.js';
import { presetCoverUrl } from '../api.js';
import type { SavedPromptsController } from '../use-saved-prompts.js';
import { PresetCover } from './PresetCover.js';
import { PresetEditor } from './PresetEditor.js';

const dialogId = 'presets-dialog';

export function PresetsView({
  controller,
  repositoryId,
  onChooseRepository,
  onClose,
}: {
  controller: SavedPromptsController;
  repositoryId: string | undefined;
  onChooseRepository: () => void;
  onClose: () => void;
}) {
  const { presets, presetsQuery, editor, isMutating } = controller;
  const closeButton = useRef<HTMLButtonElement>(null);
  const [added, setAdded] = useState<ReadonlyMap<string, string>>(new Map());
  const [announcement, setAnnouncement] = useState('');
  const close = () => {
    if (isMutating) return;
    controller.closeEditor();
    onClose();
  };
  const dialog = useModalDialog(close);
  const create = () => {
    controller.beginCreate();
  };

  useEffect(() => {
    if (isMutating) {
      dialog.ref.current?.focus({ preventScroll: true });
    } else if (!editor) {
      closeButton.current?.focus({ preventScroll: true });
    }
  }, [editor, isMutating, dialog.ref]);

  return createPortal(
    <div
      className="style-guide-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <section
        {...dialog}
        id={dialogId}
        className="style-guide-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${dialogId}-title`}
      >
        <header className="style-guide-dialog__header">
          <div className="style-guide-dialog__title">
            {editor && (
              <button
                type="button"
                className="icon-button"
                onClick={controller.closeEditor}
                aria-label="Back to saved presets"
                disabled={isMutating}
              >
                <ArrowLeft size={18} />
              </button>
            )}
            <h2 id={`${dialogId}-title`}>
              {editor ? (editor.preset ? 'Edit preset' : 'New preset') : 'Saved presets'}
            </h2>
            {!editor && (
              <LibraryInfo label="What are saved presets?">
                Presets append text to your prompt.
              </LibraryInfo>
            )}
          </div>
          <div className="style-guide-dialog__header-actions">
            {!editor && repositoryId && (
              <button className="primary-small" onClick={create} disabled={isMutating}>
                <Plus size={16} /> New preset
              </button>
            )}
            <button
              ref={closeButton}
              type="button"
              className="icon-button"
              onClick={close}
              aria-label="Close saved presets"
              disabled={isMutating}
            >
              <X size={18} />
            </button>
          </div>
        </header>
        <div className="style-guide-dialog__body">
          <Alert feedback={controller.feedback} />
          {editor ? (
            <PresetEditor
              key={editor.preset?.presetId ?? 'new'}
              preset={editor.preset}
              initialPrompt={editor.initialPrompt}
              repositoryId={repositoryId}
              isSaving={isMutating}
              onSave={controller.savePreset}
              onCancel={controller.closeEditor}
            />
          ) : !repositoryId ? (
            <EmptyState
              Icon={Bookmark}
              title="Keep your presets with your images"
              body="Choose a local repository to save reusable prompts and their cover images."
              action="Choose repository"
              onAction={onChooseRepository}
            />
          ) : presetsQuery.error ? (
            <EmptyState
              Icon={CloudOff}
              title="Saved presets unavailable"
              body={presetsQuery.error.message}
              action="Try again"
              onAction={() => {
                void presetsQuery.refetch();
              }}
            />
          ) : presetsQuery.isLoading ? (
            <div className="library-loading" role="status">
              <span className="loader-ring" />
              <p>Loading your presets...</p>
            </div>
          ) : presets.length === 0 ? (
            <EmptyState
              Icon={Bookmark}
              title="Collect your favorite directions"
              body="Save a prompt with a cover from your gallery or an upload, then mix and match presets on your canvas."
              action="Create a preset"
              onAction={create}
            />
          ) : (
            <div className="style-guide-grid" role="group" aria-label="Saved presets">
              {presets.map((preset) => (
                <PresetCard
                  key={preset.presetId}
                  preset={preset}
                  added={added.get(preset.presetId) === preset.prompt}
                  disabled={isMutating}
                  onAppend={() => {
                    if (!controller.appendPrompt(preset)) return;
                    setAdded((current) => new Map(current).set(preset.presetId, preset.prompt));
                    setAnnouncement(`Added "${preset.name}" to your prompt.`);
                  }}
                  onEdit={() => {
                    controller.beginEdit(preset);
                  }}
                  onDelete={() => {
                    void controller.deletePreset(preset);
                  }}
                />
              ))}
              <button
                type="button"
                className="style-guide-add-tile"
                onClick={create}
                aria-label="Create a preset"
                disabled={isMutating}
              >
                <Plus size={26} />
              </button>
            </div>
          )}
          <p className="visually-hidden" role="status" aria-live="polite">
            {announcement}
          </p>
        </div>
      </section>
    </div>,
    document.body,
  );
}

function PresetCard({
  preset,
  added,
  disabled,
  onAppend,
  onEdit,
  onDelete,
}: {
  preset: Preset;
  added: boolean;
  disabled: boolean;
  onAppend: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <article className="preset-card">
      <button
        type="button"
        className="style-guide-preview preset-card-cover"
        onClick={onAppend}
        aria-label={`Add ${preset.name} to prompt${added ? ' again' : ''}`}
        title={added ? 'Add to prompt again' : 'Add to prompt'}
        disabled={disabled}
      >
        <PresetCover src={presetCoverUrl(preset)} alt={preset.name} />
        {added && (
          <span className="preset-card-added">
            <Check size={13} /> Added
          </span>
        )}
      </button>
      <div className="style-guide-card-meta">
        <div>
          <strong title={preset.name}>{preset.name}</strong>
          <small title={preset.prompt}>{preset.prompt}</small>
        </div>
        <button
          type="button"
          className="icon-button"
          aria-label={`Edit ${preset.name}`}
          title="Edit preset and cover"
          onClick={onEdit}
          disabled={disabled}
        >
          <Pencil size={14} />
        </button>
        <button
          type="button"
          className="icon-button danger"
          aria-label={`Delete ${preset.name}`}
          title="Delete preset"
          onClick={onDelete}
          disabled={disabled}
        >
          <Trash2 size={14} />
        </button>
      </div>
    </article>
  );
}
