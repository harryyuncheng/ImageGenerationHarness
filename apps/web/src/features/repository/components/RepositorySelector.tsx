import { FolderOpen, HardDrive } from 'lucide-react';
import { activateRepositoryEndpoint, chooseRepositoryEndpoint } from '../api.js';
import type { RepositoryController } from '../use-repository.js';

export function RepositorySelector({ repository }: { repository: RepositoryController }) {
  const { repositoryQuery, activeRepositoryId, isMutating } = repository;
  const active = repositoryQuery.data?.active;
  const alternatives = (repositoryQuery.data?.recent ?? []).filter(
    (entry) => entry.repositoryId !== activeRepositoryId,
  );
  const busy = repositoryQuery.isLoading || isMutating;

  return (
    <div className="repository-selector">
      <div className={`repository-active ${active ? '' : 'repository-active--empty'}`}>
        <span className="repository-active__icon" aria-hidden="true">
          <HardDrive size={18} />
        </span>
        <span className="repository-active__copy">
          <strong>
            {repositoryQuery.isLoading ? 'Loading…' : (active?.name ?? 'No folder chosen')}
          </strong>
          <small>
            {active
              ? 'Every image, project, and run in the studio is read from and written to this folder.'
              : 'Choose a folder, or create one in the picker, before saving any work.'}
          </small>
        </span>
        <button
          type="button"
          className="primary-small repository-choose"
          disabled={busy}
          onClick={() => {
            void repository.selectRepository(chooseRepositoryEndpoint);
          }}
        >
          <FolderOpen size={14} aria-hidden="true" />
          {active ? 'Change folder' : 'Choose folder'}
        </button>
      </div>

      {repositoryQuery.error instanceof Error && (
        <p className="repository-error" role="alert">
          {repositoryQuery.error.message}
        </p>
      )}

      {alternatives.length > 0 && (
        <div className="repository-recents">
          <p id="repository-recents-label">Recent folders</p>
          <div role="group" aria-labelledby="repository-recents-label">
            {alternatives.map((entry) => (
              <button
                type="button"
                key={entry.repositoryId}
                disabled={busy}
                aria-label={`Switch to ${entry.name}`}
                onClick={() => {
                  void repository.selectRepository(activateRepositoryEndpoint(entry.repositoryId));
                }}
              >
                <HardDrive size={15} aria-hidden="true" />
                <span>{entry.name}</span>
                <em aria-hidden="true">Switch</em>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
