// @ts-check
// Class-gate policy (D-33, D-02). RED stub: no allow-list and no colour pattern yet.

/** @typedef {{ readonly pattern: RegExp, readonly files?: RegExp, readonly decision: string }} OpacityAllow */

/** @type {readonly OpacityAllow[]} */
export const OPACITY_ALLOW = Object.freeze([]);

/** Matches nothing yet. */
export const COLOUR_LITERAL = /(?!)/;
