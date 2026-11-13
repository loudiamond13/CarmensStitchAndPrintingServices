import type { PublicHeroTag } from '../services/contentService';

export interface HeroTagProps {
  tag: PublicHeroTag | null;
}

export function HeroTag({ tag }: HeroTagProps) {
  return tag === null ? null : <div />;
}
