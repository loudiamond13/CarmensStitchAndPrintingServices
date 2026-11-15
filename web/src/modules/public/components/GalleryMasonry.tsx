// GalleryMasonry (UI-SPEC G1 item 3, GAL-01, D-30, D-31): one tile per gallery item, a button named "Open {team}, {short}"
// at the cover photo's own ratio clamped between 3 / 4 and 4 / 3 (4 / 5 when the size is unknown), or the drawn jersey in the
// line's art when there is no photo address. The columns fill top to bottom, so the DOM order is the gallery order. The
// caption sits on a solid blush band (D-31). Photos load lazily inside their reserved boxes (CLS) and are decorative: the
// button's name says what it is. Photo tiles keep LazyImage's --ratio; the drawn tile sets no style.
import { useEffect, useRef } from 'react';
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
  tileSizerClasses,
  tileTeamClasses,
} from './gallery.recipe';

const { gallery: COPY } = PUBLIC_COPY;

// UI-SPEC "Image delivery slots": the masonry tile.
const TILE_SIZES =
  '(max-width: 767px) calc(50vw - 22px), (max-width: 1279px) calc(33.3333vw - 27px), min(276px, calc(25vw - 28px))';

/** The width and height used when the photo's size is unknown (4 / 5). */
const UNKNOWN_RATIO = [4, 5] as const;

// SPEC-GAP: the drawn jersey needs a number and a gallery item has none; the hero's "23" is drawn, as the design does.
const ART_NUMBER = '23';

/** The photo's own width and height, kept between 3 / 4 and 4 / 3; outside that the photo is cropped to the nearest limit. */
function tileRatioParts(photo: Pick<PublicGalleryPhoto, 'width' | 'height'> | undefined): readonly [number, number] {
  const width = Number(photo?.width);
  const height = Number(photo?.height);
  if (!(width > 0 && height > 0)) {
    return UNKNOWN_RATIO;
  }
  const ratio = width / height;
  if (ratio > 4 / 3) {
    return [4, 3];
  }
  if (ratio < 3 / 4) {
    return [3, 4];
  }
  return [width, height];
}

/** The photo's ratio as "W / H", for the tile's `--ratio`. */
export function tileRatio(photo: Pick<PublicGalleryPhoto, 'width' | 'height'> | undefined): string {
  const [width, height] = tileRatioParts(photo);
  return `${String(width)} / ${String(height)}`;
}

/** A request to move the focus to a tile. Each request is a new object, so the same tile can be asked for again. */
export interface TileFocusRequest {
  index: number;
}

export interface GalleryMasonryProps {
  /** The items in gallery order (already filtered by the page). */
  items: readonly PublicGalleryItem[];
  /** How many tiles to draw from the start. */
  shown: number;
  /** The tile to move the focus to (the first tile Show More adds, the tile of the item the lightbox showed last), or null. */
  focusRequest?: TileFocusRequest | null;
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
  const art = artFor(item.placeholderArt);
  const ratio = tileRatio(cover);
  const [sizerWidth, sizerHeight] = tileRatioParts(cover);
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
        <div className={tileArtClasses}>
          {/* SPEC-DEVIATION: 11-UI-REVIEW fix 3: the drawn tile's ratio comes from this sizer's viewBox, not --ratio, so the module sets no style (11-UI-SPEC "rows added for Phase 11: none"). */}
          <svg
            data-tile-sizer=""
            aria-hidden="true"
            viewBox={`0 0 ${String(sizerWidth)} ${String(sizerHeight)}`}
            width={sizerWidth}
            height={sizerHeight}
            className={tileSizerClasses}
          />
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

export function GalleryMasonry({ items, shown, focusRequest = null, onOpen }: GalleryMasonryProps) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (focusRequest !== null) {
      root.current?.querySelector<HTMLElement>(`[data-tile-index="${String(focusRequest.index)}"]`)?.focus();
    }
  }, [focusRequest]);
  return (
    <div ref={root} className={masonryClasses}>
      {items.slice(0, shown).map((item, index) => (
        <Tile key={item.id} item={item} index={index} onOpen={onOpen} />
      ))}
    </div>
  );
}
