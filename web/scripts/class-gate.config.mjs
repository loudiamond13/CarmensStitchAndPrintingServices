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

/** Paths matching `src/components/media/ImageUploader*.{ts,tsx}`. */
const imageUploaderFiles = /^src\/components\/media\/ImageUploader[^/]*\.tsx?$/;

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
  // D-02 (named there as "the login numeral"): the decorative, aria-hidden outlined "C" of the auth brand panel.
  { pattern: /^opacity-50$/, files: /^src\/components\/layout\/layout\.recipe\.ts$/, decision: 'D-02' },
]);

/**
 * The CSS named colours (CSS Color 4) that a bracket value may not use. `transparent` and `currentColor` are not
 * palette colours and stay allowed (the theme's colour-mix() recipes fade to transparent).
 */
export const NAMED_COLOURS = Object.freeze(
  [
    'aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood',
    'cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray',
    'darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen',
    'darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue',
    'firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew',
    'hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan',
    'lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue',
    'lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine',
    'mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise',
    'mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered',
    'orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple',
    'rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue',
    'slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white',
    'whitesmoke yellow yellowgreen',
  ]
    .join(' ')
    .split(' '),
);

/**
 * A colour literal inside a class token (UI-SPEC transcription rule 2: colours come from tokens; TOOL-WR-07), any case:
 * a hex colour, any CSS colour function (rgb, rgba, hsl, hsla, hwb, lab, lch, oklab, oklch, color), or a named colour
 * as a whole word inside an arbitrary [value]. color-mix() over var(--…) tokens stays allowed. The same source is the
 * colour restriction of the ESLint rule (eslint.config.mjs), so the two gates cannot drift apart.
 */
export const COLOUR_LITERAL_SOURCE =
  '(?i:#[0-9a-f]{3,8}' +
  '|(?<![a-z0-9-])(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\\(' +
  `|\\[[^\\]]*(?<![a-z0-9-])(?:${NAMED_COLOURS.join('|')})(?![a-z0-9(-]))`;

export const COLOUR_LITERAL = new RegExp(COLOUR_LITERAL_SOURCE);
