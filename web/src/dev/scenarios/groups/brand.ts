// Brand group (App. D.3 "Brand": Mark, Logo, the motifs and Icon; CSPS-UI-SPEC.md §4, §5, §2.6). Every scenario here has
// group 'brand'. Plan 02-18:
//   - the [C]SPS lockup in its three sizes (spec §4.2), the sidebar forms (no tagline, mark only), the wordmark and the
//     bare Mark, compared at rest at 390 and 1440 px (no width-dependent rules);
//   - the motifs (StitchDivider, SectionCut, MediaPlaceholder) at all four widths (`responsive`), because SectionCut
//     pads wider from 1024px and the placeholder's outlined number scales with its own width (46cqi);
//   - every one of the 56 spec icons, plus size, stroke and label variants, in one IconSet (a dev-only wrapper with no
//     look of its own, on both sides). Icon drawings are masked (D-32): the wrapper is what is compared.
// Every case runs in both themes, because the Espresso theme recolours the Mark and every token the motifs read.
import type { Scenario, ScenarioNode, ScenarioProps } from '../types';

/** A brand case compared at rest in both themes; `responsive` adds the 320 and 820 px widths. */
function brandCase(id: string, node: ScenarioNode, responsive = false): Scenario {
  return {
    id,
    group: 'brand',
    node,
    themes: ['light', 'dark'],
    responsive,
    states: ['rest'],
    parity: true,
  };
}

/** The 56 App. D.5 icon names, in the order of the ICONS map (src/components/brand/icons.ts), as plain data for both builds. */
const ICON_NAMES = [
  'plus',
  'x',
  'eye',
  'eye-off',
  'search',
  'trash-2',
  'pencil',
  'cloud-upload',
  'image',
  'grip-vertical',
  'chevron-down',
  'chevron-left',
  'chevron-right',
  'layout-dashboard',
  'clipboard-list',
  'receipt',
  'users',
  'user-round',
  'log-out',
  'menu',
  'phone',
  'message-circle',
  'mail',
  'map-pin',
  'clock',
  'check',
  'circle-check',
  'triangle-alert',
  'info',
  'layout-grid',
  'list',
  'filter',
  'calendar',
  'arrow-right',
  'arrow-up-right',
  'star',
  'shirt',
  'scissors',
  'palette',
  'zap',
  'truck',
  'wallet',
  'trending-up',
  'trending-down',
  'quote',
  'package',
  'ellipsis',
  'sun',
  'moon',
  'loader-circle',
  'lock',
  'panel-left-close',
  'panel-left-open',
  'shield-check',
  'ruler',
  'printer',
] as const;

function icon(props: ScenarioProps): ScenarioNode {
  return { kind: 'node', component: 'Icon', props };
}

function stitchDivider(props: ScenarioProps): ScenarioNode {
  return { kind: 'node', component: 'StitchDivider', props };
}

/** A SectionCut with one line of content, so its inner wrapper has a box. */
function sectionCut(props: ScenarioProps): ScenarioNode {
  return { kind: 'node', component: 'SectionCut', props: { children: 'Jerseys for every team.', ...props } };
}

function mediaPlaceholder(props: ScenarioProps): ScenarioNode {
  return { kind: 'node', component: 'MediaPlaceholder', props };
}

export const scenarios: readonly Scenario[] = [
  brandCase('logo-sm', { kind: 'node', component: 'Logo', props: { size: 'sm' } }),
  brandCase('logo-md', { kind: 'node', component: 'Logo', props: { size: 'md' } }),
  brandCase('logo-lg', { kind: 'node', component: 'Logo', props: { size: 'lg' } }),
  brandCase('logo-sm-no-tagline', { kind: 'node', component: 'Logo', props: { size: 'sm', tagline: false } }),
  brandCase('logo-mark-sm', { kind: 'node', component: 'Logo', props: { size: 'sm', variant: 'mark' } }),
  brandCase('logo-wordmark-md', { kind: 'node', component: 'Logo', props: { size: 'md', variant: 'wordmark' } }),
  brandCase('mark-48', { kind: 'node', component: 'Mark', props: { size: 48 } }),
  brandCase('stitch-divider', stitchDivider({}), true),
  brandCase('stitch-divider-label', stitchDivider({ label: 'How ordering works' }), true),
  brandCase('section-cut-both', sectionCut({}), true),
  brandCase('section-cut-top-accent', sectionCut({ bottom: false, tone: 'accent' }), true),
  brandCase('section-cut-bottom', sectionCut({ top: false }), true),
  brandCase('section-cut-mesh', sectionCut({ mesh: true }), true),
  brandCase('media-placeholder-4x3', mediaPlaceholder({}), true),
  brandCase(
    'media-placeholder-1x1-label',
    mediaPlaceholder({ ratio: '1 / 1', label: 'Team jersey', number: '23' }),
    true,
  ),
  brandCase('media-placeholder-16x9-number', mediaPlaceholder({ ratio: '16 / 9', number: 7 }), true),
  // The chip-less placeholder that tiles, thumbnails and the LazyImage fallback show (`label={false}`). App. D.3 has no
  // chip-less prop, only parent rules that hide the chip (App. B `.csp-thumb`, App. C `.s-tile`), so both sides render a
  // dev-only wrapper named MediaPlaceholderNoChip (src/dev/previews and web/visual/reference/fragments).
  brandCase(
    'media-placeholder-no-chip',
    { kind: 'node', component: 'MediaPlaceholderNoChip', props: { ratio: '4 / 3', number: '23' } },
    true,
  ),
  brandCase('icons-all', {
    kind: 'node',
    component: 'IconSet',
    props: {
      children: [
        ...ICON_NAMES.map((name) => icon({ name })),
        icon({ name: 'search', size: 16 }),
        icon({ name: 'search', size: 24 }),
        icon({ name: 'search', strokeWidth: 1.5 }),
        icon({ name: 'search', label: 'Search' }),
      ],
    },
  }),
];
