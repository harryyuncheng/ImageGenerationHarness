import { ArrowLeft, CloudOff, FolderPlus, FolderTree, Search } from 'lucide-react';
import type { ReactNode } from 'react';
import { EmptyState } from '../../../shared/components/EmptyState.js';
import type { Project } from '../../../shared/types/domain.js';
import type { ProjectInput } from '../api.js';

interface ProjectCreationDraft {
  search: string;
  setSearch: (value: string) => void;
  creatingProject: boolean;
  setCreatingProject: (value: boolean) => void;
  projectName: string;
  setProjectName: (value: string) => void;
  projectDescription: string;
  setProjectDescription: (value: string) => void;
}

interface ProjectsBrowserProps {
  projects: Project[];
  headerActions: ReactNode;
  draft: ProjectCreationDraft;
  isLoading: boolean;
  error?: string;
  onSelect: (projectId: string) => void;
  onCreate: (input: ProjectInput) => Promise<void>;
  onRetry: () => void;
  onToggleCreation: () => void;
}

export function ProjectsBrowser({
  projects,
  headerActions,
  draft,
  isLoading,
  error,
  onSelect,
  onCreate,
  onRetry,
  onToggleCreation,
}: ProjectsBrowserProps) {
  const filtered = projects.filter((project) =>
    `${project.name} ${project.description}`.toLowerCase().includes(draft.search.toLowerCase()),
  );

  return (
    <div className="library-page projects-page gallery-page surface-enter">
      <div className="library-heading">
        <div>
          <h2>Gallery</h2>
          <p>Keep generated images organized by project and nested visual asset.</p>
        </div>
        <div className="gallery-heading-actions">
          {headerActions}
          <button className="primary-small" onClick={onToggleCreation}>
            <FolderPlus size={16} /> New project
          </button>
        </div>
      </div>
      {draft.creatingProject && (
        <form
          className="project-create surface-enter"
          onSubmit={(event) => {
            event.preventDefault();
            if (!draft.projectName.trim()) return;
            void onCreate({
              name: draft.projectName.trim(),
              description: draft.projectDescription,
            }).then(() => {
              draft.setProjectName('');
              draft.setProjectDescription('');
              draft.setCreatingProject(false);
            });
          }}
        >
          <div>
            <span className="project-glyph">
              <FolderTree size={21} />
            </span>
            <div>
              <h3>Create a project</h3>
              <p>Descriptions stay organizational and never alter prompts.</p>
            </div>
          </div>
          <label>
            <span>Name</span>
            <input
              aria-label="New project name"
              autoFocus
              maxLength={120}
              value={draft.projectName}
              onChange={(event) => {
                draft.setProjectName(event.target.value);
              }}
              placeholder="Autumn campaign"
            />
          </label>
          <label>
            <span>Description</span>
            <textarea
              aria-label="New project description"
              rows={3}
              maxLength={4000}
              value={draft.projectDescription}
              onChange={(event) => {
                draft.setProjectDescription(event.target.value);
              }}
              placeholder="What belongs in this project?"
            />
          </label>
          <div className="project-create-actions">
            <button
              type="button"
              className="text-button"
              onClick={() => {
                draft.setCreatingProject(false);
              }}
            >
              Cancel
            </button>
            <button className="primary-small" disabled={!draft.projectName.trim()} type="submit">
              Create project
            </button>
          </div>
        </form>
      )}
      <div className="library-toolbar">
        <label className="search-field">
          <Search size={17} />
          <input
            aria-label="Search projects"
            value={draft.search}
            onChange={(event) => {
              draft.setSearch(event.target.value);
            }}
            placeholder="Search projects"
          />
        </label>
      </div>
      {error ? (
        <EmptyState
          Icon={CloudOff}
          title="Projects unavailable"
          body={error}
          action="Try again"
          onAction={onRetry}
        />
      ) : isLoading ? (
        <div className="reference-loading">
          <span className="loader-ring" />
          <p>Loading projects…</p>
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          Icon={FolderTree}
          title={projects.length === 0 ? 'Create your first project' : 'No matching projects'}
          body="Projects group generated images and focused nested assets without changing your prompts."
          action="New project"
          onAction={onToggleCreation}
        />
      ) : (
        <div className="projects-grid">
          {filtered.map((project) => (
            <button
              className="project-card"
              key={project.projectId}
              onClick={() => {
                onSelect(project.projectId);
              }}
            >
              <span className="project-glyph">
                <FolderTree size={20} />
              </span>
              <div>
                <h3>{project.name}</h3>
                <p>{project.description || 'No description yet'}</p>
                <small>Updated {new Date(project.updatedAt).toLocaleDateString()}</small>
              </div>
              <ArrowLeft className="project-open-arrow" size={17} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
