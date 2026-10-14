// Media group (App. D.3 ImageUploader, CSPS-UI-SPEC.md §6.3; plan 02-25). Every scenario here has group 'media'. Each
// case is compared in both themes at 390 and 1440 px:
//   - `uploader-empty`: the dashed drop zone alone ("Drag images here or browse", "… · 0/12"), at rest and with the
//     "browse" link button focused by keyboard;
//   - `uploader-with-images`: the drop zone and three thumbnails (spec §12.2 ORD-2026-0148 file names; none has a file,
//     so each is a chip-less placeholder, the first with its outlined number 23). The first is the cover (the orange
//     "Cover" tag and ring). It runs at rest, with the pointer on the second thumbnail's remove button (the thumb's
//     grip and actions appear, the button turns `--danger`), with that button focused by keyboard (owner ruling D-05:
//     the grip and actions appear on focus within the thumb), and in the touch pass (D-05: on a device without hover
//     the grip and actions are always visible).
import type { Scenario, ScenarioNode, ScenarioProps, ScenarioState } from '../types';

function node(component: string, props: ScenarioProps): ScenarioNode {
  return { kind: 'node', component, props };
}

/** The second thumbnail's remove button: hovered and focused in the state rows. */
export const SECOND_THUMB_REMOVE = 'li:nth-child(2) button[aria-label^="Remove"]';

/** Three ORD-2026-0148 images without files; the first is the cover. */
export const UPLOADER_IMAGES: readonly ScenarioProps[] = [
  { id: 'img-0148-1', name: 'front-mockup.png', number: '23' },
  { id: 'img-0148-2', name: 'back-mockup.png' },
  { id: 'img-0148-3', name: 'shorts.png' },
];

function mediaCase(
  id: string,
  props: ScenarioProps,
  states: readonly ScenarioState[],
  target: string,
  touch: boolean,
): Scenario {
  return {
    id,
    group: 'media',
    node: node('ImageUploader', props),
    themes: ['light', 'dark'],
    responsive: false,
    states,
    parity: true,
    handlers: ['onChange', 'onFiles'],
    target,
    ...(touch ? { passes: ['touch'] } : {}),
  };
}

export const scenarios: readonly Scenario[] = [
  mediaCase('uploader-empty', {}, ['rest', 'focus-visible'], 'button', false),
  mediaCase(
    'uploader-with-images',
    { defaultImages: UPLOADER_IMAGES },
    ['rest', 'hover', 'focus-visible'],
    SECOND_THUMB_REMOVE,
    true,
  ),
];
