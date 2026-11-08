// M2 One person's money, /admin/money/staff/:userId (D-42, D-43, MONEY-03; UI-SPEC M2). A Manager reads one person's money: a back link to
// All Staff, the name with the role and, for a leaver, the standing, the balance card and the ledger, both for this person. There is no
// header action: a Manager never moves money on someone's behalf here, and a leaver's hand-over stays on the All Staff row (D-45).
//   - The route's loader (requireManagerOrMoney) sends an Admin, and the Manager's own id, to My Money before any request. The API answers
//     403 to an Admin whether or not the person exists (OD-19).
//   - The id is checked in the browser first (the shared guid parser): anything else shows the not-found state and sends no request.
//     A 404 shows the same. The ledger is asked for only once the person is known, so a made-up id never reaches it.
//   - Every figure is the server's; the page works out nothing.
import clsx from 'clsx';
import { useEffect } from 'react';
import { useParams } from 'react-router';
import { ButtonLink, hitAreaClasses, UiLink } from '@/components/actions';
import { Icon } from '@/components/brand';
import { Skeleton } from '@/components/feedback';
import {
  loginBackClasses,
  pageHeadClasses,
  pageHeadTitleClasses,
  pageSublineClasses,
  pageTitleClasses,
} from '@/components/layout/layout.recipe';
import { ErrorState } from '@/components/states';
import { Badge } from '@/components/status';
import { isHttpError } from '@/core/api/errors';
import { guidParser } from '@/lib/url-state/parsers';
import { LedgerCard } from '@/modules/admin/components/LedgerCard';
import {
  personBackRowClasses,
  personNameClasses,
  personNotFoundClasses,
  personTitleRowClasses,
} from '@/modules/admin/components/money.recipe';
import { MoneyOnHandCard } from '@/modules/admin/components/MoneyOnHandCard';
import { RoleBadge } from '@/modules/admin/components/UserBadges';
import { ADMIN_COPY } from '@/modules/admin/copy';
import { useCleanStaffMoneyUrl } from '@/modules/admin/hooks/useCleanStaffMoneyUrl';
import { useStaffMoneyQuery } from '@/modules/admin/hooks/useStaffMoneyQuery';
import { MONEY_COPY } from '@/modules/admin/moneyCopy';

const COPY = MONEY_COPY.person;
const STATUS = MONEY_COPY.staff.status;
const ALL_STAFF_PATH = '/admin/money?tab=staff';

export function StaffMoneyRoute() {
  const { userId = '' } = useParams();
  // The id as the server accepts it, or null: nothing is asked for anything else.
  const id = guidParser.parse(userId);
  useCleanStaffMoneyUrl();
  const query = useStaffMoneyQuery(id);
  const person = query.data;
  const notFound = id === null || (isHttpError(query.error) && query.error.status === 404);

  const name = person?.name;
  useEffect(() => {
    document.title = `${name === undefined ? COPY.documentTitleFallback : COPY.documentTitle(name)}${ADMIN_COPY.titleSuffix}`;
  }, [name]);

  if (notFound) {
    return (
      <div className={personNotFoundClasses}>
        <ErrorState title={COPY.notFound.title} message={COPY.notFound.message} />
        <ButtonLink variant="secondary" to={ALL_STAFF_PATH}>
          {COPY.notFound.back}
        </ButtonLink>
      </div>
    );
  }

  return (
    <>
      <div className={pageHeadClasses}>
        <div className={pageHeadTitleClasses}>
          <div className={personBackRowClasses}>
            <UiLink to={ALL_STAFF_PATH} className={clsx(loginBackClasses, hitAreaClasses)}>
              <Icon name="chevron-left" size={16} />
              {COPY.back}
            </UiLink>
          </div>
          {person === undefined ? (
            <div aria-hidden="true">
              <Skeleton width={240} height={34} />
            </div>
          ) : (
            <div className={personTitleRowClasses}>
              <h1 className={clsx(pageTitleClasses, personNameClasses)}>{person.name}</h1>
              <RoleBadge role={person.role} />
              {person.status !== 'active' && (
                <Badge tone="neutral" dot>
                  {STATUS[person.status]}
                </Badge>
              )}
            </div>
          )}
          <p className={pageSublineClasses}>{COPY.subline}</p>
        </div>
      </div>
      <MoneyOnHandCard query={query} />
      {person !== undefined && <LedgerCard userId={id} />}
    </>
  );
}
