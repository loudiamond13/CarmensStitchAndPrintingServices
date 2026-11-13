// GalleryMasonry (UI-SPEC G1 item 3, GAL-01, D-30, D-31): one tile per gallery item, a button named "Open {team}, {short}"
// at the cover photo's own ratio clamped between 3 / 4 and 4 / 3 (4 / 5 when the size is unknown), or the drawn jersey in the
// line's art when there is no photo address. The columns fill top to bottom, so the DOM order is the gallery order. The
// caption sits on a solid blush band (D-31). Photos load lazily inside their reserved boxes (CLS) and are decorative: the
// button's name says what it is. Only the --ratio custom property is set inline, as LazyImage does.
import { LazyImage } from '@/components/states/LazyImage';
import { PUBLIC_COPY } from '../copy';
import type { PublicGalleryItem, PublicGalleryPhoto } from '../services/contentService';
import { artFor, JerseyArt } from './JerseyArt';
import {
  masonryClasses,
  tileArtClasses,
  tileCaptionClasses,
  tileClasses,
  tileJerseyClasses,
  tileKitClasses,
  tileMetaClasses,
  tileTeamClasses,
} from './gallery.recipe';

const { gallery: COPY } = PUBLIC_COPY;

// UI-SPEC "Image delivery slots": the masonry tile.
const TILE_SIZES =
  '(max-width: 767px) calc(50vw - 22px), (max-width: 1279px) calc(33.3333vw - 27px), min(276px, calc(25vw - 28px))';

/** The ratio used when the photo's size is unknown. */
const UNKNOWN_RATIO = '4 / 5';

// SPEC-GAP: the drawn jersey needs a number and a gallery item has none; the hero's "23" is drawn, as the design does.
const ART_NUMBER = '23';

/** The photo's own ratio, kept between 3 / 4 and 4 / 3; outside that the photo is cropped to the nearest limit. */
export function tileRatio(photo: Pick<PublicGalleryPhoto, 'width' | 'height'> | undefined): string {
  const width = Number(photo?.width);
  const height = Number(photo?.height);
  if (!(width > 0 && height > 0)) {
    return UNKNOWN_RATIO;
  }
  const ratio = width / height;
  if (ratio > 4 / 3) {
    return '4 / 3';
  }
  if (ratio < 3 / 4) {
    return '3 / 4';
  }
  return `${String(width)} / ${String(height)}`;
}

export interface GalleryMasonryProps {
  /** The items in gallery order (already filtered by the page). */
  items: readonly PublicGalleryItem[];
  /** How many tiles to draw from the start. */
  shown: number;
  /** Called with the item's index in `items` when its tile is pressed (the lightbox opens from it). */
  onOpen?: (itemIndex: number) => void;
}

interface TileProps {
  item: PublicGalleryItem;
  index: number;
  onOpen: ((itemIndex: number) => void) | undefined;
}

function Tile({ item, index, onOpen }: TileProps) {
  const cover = item.photos[0];
  const ratio = tileRatio(cover);
  const art = artFor(item.placeholderArt);
  return (
    <button
      type="button"
      className={tileClasses}
      aria-label={COPY.tileName(item.team, item.lineShortName)}
      data-tile-index={index}
      onClick={() => {
        onOpen?.(index);
      }}
    >
      {cover === undefined || cover.src === '' ? (
        <div className={tileArtClasses} style={{ '--ratio': ratio }}>
          <div className={tileKitClasses}>
            <JerseyArt {...art} number={ART_NUMBER} className={tileJerseyClasses} />
          </div>
        </div>
      ) : (
        <LazyImage
          src={cover.src}
          srcSet={cover.srcSet}
          sizes={TILE_SIZES}
          width={Number(cover.width)}
          height={Number(cover.height)}
          alt=""
          ratio={ratio}
        />
      )}
      <span className={tileCaptionClasses} data-gallery-caption="">
        <strong className={tileTeamClasses}>{item.team}</strong>
        <span className={tileMetaClasses}>
          {COPY.caption(item.lineShortName, item.pieces === null ? null : Number(item.pieces))}
        </span>
      </span>
    </button>
  );
}

export function GalleryMasonry({ items, shown, onOpen }: GalleryMasonryProps) {
  return (
    <div className={masonryClasses}>
      {items.slice(0, shown).map((item, index) => (
        <Tile key={item.id} item={item} index={index} onOpen={onOpen} />
      ))}
    </div>
  );
}
