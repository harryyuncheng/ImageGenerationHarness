import { Save } from 'lucide-react';
import type { Project } from '../../../shared/types/domain.js';

interface ProjectDetailsSectionProps {
  project: Project;
  name: string;
  description: string;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onSave: () => void;
}

/** Organizational project notes. They never reach a generation prompt. */
export function ProjectDetailsSection({
  project,
  name,
  description,
  onNameChange,
  onDescriptionChange,
  onSave,
}: ProjectDetailsSectionProps) {
  return (
    <section className="project-editor">
      <div className="section-heading">
        <div>
          <h3>Project details</h3>
          <p>Organizational notes are never added to generation prompts.</p>
        </div>
      </div>
      <label>
        <span>Name</span>
        <input
          aria-label="Project name"
          value={name}
          maxLength={120}
          onChange={(event) => {
            onNameChange(event.target.value);
          }}
        />
      </label>
      <label>
        <span>Description</span>
        <textarea
          aria-label="Project description"
          rows={4}
          maxLength={4000}
          value={description}
          onChange={(event) => {
            onDescriptionChange(event.target.value);
          }}
          placeholder="Purpose, visual direction, or other notes…"
        />
      </label>
      <div className="project-editor-actions">
        <small>Updated {new Date(project.updatedAt).toLocaleString()}</small>
        <button className="primary-small" disabled={!name.trim()} onClick={onSave}>
          <Save size={15} /> Save changes
        </button>
      </div>
    </section>
  );
}
