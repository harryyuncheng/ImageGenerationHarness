import { Image as ImageIcon } from 'lucide-react';
import { GeneratedImageCard } from '../../../shared/components/GeneratedImageCard.js';
import type { GalleryImage, ProjectAsset } from '../../../shared/types/domain.js';

interface ProjectImagesSectionProps {
  assets: ProjectAsset[];
  images: GalleryImage[];
  onOpenImage: (image: GalleryImage) => void;
}

export function ProjectImagesSection({ assets, images, onOpenImage }: ProjectImagesSectionProps) {
  return (
    <section className="project-section">
      <div className="section-heading">
        <div>
          <h3>Project images</h3>
          <p>Includes project-root and nested-asset outputs.</p>
        </div>
      </div>
      {images.length === 0 ? (
        <div className="project-mini-empty">
          <ImageIcon size={22} />
          <p>No images generated in this project yet.</p>
        </div>
      ) : (
        <div className="gallery-grid project-gallery">
          {images.map((image) => {
            const asset = assets.find((candidate) => candidate.assetId === image.projectAssetId);
            return (
              <GeneratedImageCard
                key={image.imageId}
                image={image}
                subtitle={asset?.name ?? 'Project root'}
                onOpen={onOpenImage}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}
