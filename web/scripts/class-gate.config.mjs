// @ts-check
// Class-gate policy (D-33, D-02, A11Y-04). Read by scripts/class-gate.mjs.
//
// D-02: no text-bearing element may render below opacity 1, so an `opacity-*` token (under any variant, or the
// arbitrary `[opacity:…]` property) is accepted only when an entry below matches it for that file. A new entry needs
// an owner decision ID in its `decision` field and its comment; the class-gate test fails an entry without one.

/**
 * @typedef {object} OpacityAllow
 * @property {RegExp} pattern The whole class token, variants included.
 * @property {RegExp} [files] Paths relative to web/ (forward slashes) where the entry applies; every file when absent.
 * @property {string} decision The owner decision that allows it.
 */

/** Paths matching `src/ui/media/ImageUploader*.{ts,tsx}`. */
const imageUploaderFiles = /^src\/ui\/media\/ImageUploader[^/]*\.tsx?$/;

/** @type {readonly OpacityAllow[]} */
export const OPACITY_ALLOW = Object.freeze([
  // D-02 / WEB-09: the App. B disabled button and the pending button (aria-disabled) share the 45% look.
  { pattern: /^(disabled|aria-disabled):opacity-45$/, decision: 'D-02' },
  // D-05: the ImageUploader thumb grip and actions are hidden at rest on hover devices, shown on hover and on
  // keyboard focus within the thumb, and always shown on touch.
  { pattern: /^opacity-0$/, files: imageUploaderFiles, decision: 'D-05' },
  { pattern: /^group-hover\/thumb:opacity-100$/, files: imageUploaderFiles, decision: 'D-05' },
  { pattern: /^group-focus-within\/thumb:opacity-100$/, files: imageUploaderFiles, decision: 'D-05' },
  { pattern: /^no-hover:opacity-100$/, files: imageUploaderFiles, decision: 'D-05' },
]);

/** A colour literal inside a class token (UI-SPEC transcription rule 2: colours come from tokens). */
export const COLOUR_LITERAL = /#[0-9a-f]{3,8}|rgba?\(|oklch\(/i;
