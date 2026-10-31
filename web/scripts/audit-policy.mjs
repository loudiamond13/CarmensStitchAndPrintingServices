// @ts-check
// npm audit policy (OPS-03, 07.1 D-46). Every advisory fails unless the owner accepted that exact GHSA id for the packages
// it names and today is on or before its review date. An acceptance that no advisory needs is stale.

/**
 * @typedef {{ id: string, package: string, severity: string, title: string }} Advisory
 * @typedef {{ id: string, packages: string[], reason: string, approved: string, approvedBy: string, reviewBy: string }} AuditException
 */

const GHSA = /^GHSA(?:-[23456789cfghjmpqrvwx]{4}){3}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * @param {unknown} value
 * @returns {Record<string, unknown>}
 */
function record(value) {
  return typeof value === 'object' && value !== null ? /** @type {Record<string, unknown>} */ (value) : {};
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function text(value) {
  return typeof value === 'string' ? value : '';
}

/**
 * The advisories in one `npm audit --json` report, once each. Entries flagged only through a dependency add nothing.
 * @param {unknown} report
 * @returns {Advisory[]}
 */
export function advisoriesOf(report) {
  const root = record(report);
  if (root.error !== undefined) {
    throw new Error(`npm audit could not run: ${text(record(root.error).summary) || 'unknown error'}`);
  }
  /** @type {Map<string, Advisory>} */
  const found = new Map();
  for (const entry of Object.values(record(root.vulnerabilities))) {
    const via = record(entry).via;
    for (const item of Array.isArray(via) ? via : []) {
      if (typeof item !== 'object' || item === null) continue;
      const fields = record(item);
      const url = text(fields.url);
      const id = url.slice(url.lastIndexOf('/') + 1) || String(fields.source);
      const advisory = { id, package: text(fields.name), severity: text(fields.severity), title: text(fields.title) };
      found.set(`${advisory.id} ${advisory.package}`, advisory);
    }
  }
  return [...found.values()];
}

/**
 * Shape problems in the owner's acceptance list.
 * @param {unknown} list
 * @returns {string[]}
 */
export function validateAuditExceptions(list) {
  if (!Array.isArray(list)) return ['Audit exceptions must be a list.'];
  /** @type {string[]} */
  const problems = [];
  list.forEach((item, index) => {
    const entry = record(item);
    const label = `Audit exception ${String(index + 1)}`;
    const id = text(entry.id);
    const packages = Array.isArray(entry.packages)
      ? entry.packages.filter((name) => typeof name === 'string' && name)
      : [];
    const approved = text(entry.approved);
    const reviewBy = text(entry.reviewBy);
    if (!GHSA.test(id)) problems.push(`${label}: id '${id}' is not a GHSA id.`);
    if (packages.length === 0) problems.push(`${label}: packages must list at least one package name.`);
    if (!text(entry.reason).trim()) problems.push(`${label}: reason is required.`);
    if (!DATE.test(approved)) problems.push(`${label}: approved must be a date.`);
    if (entry.approvedBy !== 'owner') problems.push(`${label}: approvedBy must be 'owner'.`);
    if (!DATE.test(reviewBy) || reviewBy < approved) {
      problems.push(`${label} (${id}): reviewBy must be a date on or after approved.`);
    }
  });
  return problems;
}

/**
 * @param {readonly Advisory[]} advisories every advisory across the audited trees
 * @param {readonly AuditException[]} exceptions the owner's acceptances (already validated)
 * @param {string} today yyyy-mm-dd
 * @returns {{ problems: string[], accepted: string[] }}
 */
export function evaluateAudit(advisories, exceptions, today) {
  /** @type {string[]} */
  const problems = [];
  /** @type {Set<string>} */
  const accepted = new Set();
  /** @type {Set<AuditException>} */
  const used = new Set();
  for (const advisory of advisories) {
    const match = exceptions.find((entry) => entry.id === advisory.id && entry.packages.includes(advisory.package));
    if (!match) {
      problems.push(
        `${advisory.package}: ${advisory.id} (${advisory.severity}) ${advisory.title}. Not accepted: fix it or ask the owner.`,
      );
      continue;
    }
    used.add(match);
    if (today > match.reviewBy) {
      problems.push(
        `${advisory.package}: ${advisory.id} was accepted until ${match.reviewBy}. Review it with the owner.`,
      );
    } else {
      accepted.add(`${advisory.id} (${advisory.package})`);
    }
  }
  for (const entry of exceptions) {
    if (!used.has(entry)) {
      problems.push(`Audit exception ${entry.id} (${entry.packages.join(', ')}) matches no advisory. Remove it.`);
    }
  }
  return { problems: [...new Set(problems)], accepted: [...accepted].sort() };
}
