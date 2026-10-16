// @ts-check
// The Lighthouse gate's pass rule (PERF-02, research Pattern 13), kept pure so every boundary is unit-tested
// (scripts/lighthouse-assert.test.ts). It reads the raw 0-1 category scores and the raw metric values of a Lighthouse JSON
// result and never rounds them: 0.95 passes and 0.949 fails; LCP 1999 ms passes and 2000 ms fails. A category or metric
// that is missing or has no value is a failure, never a pass. Every failure is listed, categories by name first, then
// metrics by name, so one run shows everything that needs fixing. Guide: docs/web/release-gates.md.

/**
 * @typedef {{ readonly id: string, readonly label: string, readonly below: number, readonly unit: string }} MetricRule
 * @typedef {{ readonly minCategoryScore: number, readonly categories: readonly string[], readonly metrics: readonly MetricRule[] }} Thresholds
 * @typedef {{ readonly passed: boolean, readonly failures: readonly string[], readonly warnings: readonly string[], readonly lines: readonly string[] }} AssertResult
 */

/**
 * The limits (CLAUDE.md perf budgets): every category at 0.95 or more (Lighthouse ≥ 95), LCP < 2000 ms, CLS < 0.05, and
 * TBT < 200 ms as the lab proxy for INP (a navigation run has no interactions to measure INP on). Frozen, so nothing can
 * loosen a limit at run time; a failing gate is fixed in the code, never here.
 * @type {Thresholds}
 */
export const THRESHOLDS = Object.freeze({
  minCategoryScore: 0.95,
  categories: Object.freeze(['accessibility', 'best-practices', 'performance', 'seo']),
  metrics: Object.freeze([
    Object.freeze({ id: 'cumulative-layout-shift', label: 'CLS', below: 0.05, unit: '' }),
    Object.freeze({ id: 'largest-contentful-paint', label: 'LCP', below: 2000, unit: 'ms' }),
    Object.freeze({ id: 'total-blocking-time', label: 'TBT', below: 200, unit: 'ms' }),
  ]),
});

/**
 * TEMPORARY WAIVER (owner, 2026-10-16; .planning/WINDOWS.md entry 1). These metrics are measured and printed on every run, but
 * missing the limit does not fail the build. Only a limit miss is waived: a missing or empty value still fails. The 2000 ms
 * target in THRESHOLDS is unchanged. REMOVE IN PHASE 11 (empty this list) when the public pages revisit fonts.
 * @type {readonly string[]}
 */
export const REPORT_ONLY_METRICS = Object.freeze(['largest-contentful-paint']);

/**
 * @param {unknown} value
 * @returns {Record<string, unknown>}
 */
function asRecord(value) {
  return typeof value === 'object' && value !== null ? /** @type {Record<string, unknown>} */ (value) : {};
}

/**
 * The finite number at `record[key]`, or null when it is absent, null or not a finite number.
 * @param {Record<string, unknown>} record
 * @param {string} key
 * @returns {number | null}
 */
function finiteAt(record, key) {
  const value = record[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * @param {number} value
 * @param {string} unit
 * @returns {string}
 */
function withUnit(value, unit) {
  return unit === '' ? String(value) : `${String(value)} ${unit}`;
}

/** @param {string} a @param {string} b */
function byName(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Checks a Lighthouse JSON result against the thresholds.
 * @param {unknown} report the parsed report.json.
 * @param {Thresholds} [thresholds]
 * @param {readonly string[]} [reportOnly] metric ids whose limit miss is a warning, not a failure (none by default).
 * @returns {AssertResult} `failures` holds one line per failing item, `warnings` one per waived miss; `lines` one summary
 *   line per item checked.
 */
export function assertReport(report, thresholds = THRESHOLDS, reportOnly = []) {
  const root = asRecord(report);
  const categories = asRecord(root.categories);
  const audits = asRecord(root.audits);
  /** @type {string[]} */
  const failures = [];
  /** @type {string[]} */
  const warnings = [];
  /** @type {string[]} */
  const lines = [];

  // The four required categories, plus any other category the report scored, held to the same limit.
  const categoryIds = [...new Set([...thresholds.categories, ...Object.keys(categories)])].sort(byName);
  for (const id of categoryIds) {
    const name = `category ${id}`;
    const limit = String(thresholds.minCategoryScore);
    if (!Object.hasOwn(categories, id)) {
      failures.push(`${name}: missing from the report`);
      lines.push(`${name}: missing (needs >= ${limit}) FAIL`);
      continue;
    }
    const score = finiteAt(asRecord(categories[id]), 'score');
    if (score === null) {
      failures.push(`${name}: no score`);
      lines.push(`${name}: no score (needs >= ${limit}) FAIL`);
      continue;
    }
    const ok = score >= thresholds.minCategoryScore;
    if (!ok) {
      failures.push(`${name}: score ${String(score)} is below ${limit}`);
    }
    lines.push(`${name}: ${String(score)} (needs >= ${limit}) ${ok ? 'ok' : 'FAIL'}`);
  }

  for (const metric of [...thresholds.metrics].sort((a, b) => byName(a.id, b.id))) {
    const name = `metric ${metric.label} (${metric.id})`;
    const limit = withUnit(metric.below, metric.unit);
    if (!Object.hasOwn(audits, metric.id)) {
      failures.push(`${name}: missing from the report`);
      lines.push(`${name}: missing (needs < ${limit}) FAIL`);
      continue;
    }
    const value = finiteAt(asRecord(audits[metric.id]), 'numericValue');
    if (value === null) {
      failures.push(`${name}: no value`);
      lines.push(`${name}: no value (needs < ${limit}) FAIL`);
      continue;
    }
    const ok = value < metric.below;
    const waived = !ok && reportOnly.includes(metric.id);
    if (waived) {
      warnings.push(
        `${name}: ${withUnit(value, metric.unit)} is not below ${limit} (report only until Phase 11, WINDOWS.md entry 1)`,
      );
    } else if (!ok) {
      failures.push(`${name}: ${withUnit(value, metric.unit)} is not below ${limit}`);
    }
    lines.push(`${name}: ${withUnit(value, metric.unit)} (needs < ${limit}) ${ok ? 'ok' : waived ? 'WAIVED' : 'FAIL'}`);
  }

  return { passed: failures.length === 0, failures, warnings, lines };
}

/**
 * The CI and local gate: the strict rule with the temporary LCP waiver (REPORT_ONLY_METRICS) applied.
 * @param {unknown} report the parsed report.json.
 * @returns {AssertResult}
 */
export function assertGateReport(report) {
  return assertReport(report, THRESHOLDS, REPORT_ONLY_METRICS);
}

/**
 * One line per element that shifted, biggest first, from the report's layout-shifts audit. Printed when a threshold is
 * missed, so a failed CI run names the culprit without the report file. Anything missing or malformed gives no lines.
 * @param {unknown} report the parsed report.json.
 * @returns {string[]}
 */
export function layoutShiftCulprits(report) {
  const items = asRecord(asRecord(asRecord(asRecord(report).audits)['layout-shifts']).details).items;
  if (!Array.isArray(items)) {
    return [];
  }
  /** @type {{ score: number, label: string }[]} */
  const shifts = [];
  for (const item of /** @type {unknown[]} */ (items)) {
    const record = asRecord(item);
    const node = asRecord(record.node);
    const score = finiteAt(record, 'score');
    const label = [node.selector, node.snippet].find((text) => typeof text === 'string' && text !== '');
    if (score !== null && typeof label === 'string') {
      shifts.push({ score, label: label.length > 100 ? `${label.slice(0, 100)}...` : label });
    }
  }
  return shifts.sort((a, b) => b.score - a.score).map((shift) => `layout shift ${String(shift.score)}: ${shift.label}`);
}
