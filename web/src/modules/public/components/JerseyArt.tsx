// JerseyArt (UI-SPEC P1, spec 7.5): the drawn jerseys shown until a line has photos.
export type JerseyShape = 'tank' | 'sleeve';

export interface JerseyArtColors {
  shape: JerseyShape;
  c1: string;
  c2: string;
  c3: string;
}

export interface JerseyArtProps extends JerseyArtColors {
  number: string;
}

export function artFor(placeholderArt: string): JerseyArtColors {
  void placeholderArt;
  return { shape: 'tank', c1: '', c2: '', c3: '' };
}

export function JerseyArt({ number }: JerseyArtProps) {
  void number;
  return null;
}
