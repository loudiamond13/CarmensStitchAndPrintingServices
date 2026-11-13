// SPEC-DEVIATION: D-20 App. E.4's map is a drawing ("may be swapped for an embedded map", spec §7.4). Here the drawing stays
// until the visitor taps Show Map; only then does the Google frame load, so no Google request is made before the tap. The
// frame fills the same 16:10 box (no layout shift), and the label card moves under it so it never covers the map's own
// controls. The choice lasts for this page view only. The frame has a title, loads lazily, sends a strict referrer and gets
// no `allow` features; the CSP allows only the embed path (SecurityHeadersMiddleware).
// Phase 12 hook: once consent exists and the visitor allowed maps, `loaded` starts true. Phase 11 always waits for the tap.
// While the shop facts load the drawn map shows at once and the address is a skeleton line.
import clsx from 'clsx';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/actions/Button';
import { UiLink } from '@/components/actions/UiLink';
import { Icon } from '@/components/brand/Icon';
import { Skeleton } from '@/components/feedback/Skeleton';
import { srOnlyClasses } from '@/components/layout/layout.recipe';
import { PUBLIC_COPY } from '../copy';
import type { PublicSite } from '../services/siteService';
import { streetAndTown } from '../siteFacts';
import {
  mapActionsClasses,
  mapBoxClasses,
  mapCardClasses,
  mapDirectionsClasses,
  mapFrameClasses,
  mapLabelClasses,
  mapLabelOverlayClasses,
  mapLabelTextClasses,
  mapPinClasses,
  mapPinHeadClasses,
  mapRoadDashClasses,
  mapRoadFarClasses,
  mapRoadMainClasses,
  mapRoadSideClasses,
  mapRoadsClasses,
  smallMutedClasses,
} from './contact.recipe';

const { map: MAP } = PUBLIC_COPY.contact;

/** The only frame source the CSP allows; a stored link outside it is never loaded. */
const EMBED_PREFIX = 'https://www.google.com/maps/embed';

export interface MapCardProps {
  /** The shop facts, or undefined while they load. */
  site: PublicSite | undefined;
}

export function MapCard({ site }: MapCardProps) {
  const [loaded, setLoaded] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    if (loaded) {
      frame.current?.focus();
    }
  }, [loaded]);

  const address = site === undefined ? '' : streetAndTown(site.address);
  const embed = site?.mapEmbedUrl?.startsWith(EMBED_PREFIX) === true ? site.mapEmbedUrl : null;
  const directions = site?.directionsUrl ?? null;
  if (site !== undefined && embed === null && directions === null && address === '') {
    return null;
  }

  const offerMap = embed !== null && !loaded;
  const label = (
    <div data-map-label className={clsx(mapLabelClasses, !loaded && mapLabelOverlayClasses)}>
      <span className={mapLabelTextClasses}>
        <strong className="block">{MAP.shopName}</strong>
        {site === undefined ? <Skeleton width={160} height={14} /> : <span className="text-ink-muted">{address}</span>}
      </span>
      {(offerMap || directions !== null) && (
        <span className={mapActionsClasses}>
          {offerMap && (
            <Button
              variant="secondary"
              size="sm"
              icon="map-pin"
              onClick={() => {
                setLoaded(true);
              }}
            >
              {MAP.showMap}
            </Button>
          )}
          {directions !== null && (
            <UiLink to={directions} target="_blank" rel="noopener noreferrer" className={mapDirectionsClasses}>
              {MAP.directions}
              <Icon name="arrow-up-right" size={16} />
              <span className={srOnlyClasses}>{MAP.newTab}</span>
            </UiLink>
          )}
        </span>
      )}
    </div>
  );

  return (
    <div className={mapCardClasses}>
      <div data-map-box className={mapBoxClasses}>
        {loaded && embed !== null ? (
          <iframe
            ref={frame}
            src={embed}
            title={MAP.frameTitle(site?.businessName ?? '')}
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            className={mapFrameClasses}
          />
        ) : (
          <>
            {/* SPEC-DEVIATION: 11-UI-REVIEW fix 2: App. E.4 draws the roads in hex; here they are the Blush tokens of the same values (public pages are Blush only). */}
            <svg
              className={mapRoadsClasses}
              viewBox="0 0 400 250"
              preserveAspectRatio="xMidYMid slice"
              role="img"
              aria-label={MAP.placeholder}
            >
              <path
                d="M-10,180 C80,160 160,190 240,150 S380,120 420,130"
                fill="none"
                className={mapRoadMainClasses}
                strokeWidth="14"
              />
              <path d="M120,-10 L170,260" fill="none" className={mapRoadMainClasses} strokeWidth="10" />
              <path d="M290,-10 C270,80 300,160 260,260" fill="none" className={mapRoadSideClasses} strokeWidth="8" />
              <path d="M-10,70 L420,40" fill="none" className={mapRoadFarClasses} strokeWidth="6" />
              <path
                d="M-10,180 C80,160 160,190 240,150 S380,120 420,130"
                fill="none"
                className={mapRoadDashClasses}
                strokeWidth="1"
                strokeDasharray="8 6"
              />
            </svg>
            <div className={mapPinClasses} aria-hidden="true">
              <span className={mapPinHeadClasses}>
                <Icon name="shirt" size={20} />
              </span>
            </div>
            {label}
          </>
        )}
      </div>
      {offerMap && <p className={smallMutedClasses}>{MAP.privacy}</p>}
      {loaded && embed !== null && label}
    </div>
  );
}
