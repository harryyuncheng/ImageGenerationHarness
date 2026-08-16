import { ArrowLeft, FolderTree, Trash2, WandSparkles } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import type {
  Destination,
  GalleryImage,
  Project,
  ProjectAsset,
  ProjectDetailResponse,
} from '../../../shared/types/domain.js';
import type { ProjectInput } from '../api.js';
import { ProjectAssetsSection } from './ProjectAssetsSection.js';
import { ProjectDetailsSection } from './ProjectDetailsSection.js';
import { ProjectImagesSection } from './ProjectImagesSection.js';

interface ProjectDashboardProps {
  detail: ProjectDetailResponse;
  images: GalleryImage[];
  headerActions: ReactNode;
  onSelect: (projectId: string | undefined) => void;
  onUpdate: (projectId: string, input: ProjectInput) => Promise<void>;
  onDelete: (project: Project) => void;
  onCreateAsset: (projectId: string, input: ProjectInput) => Promise<void>;
  onEditAsset: (asset: ProjectAsset) => void;
  onDeleteAsset: (asset: ProjectAsset) => void;
  onGenerate: (destination: Destination) => void;
  onOpenImage: (image: GalleryImage, location: string) => void;
}

/** Project details, nested assets, and the images generated inside them. */
export function ProjectDashboard(props: ProjectDashboardProps) {
  const { project, assets } = props.detail;
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [assetName, setAssetName] = useState('');
  const [assetDescription, setAssetDescription] = useState('');
  const [creatingAsset, setCreatingAsset] = useState(false);

  useEffect(() => {
    setEditName(project.name);
    setEditDescription(project.description);
    setAssetName('');
    setAssetDescription('');
    setCreatingAsset(false);
  }, [project.projectId, project.name, project.description]);

  const projectImages = props.images.filter((image) => image.projectId === project.projectId);

  return (
    <div className="library-page project-dashboard gallery-page surface-enter">
      <div className="project-dashboard-toolbar">
        <button
          className="project-back"
          onClick={() => {
            props.onSelect(undefined);
          }}
        >
          <ArrowLeft size={16} /> All projects
        </button>
        {props.headerActions}
      </div>
      <div className="project-dashboard-header">
        <div>
          <span className="project-glyph">
            <FolderTree size={23} />
          </span>
          <div>
            <p>Project workspace</p>
            <h2>{project.name}</h2>
          </div>
        </div>
        <div>
          <button
            className="text-button danger"
            onClick={() => {
              props.onDelete(project);
            }}
          >
            <Trash2 size={15} /> Delete
          </button>
          <button
            className="primary-small"
            onClick={() => {
              props.onGenerate({ kind: 'project', projectId: project.projectId });
            }}
          >
            <WandSparkles size={16} /> Generate to project
          </button>
        </div>
      </div>

      <ProjectDetailsSection
        project={project}
        name={editName}
        description={editDescription}
        onNameChange={setEditName}
        onDescriptionChange={setEditDescription}
        onSave={() => {
          void props.onUpdate(project.projectId, {
            name: editName.trim(),
            description: editDescription,
          });
        }}
      />

      <ProjectAssetsSection
        projectId={project.projectId}
        assets={assets}
        draft={{
          creating: creatingAsset,
          setCreating: setCreatingAsset,
          name: assetName,
          setName: setAssetName,
          description: assetDescription,
          setDescription: setAssetDescription,
        }}
        onCreate={() => {
          void props
            .onCreateAsset(project.projectId, {
              name: assetName.trim(),
              description: assetDescription,
            })
            .then(() => {
              setAssetName('');
              setAssetDescription('');
              setCreatingAsset(false);
            });
        }}
        onEditAsset={props.onEditAsset}
        onDeleteAsset={props.onDeleteAsset}
        onGenerate={props.onGenerate}
      />

      <ProjectImagesSection
        project={project}
        assets={assets}
        images={projectImages}
        onOpenImage={props.onOpenImage}
      />
    </div>
  );
}
