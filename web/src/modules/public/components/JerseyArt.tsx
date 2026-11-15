// JerseyArt (UI-SPEC P1, spec 7.5): the drawn jerseys shown until a line has photos. The paths are the spec's, verbatim.
// The colors are SVG fill and stroke attributes, never a style attribute (strict CSP). The drawing is decorative: the
// line's title is on the page next to it.

export type JerseyShape = 'tank' | 'sleeve';

export interface JerseyArtColors {
  shape: JerseyShape;
  /** The body. */
  c1: string;
  /** The trim and panels. */
  c2: string;
  /** The number (and, on the long sleeve, the collar). */
  c3: string;
}

export interface JerseyArtProps extends JerseyArtColors {
  /** The number printed on the jersey, such as "23". */
  number: string;
  /** Layout glue only, on the svg. */
  className?: string | undefined;
}

// Spec 7.2 "Shape / colors" per placeholder name; the names are the API's `placeholderArt` values.
const ART: ReadonlyMap<string, JerseyArtColors> = new Map([
  ['basketball', { shape: 'tank', c1: '#572e2b', c2: '#ff6600', c3: '#ff6600' }],
  ['volleyball', { shape: 'tank', c1: '#7a1430', c2: '#ffffff', c3: '#ffffff' }],
  ['moto', { shape: 'sleeve', c1: '#1d3b8f', c2: '#f2f2ef', c3: '#ffb547' }],
  ['longSleeves', { shape: 'sleeve', c1: '#0e2a24', c2: '#3fe0b8', c3: '#f3f4f0' }],
  ['polo', { shape: 'sleeve', c1: '#f2f2ef', c2: '#121411', c3: '#121411' }],
  ['custom', { shape: 'tank', c1: '#24282d', c2: '#b9a7ff', c3: '#ff6600' }],
]);

const CUSTOM_ART: JerseyArtColors = { shape: 'tank', c1: '#24282d', c2: '#b9a7ff', c3: '#ff6600' };

/** The shape and colors of a line's placeholder art; a name this build does not know draws the custom jersey. */
export function artFor(placeholderArt: string): JerseyArtColors {
  return ART.get(placeholderArt) ?? CUSTOM_ART;
}

const NUMBER_FONT = 'Barlow Condensed, sans-serif';

export function JerseyArt({ shape, c1, c2, c3, number, className }: JerseyArtProps) {
  if (shape === 'tank') {
    return (
      <svg viewBox="0 0 400 480" aria-hidden="true" focusable="false" className={className}>
        <path
          d="M118,18 C150,74 250,74 282,18 L332,18 C332,108 356,148 384,160 L384,470 L16,470 L16,160 C44,148 68,108 68,18 Z"
          fill={c1}
        />
        <path d="M16,250 L384,170 L384,210 L16,290 Z" fill={c2} />
        <path d="M118,18 C150,74 250,74 282,18" fill="none" stroke={c2} strokeWidth="10" />
        <text
          x="200"
          y="330"
          textAnchor="middle"
          fontFamily={NUMBER_FONT}
          fontWeight="800"
          fontStyle="italic"
          fontSize="150"
          fill={c3}
        >
          {number}
        </text>
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 400 480" aria-hidden="true" focusable="false" className={className}>
      <path
        d="M140,26 C165,64 235,64 260,26 L340,52 L398,250 L340,268 L320,190 L320,470 L80,470 L80,190 L60,268 L2,250 L60,52 Z"
        fill={c1}
      />
      <path d="M60,52 L140,26 L170,120 L2,250 Z" fill={c2} />
      <path d="M340,52 L260,26 L230,120 L398,250 Z" fill={c2} />
      <path d="M140,26 C165,64 235,64 260,26" fill="none" stroke={c3} strokeWidth="10" />
      <text
        x="200"
        y="330"
        textAnchor="middle"
        fontFamily={NUMBER_FONT}
        fontWeight="800"
        fontStyle="italic"
        fontSize="130"
        fill={c3}
      >
        {number}
      </text>
    </svg>
  );
}
