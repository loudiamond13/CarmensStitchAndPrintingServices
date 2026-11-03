// Media group (the Phase 9 photo list, UI-SPEC P1; plans 02-25 and 09-08). Every scenario here has group 'media' and
// `parity: false`: the photo list changed by owner rulings D-25 (one compact list), D-13 and D-14 (always-visible 44 px
// controls), so the frozen App. D.3 uploader is no longer the look to match. The cases still run axe and the CSP
// listener, and the touch pass shows the Take Photo and Choose Photos buttons.
//   - `uploader-empty`: a live card with no photos: the add area alone, with the hint ending "0/5";
//   - `uploader-with-images`: three saved photos, the first the cover (the "Cover" tag and ring), every control visible.
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
];
