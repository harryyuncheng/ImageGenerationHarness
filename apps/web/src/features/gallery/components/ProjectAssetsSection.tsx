import { FolderPlus, Image as ImageIcon, Pencil, Plus, Trash2, WandSparkles } from 'lucide-react';
import type { Destination, ProjectAsset } from '../../../shared/types/domain.js';

export interface AssetDraft {
  creating: boolean;
  setCreating: (value: boolean) => void;
  name: string;
  setName: (value: string) => void;
  description: string;
  setDescription: (value: string) => void;
}

interface ProjectAssetsSectionProps {
  projectId: string;
  assets: ProjectAsset[];
  draft: AssetDraft;
  onCreate: () => void;
  onEditAsset: (asset: ProjectAsset) => void;
  onDeleteAsset: (asset: ProjectAsset) => void;
  onGenerate: (destination: Destination) => void;
}

/** Nested assets: focused spaces inside one project. */
export function ProjectAssetsSection({
  projectId,
  assets,
  draft,
  onCreate,
  onEditAsset,
  onDeleteAsset,
  onGenerate,
}: ProjectAssetsSectionProps) {
  return (
    <section className="project-section">
      <div className="section-heading">
        <div>
          <h3>Nested assets</h3>
          <p>Focused spaces for a character, prop, product, logo, or location.</p>
        </div>
        <button
          className="text-button"
          onClick={() => {
            draft.setCreating(!draft.creating);
          }}
        >
          <Plus size={15} /> New asset
        </button>
      </div>
      {draft.creating && (
        <form
          className="inline-create-card surface-enter"
          onSubmit={(event) => {
            event.preventDefault();
            if (!draft.name.trim()) return;
            onCreate();
          }}
        >
          <label>
            <span>Asset name</span>
            <input
              aria-label="Asset name"
              autoFocus
              value={draft.name}
              maxLength={120}
              onChange={(event) => {
                draft.setName(event.target.value);
              }}
              placeholder="Hero product"
            />
          </label>
          <label>
            <span>Description</span>
            <textarea
              aria-label="Asset description"
              rows={2}
              maxLength={4000}
              value={draft.description}
              onChange={(event) => {
                draft.setDescription(event.target.value);
              }}
              placeholder="Private organizational note"
            />
          </label>
          <div>
            <button
              type="button"
              className="text-button"
              onClick={() => {
                draft.setCreating(false);
              }}
            >
              Cancel
            </button>
            <button className="primary-small" disabled={!draft.name.trim()} type="submit">
              Create asset
            </button>
          </div>
        </form>
      )}
      {assets.length === 0 ? (
        <div className="project-mini-empty">
          <FolderPlus size={22} />
          <p>No nested assets yet.</p>
        </div>
      ) : (
        <div className="asset-grid">
          {assets.map((asset) => (
            <article className="asset-card" key={asset.assetId}>
              <span>
                <ImageIcon size={18} />
              </span>
              <div>
                <h4>{asset.name}</h4>
                <p>{asset.description.length > 0 ? asset.description : 'No description'}</p>
              </div>
              <div>
                <button
                  className="text-button"
                  onClick={() => {
                    onGenerate({
                      kind: 'project-asset',
                      projectId,
                      projectAssetId: asset.assetId,
                    });
                  }}
                >
                  <WandSparkles size={14} /> Generate
                </button>
                <button
                  className="icon-button"
                  onClick={() => {
                    onEditAsset(asset);
                  }}
                  aria-label={`Edit ${asset.name}`}
                >
                  <Pencil size={14} />
                </button>
                <button
                  className="icon-button danger"
                  onClick={() => {
                    onDeleteAsset(asset);
                  }}
                  aria-label={`Delete ${asset.name}`}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
