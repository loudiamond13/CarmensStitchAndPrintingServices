// HeroTag (UI-SPEC H1 item 1, D-14): the floating card on the hero drawing: "Recent order", the newest shown order's public name
// and "{17}-piece set · mockup to pickup". It is not a link, and with no tag nothing is drawn (no made-up team on the live
// site). It loads with the other parts below the fold (lazyHome.ts) and sits over the drawing, outside its hidden markup.
import { PUBLIC_COPY } from '../copy';
import type { PublicHeroTag } from '../services/contentService';
import { heroTagCapClasses, heroTagClasses, heroTagNameClasses } from './recent.recipe';

const { heroTag: COPY } = PUBLIC_COPY.home;

export interface HeroTagProps {
  tag: PublicHeroTag | null;
}

export function HeroTag({ tag }: HeroTagProps) {
  if (tag === null) {
    return null;
  }
  return (
    <div className={heroTagClasses}>
      <span className={heroTagCapClasses}>{COPY.label}</span>
      <strong className={heroTagNameClasses}>{tag.name}</strong>
      <span className={heroTagCapClasses}>{COPY.set(Number(tag.pieces))}</span>
    </div>
  );
}
