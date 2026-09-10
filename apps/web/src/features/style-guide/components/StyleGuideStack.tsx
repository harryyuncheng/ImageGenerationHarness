import { Plus } from 'lucide-react';
import type { RefObject } from 'react';
import type { StyleGuideFolder, StyleGuideImage } from '../../../shared/types/domain.js';
import { styleGuideImageContentUrl } from '../api.js';

const PREVIEW_SLOTS = [0, 1, 2];

export interface FanOrigin {
  imageId: string | undefined;
  centerX: number;
  centerY: number;
  width: number;
  height: number;
  rotate: string;
  radius: number;
  shadow: string;
}

export function readFanOrigins(stack: HTMLElement): FanOrigin[] {
  return Array.from(stack.querySelectorAll<HTMLElement>('.style-guide-tile'), (tile) => {
    const box = tile.getBoundingClientRect();
    const style = getComputedStyle(tile);
    return {
      imageId: tile.dataset['imageId'],
      // Rotation about the left edge changes the centre, but not this bounding-box identity.
      centerX: box.left + box.width / 2,
      centerY: box.top + box.height / 2,
      width: tile.offsetWidth,
      height: tile.offsetHeight,
      rotate: style.rotate === 'none' ? '0deg' : style.rotate,
      radius: Number.parseFloat(style.borderTopLeftRadius),
      shadow: style.boxShadow,
    };
  });
}

export function StyleGuideStack({
  activeFolder,
  appliedImages,
  stackRef,
  onOpen,
}: {
  activeFolder: StyleGuideFolder | undefined;
  appliedImages: readonly StyleGuideImage[];
  stackRef: RefObject<HTMLButtonElement | null>;
  onOpen: (origins: FanOrigin[]) => void;
}) {
  const label = activeFolder
    ? `Style guide: ${activeFolder.name} · ${String(appliedImages.length)} images selected`
    : 'Style guide';

  return (
    <button
      ref={stackRef}
      type="button"
      className="style-guide-stack"
      aria-label={label}
      aria-haspopup="dialog"
      title={label}
      onClick={(event) => {
        onOpen(readFanOrigins(event.currentTarget));
      }}
    >
      <span className="style-guide-stack-fan" aria-hidden="true">
        {PREVIEW_SLOTS.map((slot) => {
          const image = appliedImages[slot];
          return (
            <span
              className={`style-guide-tile ${image ? '' : 'style-guide-tile--empty'}`}
              data-image-id={image?.imageId}
              key={slot}
            >
              {image && (
                <img src={styleGuideImageContentUrl(image.folderId, image.imageId)} alt="" />
              )}
              {!image && slot === PREVIEW_SLOTS.length - 1 && (
                <span className="style-guide-tile__add">
                  <Plus size={22} strokeWidth={1.5} />
                </span>
              )}
            </span>
          );
        })}
      </span>
    </button>
  );
}
