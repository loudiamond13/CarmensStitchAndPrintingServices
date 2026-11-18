// The Visitor Stats toolbar (UI-SPEC V1 item 1; D-24, WEB-10). SPEC-GAP: V1. The Date range select over the five server presets
// and Custom range; with Custom range, From and To. The choice is written to the URL by the page's one URL hook.
import { Select } from '@/components';
import { StatsCustomRange } from '@/modules/admin/components/StatsCustomRange';
import { visitorStatsToolbarClasses } from '@/modules/admin/components/visitorStats.recipe';
import { VISITOR_STATS_COPY } from '@/modules/admin/visitorStatsCopy';
import { STATS_RANGES, type StatsRange, type StatsRangeState } from '@/modules/admin/visitorStatsRange';

const COPY = VISITOR_STATS_COPY;
const RANGE_OPTIONS = STATS_RANGES.map((value) => ({ value, label: COPY.ranges[value] }));

function asRange(value: string): StatsRange | null {
  return STATS_RANGES.find((range) => range === value) ?? null;
}

export interface VisitorStatsToolbarProps {
  value: StatsRangeState;
  onChange: (next: StatsRangeState) => void;
}

export function VisitorStatsToolbar({ value, onChange }: VisitorStatsToolbarProps) {
  return (
    <div className={visitorStatsToolbarClasses}>
      <Select
        label={COPY.toolbar.dateRange}
        options={RANGE_OPTIONS}
        value={value.range}
        onChange={(event) => {
          const range = asRange(event.target.value);
          if (range !== null) onChange({ range, from: null, to: null });
        }}
      />
      {value.range === 'custom' && (
        <StatsCustomRange
          from={value.from}
          to={value.to}
          onApply={(from, to) => {
            onChange({ range: 'custom', from, to });
          }}
        />
      )}
    </div>
  );
}
