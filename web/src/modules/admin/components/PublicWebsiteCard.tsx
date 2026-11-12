// SPEC-GAP: public website card. The Public website card of the order page (UI-SPEC O1; D-09, D-11 to D-16; plan 11-27), in the side
// column after the Customer card, for both roles: whether the customer said OK and who recorded it, whether the order is on the website,
// the line it is shown under and the name shown. Edit opens the Public Website window. Text only, never HTML (CWE-79).
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button } from '@/components/actions';
import { Icon, type IconName } from '@/components/brand';
import { Badge } from '@/components/status';
import { EmptyValue, Note } from '@/components/states';
import { PublicWebsiteModal } from '@/modules/admin/components/PublicWebsiteModal';
import {
  orderCardBodyClasses,
  orderCardHeadClasses,
  orderCardTitleClasses,
  orderMetaClasses,
  orderMetaMutedClasses,
  orderMetaNoteClasses,
  orderMetaRowClasses,
  orderMetaTermClasses,
  orderMetaValueClasses,
  orderPublicCardClasses,
} from '@/modules/admin/components/orderPage.recipe';
import { PUBLIC_WEBSITE_COPY } from '@/modules/admin/publicWebsiteCopy';
import type { OrderDetailResponse } from '@/modules/admin/services/ordersService';
import { formatBusinessDate } from '@/utils/format';

const COPY = PUBLIC_WEBSITE_COPY.card;
const TITLE_ID = 'order-public-website';

interface MetaRow {
  icon: IconName;
  label: string;
  value: ReactNode;
}

/** The name shown: the public name, else the team with the muted team name suffix, else the empty value. */
function nameShown(order: OrderDetailResponse): ReactNode {
  const { publicName } = order.publicWebsite;
  if (publicName !== null && publicName !== '') {
    return publicName;
  }
  if (order.teamName !== null && order.teamName.trim() !== '') {
    return (
      <>
        {order.teamName}
        <span className={orderMetaMutedClasses}>{COPY.teamSuffix}</span>
      </>
    );
  }
  return <EmptyValue />;
}

function rowsOf(order: OrderDetailResponse): readonly MetaRow[] {
  const block = order.publicWebsite;
  // A Cancelled order is never shown (D-38): the server clears the flag, and the card reads Not shown whatever it holds.
  const shown = block.shownOnWebsite && block.canShow;
  const recordedOn = block.consentRecordedAtUtc === null ? null : formatBusinessDate(block.consentRecordedAtUtc);
  const shownSince = block.shownSinceUtc === null ? null : formatBusinessDate(block.shownSinceUtc);
  return [
    {
      icon: 'shield-check',
      label: COPY.rows.customerOk,
      value: block.customerConsent ? COPY.consentYes(recordedOn, block.consentRecordedByName) : COPY.consentNo,
    },
    {
      icon: 'globe',
      label: COPY.rows.onWebsite,
      value: shown ? (
        <>
          <Badge tone="success">{COPY.shown}</Badge>
          {shownSince !== null && <span className={orderMetaMutedClasses}> {COPY.shownSince(shownSince)}</span>}
          {!block.hasPhoto && <span className={orderMetaNoteClasses}>{COPY.needsPhoto}</span>}
        </>
      ) : (
        <Badge tone="neutral">{COPY.notShown}</Badge>
      ),
    },
    {
      icon: 'shirt',
      label: COPY.rows.shownUnder,
      value: block.productLineTitle ?? <EmptyValue />,
    },
    { icon: 'users', label: COPY.rows.nameShown, value: nameShown(order) },
  ];
}

export interface PublicWebsiteCardProps {
  order: OrderDetailResponse;
}

export function PublicWebsiteCard({ order }: PublicWebsiteCardProps) {
  // A Cancelled order cannot be shown (D-38, OQ-9 A): no Edit, and a note says why. A Completed order can: the order lock does not cover this card.
  const { canShow } = order.publicWebsite;
  // The window mounts on its first open and stays so its close can animate; each new open starts clean.
  const [used, setUsed] = useState(false);
  const [open, setOpen] = useState(false);
  // Safari does not focus a button on a click, so the window's own return to its trigger has nothing to go back to: Edit is named here.
  const editRef = useRef<HTMLButtonElement>(null);
  const refocus = useRef(false);
  useEffect(() => {
    if (refocus.current && !open) {
      refocus.current = false;
      editRef.current?.focus();
    }
  });
  return (
    <>
      <section className={orderPublicCardClasses} aria-labelledby={TITLE_ID}>
        <div className={orderCardHeadClasses}>
          <h2 id={TITLE_ID} className={orderCardTitleClasses}>
            {COPY.title}
          </h2>
          {canShow && (
            <Button
              variant="ghost"
              size="sm"
              aria-label={COPY.editName}
              ref={editRef}
              onClick={() => {
                setUsed(true);
                setOpen(true);
              }}
            >
              {COPY.edit}
            </Button>
          )}
        </div>
        <div className={orderCardBodyClasses}>
          <dl className={orderMetaClasses}>
            {rowsOf(order).map((row) => (
              <div key={row.label} className={orderMetaRowClasses}>
                <dt className={orderMetaTermClasses}>
                  <Icon name={row.icon} size={16} />
                  {row.label}
                </dt>
                <dd className={orderMetaValueClasses}>{row.value}</dd>
              </div>
            ))}
          </dl>
          {!canShow && <Note icon="info">{COPY.cancelled}</Note>}
        </div>
      </section>
      {used && (
        <PublicWebsiteModal
          order={order}
          open={open}
          onClose={() => {
            refocus.current = true;
            setOpen(false);
          }}
        />
      )}
    </>
  );
}
