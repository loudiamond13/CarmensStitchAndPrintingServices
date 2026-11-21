// The Visitor Stats toolbar (UI-SPEC V1 item 1; D-24, D-25, WEB-10). SPEC-GAP: V1. The Date range select over the five server presets
// and Custom range; with Custom range, From and To. The choice is written to the URL by the page's one URL hook. Export CSV saves the
// range the page shows.
import { useState } from 'react';
import { Button, Select } from '@/components';
import { useToast } from '@/components/feedback';
import { StatsCustomRange } from '@/modules/admin/components/StatsCustomRange';
import { visitorStatsToolbarClasses } from '@/modules/admin/components/visitorStats.recipe';
import { downloadCsv } from '@/modules/admin/downloadCsv';
import { visitorStatsService, type VisitorStatsQuery } from '@/modules/admin/services/visitorStatsService';
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
  /** The range the page last applied: the one Export CSV saves. Null turns Export CSV off. */
  exportQuery: VisitorStatsQuery | null;
}

export function VisitorStatsToolbar({ value, onChange, exportQuery }: VisitorStatsToolbarProps) {
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
      <ExportCsvButton query={exportQuery} />
    </div>
  );
}

/** Export CSV (UI-SPEC V1 "CSV export"): "Exporting" while the file is made, then a toast says whether it was saved. */
function ExportCsvButton({ query }: { query: VisitorStatsQuery | null }) {
  const toast = useToast();
  const [pending, setPending] = useState(false);

  async function exportFile(range: VisitorStatsQuery): Promise<void> {
    setPending(true);
    try {
      const file = await visitorStatsService.exportCsv(range);
      downloadCsv(file.text, file.fileName);
      toast.show({ title: COPY.export.done.title, message: COPY.export.done.message(file.fileName) });
    } catch {
      toast.show({ tone: 'danger', title: COPY.export.failed.title, message: COPY.export.failed.message });
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      variant="secondary"
      icon="download"
      pending={pending}
      disabled={query === null}
      onClick={() => {
        if (query !== null) void exportFile(query);
      }}
    >
      {pending ? COPY.export.pending : COPY.toolbar.exportCsv}
    </Button>
  );
}
