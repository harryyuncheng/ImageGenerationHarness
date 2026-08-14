import { Check, ChevronDown, HardDrive } from 'lucide-react';
import { activateRepositoryEndpoint, chooseRepositoryEndpoint } from '../api.js';
import type { RepositoryController } from '../use-repository.js';

export function RepositoryPicker({ repository }: { repository: RepositoryController }) {
  const {
    repositoryQuery,
    activeRepositoryId,
    menuOpen,
    attentionCount,
    isMutating,
    buttonRef,
    anchorRef,
  } = repository;
  const activeName = repositoryQuery.data?.active?.name;

  return (
    <div ref={anchorRef} className="popover-anchor repository-anchor">
      <button
        key={attentionCount}
        ref={buttonRef}
        className={`repository-button ${activeRepositoryId ? '' : 'repository-button--empty'} ${
          !activeRepositoryId && attentionCount > 0 ? 'repository-button--attention' : ''
        }`}
        onClick={() => {
          repository.setMenuOpen(!menuOpen);
        }}
        aria-label={`Image repository: ${activeName ?? 'not selected'}`}
        aria-expanded={menuOpen}
        disabled={repositoryQuery.isLoading || isMutating}
      >
        <HardDrive size={17} />
        <span>
          <strong>
            {repositoryQuery.isLoading ? 'Loading…' : (activeName ?? 'Choose a folder')}
          </strong>
        </span>
        <ChevronDown size={15} />
      </button>
      {menuOpen && (
        <div className="popover repository-menu surface-enter">
          <button
            className="repository-menu-heading"
            onClick={() => {
              void repository.selectRepository(chooseRepositoryEndpoint);
            }}
            disabled={isMutating}
            aria-label="Choose folder"
          >
            <HardDrive size={18} />
            <div>
              <strong>{activeName ?? 'No active repository'}</strong>
              <small>
                {activeRepositoryId
                  ? 'Portable local images, projects, and metadata'
                  : 'Choose a folder or create one in the picker before saving repository-backed work'}
              </small>
            </div>
          </button>
          {repositoryQuery.error instanceof Error && (
            <p className="repository-menu-error" role="alert">
              {repositoryQuery.error.message}
            </p>
          )}
          {(repositoryQuery.data?.recent.length ?? 0) > 0 && (
            <div className="repository-recents">
              <p>Recent repositories</p>
              {repositoryQuery.data?.recent.map((entry) => (
                <button
                  key={entry.repositoryId}
                  className={entry.repositoryId === activeRepositoryId ? 'selected' : ''}
                  onClick={() => {
                    void repository.selectRepository(
                      activateRepositoryEndpoint(entry.repositoryId),
                    );
                  }}
                >
                  <HardDrive size={15} />
                  <span>{entry.name}</span>
                  {entry.repositoryId === activeRepositoryId && <Check size={14} />}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
