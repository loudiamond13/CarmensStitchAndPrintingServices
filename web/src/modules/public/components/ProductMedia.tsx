// ProductMedia (UI-SPEC P1 item 3, D-02): the 5:4 media grid of a line. The large cell is the Main photo, or the drawn
// jersey when there is none; the two small cells are the Back view and Fabric detail photos, or labelled placeholders.
// Photos load lazily inside their reserved boxes (CLS) and use the server's srcSet; the sizes say how wide each cell shows.
import clsx from 'clsx';
import { MediaPlaceholder } from '@/components/brand/MediaPlaceholder';
import { LazyImage } from '@/components/states/LazyImage';
import { PUBLIC_COPY } from '../copy';
import type { PublicProductLine } from '../services/contentService';
import { artFor, JerseyArt } from './JerseyArt';
import {
  jerseyKitClasses,
  jerseySvgClasses,
  mediaCellClasses,
  mediaFillClasses,
  mediaGridClasses,
  mediaGroundClasses,
  mediaLargeCellClasses,
  mediaSmallCellClasses,
} from './products.recipe';

const { article: COPY } = PUBLIC_COPY.products;

// UI-SPEC "Image delivery slots": the product large and small cells.
const LARGE_SIZES = '(max-width: 767px) calc(100vw - 32px), (max-width: 1023px) calc(66.6667vw - 40px), 400px';
const SMALL_SIZES = '(max-width: 767px) calc(50vw - 22px), (max-width: 1023px) calc(33.3333vw - 20px), 200px';

type PhotoData = NonNullable<PublicProductLine['photos']['main']>;

export interface ProductMediaProps {
  line: PublicProductLine;
  /** Layout glue only, on the grid. */
  className?: string | undefined;
}

function Photo({ photo, alt, sizes, ratio }: { photo: PhotoData; alt: string; sizes: string; ratio: string }) {
  return (
    <div className={mediaFillClasses}>
      <LazyImage
        src={photo.src}
        srcSet={photo.srcSet}
        sizes={sizes}
        width={Number(photo.width)}
        height={Number(photo.height)}
        alt={alt}
        ratio={ratio}
        className="size-full"
      />
    </div>
  );
}

export function ProductMedia({ line, className }: ProductMediaProps) {
  const { main, back, fabric } = line.photos;
  const art = artFor(line.placeholderArt);
  return (
    <div className={clsx(mediaGridClasses, className)}>
      <div className={clsx(mediaCellClasses, mediaLargeCellClasses)}>
        {main === null ? (
          <>
            <div className={mediaGroundClasses} />
            <div className={jerseyKitClasses}>
              <JerseyArt {...art} number={line.number} className={jerseySvgClasses} />
            </div>
          </>
        ) : (
          <Photo photo={main} alt={COPY.frontAlt(line.title)} sizes={LARGE_SIZES} ratio="4 / 5" />
        )}
      </div>
      <div className={clsx(mediaCellClasses, mediaSmallCellClasses)}>
        {back === null ? (
          <div className={mediaFillClasses}>
            <MediaPlaceholder label={COPY.backPlaceholder} number={line.number} ratio="1 / 1" className="h-full" />
          </div>
        ) : (
          <Photo photo={back} alt={COPY.backAlt(line.title)} sizes={SMALL_SIZES} ratio="1 / 1" />
        )}
      </div>
      <div className={clsx(mediaCellClasses, mediaSmallCellClasses)}>
        {fabric === null ? (
          <div className={mediaFillClasses}>
            <MediaPlaceholder label={COPY.fabricPlaceholder} ratio="1 / 1" className="h-full" />
          </div>
        ) : (
          <Photo photo={fabric} alt={COPY.fabricAlt(line.title)} sizes={SMALL_SIZES} ratio="1 / 1" />
        )}
      </div>
    </div>
  );
}
