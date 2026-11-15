// HeroArt (UI-SPEC H1 item 1, App. E.1): the hero's drawing, copied from the approved design. Stacked back to front: the
// outlined "23", the sand slab, the orange slab and the maroon jersey with its drop shadow. It is decorative, so the whole
// drawing is hidden from assistive technology. The colors are SVG attributes, never a style attribute (strict CSP). The
// floating "Recent order" tag (HeroTag) is a sibling over it, so the hidden drawing never holds readable text.
import { heroArtClasses, heroJerseyClasses, heroNumClasses, heroSlabBackClasses, heroSlabClasses } from './home.recipe';

const BODY =
  'M118,18 C150,74 250,74 282,18 L332,18 C332,108 356,148 384,160 L384,470 L16,470 L16,160 C44,148 68,108 68,18 Z';
const FONT = 'Barlow Condensed, sans-serif';

export function HeroArt() {
  return (
    <div className={heroArtClasses} aria-hidden="true">
      <span className={heroNumClasses}>23</span>
      <div className={heroSlabBackClasses} />
      <div className={heroSlabClasses} />
      <svg className={heroJerseyClasses} viewBox="0 0 400 480" focusable="false">
        <defs>
          <pattern id="home-hero-mesh" width="6" height="6" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1" fill="#ffffff" fillOpacity=".06" />
          </pattern>
          <clipPath id="home-hero-clip">
            <path d={BODY} />
          </clipPath>
        </defs>
        <path d={BODY} fill="#572e2b" />
        <g clipPath="url(#home-hero-clip)">
          <rect width="400" height="480" fill="url(#home-hero-mesh)" />
          <path d="M16,250 L120,170 L120,200 L16,280 Z" fill="#ff6600" />
          <path d="M16,300 L120,220 L120,236 L16,316 Z" fill="#ff6600" />
          <path d="M384,250 L280,330 L280,360 L384,280 Z" fill="#ff6600" />
          <path d="M16,430 L384,380 L384,470 L16,470 Z" fill="#2b1513" />
          <path d="M16,420 L384,370 L384,380 L16,430 Z" fill="#ff6600" />
        </g>
        <path d="M118,18 C150,74 250,74 282,18" fill="none" stroke="#ff6600" strokeWidth="8" />
        <path
          d="M68,18 C68,108 44,148 16,160 M332,18 C332,108 356,148 384,160"
          fill="none"
          stroke="#ff6600"
          strokeWidth="6"
        />
        <text
          x="200"
          y="128"
          textAnchor="middle"
          fontFamily={FONT}
          fontWeight="800"
          fontStyle="italic"
          fontSize="30"
          letterSpacing="3"
          fill="#f3f4f0"
        >
          SAN ROQUE
        </text>
        <text
          x="200"
          y="300"
          textAnchor="middle"
          fontFamily={FONT}
          fontWeight="800"
          fontStyle="italic"
          fontSize="190"
          fill="#ff6600"
          stroke="#2b1513"
          strokeWidth="5"
          paintOrder="stroke"
        >
          23
        </text>
      </svg>
    </div>
  );
}
