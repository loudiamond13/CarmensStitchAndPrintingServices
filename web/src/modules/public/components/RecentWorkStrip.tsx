// RecentWorkStrip (UI-SPEC H1 item 5, D-14, PUB-01): "Fresh off the press", the six newest shown orders as 4:5 tiles in a row that
// scrolls inside itself. Each tile is a link to /gallery?category={key} with the order's cover photo (decorative, because the link
// text names it) or the drawn jersey in the line's art, over a caption of the public name and "{Basketball} · {17} pcs". A key that
// fails the allow-list sends the tile to the plain Gallery (T-11-74). With no order nothing is drawn. It loads after the page
// (lazyHome.ts), so Home's first download stays inside the 150 KB budget (PERF-01).
import { UiLink } from '@/components/actions/UiLink';
import { Icon } from '@/components/brand/Icon';
import { Skeleton } from '@/components/feedback/Skeleton';
import { LazyImage } from '@/components/states/LazyImage';
import { PUBLIC_COPY } from '../copy';
import { isLineKey } from '../lineKey';
import type { PublicRecentWork } from '../services/contentService';
import { h2Classes, h2EmClasses, headInRowClasses, headRowClasses, homeWrapClasses, secClasses } from './home.recipe';
import { artFor, JerseyArt } from './JerseyArt';
import { eyebrowClasses, linkClasses } from './public.recipe';
import {
  stripArtClasses,
  stripCaptionClasses,
  stripClasses,
  stripJerseyClasses,
  stripKitClasses,
  stripMetaClasses,
  stripSkeletonClasses,
  stripTeamClasses,
  stripTileClasses,
} from './recent.recipe';

const { recent: COPY } = PUBLIC_COPY.home;

// UI-SPEC "Image delivery slots": the strip tile.
const TILE_SIZES = '(max-width: 767px) calc(72vw - 23px), 240px';

// SPEC-GAP: the drawn jersey needs a number and an order has none; the hero's "23" is drawn, as the design does.
const ART_NUMBER = '23';

const SKELETON_COUNT = 4;

function RecentHead({ withLink }: { withLink: boolean }) {
  return (
    <div className={headRowClasses}>
      <div className={headInRowClasses}>
        <span className={eyebrowClasses}>{COPY.eyebrow}</span>
        <h2 className={h2Classes}>
          {`${COPY.headline.plain} `}
          <em className={h2EmClasses}>{COPY.headline.accent}</em>
        </h2>
      </div>
      {withLink && (
        <UiLink to="/gallery" className={linkClasses}>
          {COPY.viewGallery}
          <Icon name="arrow-right" size={18} />
        </UiLink>
      )}
    </div>
  );
}

export interface RecentWorkStripProps {
  /** The newest shown orders, newest first, at most six. */
  items: readonly PublicRecentWork[];
}

function Tile({ item }: { item: PublicRecentWork }) {
  const art = artFor(item.placeholderArt);
  const photo = item.photo;
  return (
    <UiLink
      to={isLineKey(item.lineKey) ? `/gallery?category=${item.lineKey}` : '/gallery'}
      className={stripTileClasses}
    >
      {photo === null || photo.src === '' ? (
        <div className={stripArtClasses}>
          <div className={stripKitClasses}>
            <JerseyArt {...art} number={ART_NUMBER} className={stripJerseyClasses} />
          </div>
        </div>
      ) : (
        <LazyImage
          src={photo.src}
          srcSet={photo.srcSet}
          sizes={TILE_SIZES}
          width={Number(photo.width)}
          height={Number(photo.height)}
          alt=""
          ratio="4 / 5"
        />
      )}
      <span className={stripCaptionClasses}>
        <strong className={stripTeamClasses}>{item.team}</strong>{' '}
        <span className={stripMetaClasses}>
          {COPY.caption(item.lineShortName, item.pieces === null ? null : Number(item.pieces))}
        </span>
      </span>
    </UiLink>
  );
}

export function RecentWorkStrip({ items }: RecentWorkStripProps) {
  if (items.length === 0) {
    return null;
  }
  return (
    <section className={secClasses}>
      <div className={homeWrapClasses}>
        <RecentHead withLink />
        <div className={stripClasses}>
          {items.map((item, index) => (
            <Tile key={`${String(index)}-${item.team}`} item={item} />
          ))}
        </div>
      </div>
    </section>
  );
}

/** The loading shape: the section head over four 4:5 frames, so the page keeps its size when the tiles land. */
export function RecentWorkSkeletons() {
  return (
    <section className={secClasses}>
      <div className={homeWrapClasses}>
        <RecentHead withLink={false} />
        <div className={stripClasses}>
          {Array.from({ length: SKELETON_COUNT }, (_, position) => (
            <div key={position} className={stripSkeletonClasses} data-home-skeleton="recent" aria-hidden="true">
              <Skeleton width="100%" height="100%" radius={0} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
