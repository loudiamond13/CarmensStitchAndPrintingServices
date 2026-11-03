// Media group (the Phase 9 photo list, UI-SPEC P1; plans 02-25 and 09-08). Every scenario here has group 'media' and
// `parity: false`: the photo list changed by owner rulings D-25 (one compact list), D-13 and D-14 (always-visible 44 px
// controls), so the frozen App. D.3 uploader is no longer the look to match. The cases still run axe and the CSP
// listener, and the touch pass shows the Take Photo and Choose Photos buttons.
//   - `uploader-empty`: a live card with no photos: the add area alone, with the hint ending "0/5";
//   - `uploader-with-images`: three saved photos, the first the cover (the "Cover" tag and ring), every control visible;
//   - `uploader-readonly`: the same three photos on a completed order: row 1 only, no add area;
//   - `uploader-draft`: a new order's draft photo, a file waiting to upload and a file that failed;
//   - `uploader-limit`: five photos, so the limit note stands in for the add area.
// Parity is false for every case: owner rulings D-25, D-13 and D-14 (Phase 9) replaced the look the frozen App. D.3 uploader draws.
// The demo photos are small local `data:` pictures, never a call to the picture host.
import type { Scenario, ScenarioNode, ScenarioProps, ScenarioState } from '../types';

function node(component: string, props: ScenarioProps): ScenarioNode {
  return { kind: 'node', component, props };
}

const DEMO_RED =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEUlEQVR4nGPYEOCBFTEMLQkAJKhSAUHBvDUAAAAASUVORK5CYII=';
const DEMO_BLUE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEUlEQVR4nGPwyJiGFTEMLQkAxRlRgSuom8AAAAAASUVORK5CYII=';
const DEMO_GREEN =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEUlEQVR4nGOIaEnAihiGlgQA3IpPAbE2JjcAAAAASUVORK5CYII=';

/** The names the order screens give the callbacks; each gets a no-op in the showcase. */
export const UPLOADER_HANDLERS: readonly string[] = [
  'onAddFiles',
  'onMove',
  'onMakeCover',
  'onEditDescription',
  'onDelete',
  'onRemove',
  'onRetry',
  'onOpen',
];

/** Three ORD-2026-0148 photos with their default descriptions; the first is the cover. */
export const UPLOADER_PHOTOS: readonly ScenarioProps[] = [
  {
    id: 'photo-0148-1',
    state: 'saved',
    description: 'Order ORD-2026-0148 photo 1',
    thumb: { src: DEMO_RED, width: 88, height: 88 },
  },
  {
    id: 'photo-0148-2',
    state: 'saved',
    description: 'Back mockup, red and black',
    thumb: { src: DEMO_BLUE, width: 88, height: 88 },
  },
  {
    id: 'photo-0148-3',
    state: 'saved',
    description: 'Order ORD-2026-0148 photo 3',
    thumb: { src: DEMO_GREEN, width: 88, height: 88 },
  },
];

/** Five saved photos: the three above and two more. */
const UPLOADER_FIVE: readonly ScenarioProps[] = [
  ...UPLOADER_PHOTOS,
  {
    id: 'photo-0148-4',
    state: 'saved',
    description: 'Order ORD-2026-0148 photo 4',
    thumb: { src: DEMO_RED, width: 88, height: 88 },
  },
  {
    id: 'photo-0148-5',
    state: 'saved',
    description: 'Order ORD-2026-0148 photo 5',
    thumb: { src: DEMO_BLUE, width: 88, height: 88 },
  },
];

/** A draft photo, a file waiting its turn and a file that failed (it can be tried again). */
const UPLOADER_DRAFT: readonly ScenarioProps[] = [
  {
    id: 'draft-1',
    state: 'draft',
    description: 'New order photo 1',
    fileName: 'front-mockup.jpg',
    preview: DEMO_GREEN,
  },
  {
    id: 'waiting-1',
    state: 'waiting',
    description: '',
    fileName: 'back-mockup.heic',
    previewUnavailable: true,
  },
  {
    id: 'failed-1',
    state: 'failed',
    description: '',
    fileName: 'shorts-reference-photo-with-a-long-name.png',
    preview: DEMO_RED,
    failure: { reason: 'Check your connection, then try again.', retryable: true },
  },
];

function mediaCase(id: string, props: ScenarioProps, states: readonly ScenarioState[], touch: boolean): Scenario {
  return {
    id,
    group: 'media',
    node: node('ImageUploader', { max: 5, maxMegabytes: 10, mode: 'live', busy: false, ...props }),
    themes: ['light', 'dark'],
    responsive: false,
    states,
    parity: false,
    handlers: UPLOADER_HANDLERS,
    target: 'button',
    ...(touch ? { passes: ['touch'] } : {}),
  };
}

export const scenarios: readonly Scenario[] = [
  mediaCase('uploader-empty', { photos: [] }, ['rest', 'focus-visible'], false),
  mediaCase('uploader-with-images', { photos: UPLOADER_PHOTOS }, ['rest', 'hover', 'focus-visible'], true),
  mediaCase('uploader-readonly', { photos: UPLOADER_PHOTOS, mode: 'readonly' }, ['rest', 'focus-visible'], false),
  mediaCase('uploader-draft', { photos: UPLOADER_DRAFT, mode: 'draft' }, ['rest', 'focus-visible'], true),
  mediaCase(
    'uploader-limit',
    {
      photos: UPLOADER_FIVE,
      limitNote: 'This order has 5 photos, the most it can have. Delete one to add another.',
    },
    ['rest'],
    false,
  ),
];
