// The Devices and browsers card of Visitor Stats (UI-SPEC V1 item 7; ANL-08). SPEC-GAP: StatBarList. Two StatBarLists under the
// h3s "Device" and "Browser", side by side at 1280px and up. Every count and share is the server's.
import { SkeletonText } from '@/components';
import {
  dashboardCardClasses,
  dashboardCardHeadClasses,
  dashboardCardSubClasses,
  dashboardCardTitleClasses,
} from '@/modules/admin/components/dashboard.recipe';
import { StatBarList } from '@/modules/admin/components/StatBarList';
import {
  deviceBrowserColumnClasses,
  deviceBrowserGridClasses,
  deviceBrowserHeadingClasses,
} from '@/modules/admin/components/visitorStats.recipe';
import type { RankedItem } from '@/modules/admin/services/visitorStatsService';
import { VISITOR_STATS_COPY } from '@/modules/admin/visitorStatsCopy';

const COPY = VISITOR_STATS_COPY;

function deviceLabel(name: string): string {
  return COPY.devices[name] ?? name;
}

export interface DeviceBrowserCardProps {
  /** Undefined while the first read runs. */
  devices: readonly RankedItem[] | undefined;
  /** Undefined while the first read runs. */
  browsers: readonly RankedItem[] | undefined;
}

function Column({
  title,
  items,
  labelFor,
}: {
  title: string;
  items: readonly RankedItem[] | undefined;
  labelFor?: (name: string) => string;
}) {
  return (
    <div className={deviceBrowserColumnClasses}>
      <h3 className={deviceBrowserHeadingClasses}>{title}</h3>
      {items === undefined ? (
        <SkeletonText lines={3} />
      ) : (
        <StatBarList items={items} labelFor={labelFor} emptyText={COPY.lists.empty} />
      )}
    </div>
  );
}

export function DeviceBrowserCard({ devices, browsers }: DeviceBrowserCardProps) {
  return (
    <section className={dashboardCardClasses}>
      <div className={dashboardCardHeadClasses}>
        <div>
          <h2 className={dashboardCardTitleClasses}>{COPY.lists.devices}</h2>
          <p className={dashboardCardSubClasses}>{COPY.lists.devicesSub}</p>
        </div>
      </div>
      <div className={deviceBrowserGridClasses}>
        <Column title={COPY.lists.device} items={devices} labelFor={deviceLabel} />
        <Column title={COPY.lists.browser} items={browsers} />
      </div>
    </section>
  );
}
