// The Visitor Stats URL state (UI-SPEC "URL params"; D-24, WEB-10, T-12-61): `range` from the allow-list, and with `custom` the
// business dates `from` and `to`. The default (last 30 days) never appears in the URL; an unknown range falls back to it and is
// removed with one replace; every change replaces the history entry.
import { createListParams } from '@/lib/url-state/createListParams';
import { dateRangeParsers } from '@/lib/url-state/parsers';
import { DEFAULT_STATS_RANGE, STATS_PRESETS } from '@/modules/admin/visitorStatsRange';

export const useVisitorStatsParams = createListParams(dateRangeParsers(STATS_PRESETS, DEFAULT_STATS_RANGE));
