import { Plus } from 'lucide-react';
import { useRef } from 'react';
import type { StyleGuideFolder } from '../../../shared/types/domain.js';
import { styleGuideImageContentUrl } from '../api.js';

const PREVIEW_SLOTS = [0, 1, 2];

/** Geometry a fan tile occupied at click time, used to fly it into the modal grid. */
export interface FanOrigin {
  centerX: number;
  centerY: number;
  width: number;
  height: number;
  rotate: string;
}

/** A rotated rectangle's bounding box shares its centre, so the box gives the true centre. */
function readOrigin(tile: Element): FanOrigin {
  const box = tile.getBoundingClientRect();
  const rotate = getComputedStyle(tile).rotate;
  return {
    centerX: box.left + box.width / 2,
    centerY: box.top + box.height / 2,
    width: (tile as HTMLElement).offsetWidth,
    height: (tile as HTMLElement).offsetHeight,
    rotate: rotate === 'none' ? '0deg' : rotate,
  };
}

export function StyleGuideStack({
  activeFolder,
  onOpen,
}: {
  activeFolder: StyleGuideFolder | undefined;
  onOpen: (origins: FanOrigin[]) => void;
}) {
  const fan = useRef<HTMLSpanElement>(null);
  const images = activeFolder?.images ?? [];
  const label = activeFolder ? `Style guide: ${activeFolder.name}` : 'Style guide';

  return (
    <button
      type="button"
      className="style-guide-stack"
      aria-label={label}
      aria-haspopup="dialog"
      title={label}
      onClick={() => {
        const tiles = fan.current?.querySelectorAll('.style-guide-tile') ?? [];
        onOpen(Array.from(tiles, readOrigin));
      }}
    >
      <span className="style-guide-stack-fan" ref={fan} aria-hidden="true">
        {PREVIEW_SLOTS.map((slot) => {
          const image = images[slot];
          return (
            <span
              className={`style-guide-tile ${image ? '' : 'style-guide-tile--empty'}`}
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
