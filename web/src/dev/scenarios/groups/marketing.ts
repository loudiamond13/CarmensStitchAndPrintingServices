// Marketing group (App. D.3 "Marketing": CategoryCard, ProcessSteps and TestimonialCard, CSPS-UI-SPEC.md §6.7, §8.1;
// plan 02-25). Every scenario here has group 'marketing'. The public site is Blush only (D-14), so every case runs in
// the light theme only, at 390 and 1440 px:
//   - `category-card`: the spec §8.1 "Basketball Jerseys" card (no photo yet, so a chip-less placeholder with the
//     outlined 23), at rest and hovered (the card lifts, the number grows, the arrow nudges up and right);
//   - `process-steps`: the spec §8.1 "How ordering works" four steps, also at 320 and 820 px (`responsive`), because
//     the list is 1 column, 2 from 640 px and 4 from 1024 px;
//   - `testimonial-card`: the spec §8.1 Juan Dela Cruz testimonial with five stars, and `testimonial-card-rating-4`
//     (four filled stars and one empty, `--line-strong`), so both star looks are compared.
import type { Scenario, ScenarioNode, ScenarioProps, ScenarioState } from '../types';

function node(component: string, props: ScenarioProps): ScenarioNode {
  return { kind: 'node', component, props };
}

/** Spec §8.1 Categories, the first card. */
export const CATEGORY_BASKETBALL: ScenarioProps = {
  title: 'Basketball Jerseys',
  description: 'Full sublimation tops and shorts, any colorway, names and numbers included.',
  number: '23',
};

/** Spec §8.1 "How ordering works". */
export const ORDERING_STEPS: readonly ScenarioProps[] = [
  {
    title: 'Send your design',
    icon: 'message-circle',
    description: 'Message us your logo, colors or just an idea. Sketches welcome.',
  },
  {
    title: 'Approve the mockup',
    icon: 'palette',
    description: 'We send a digital mockup. Revise until every detail is right.',
  },
  {
    title: 'Downpayment & production',
    icon: 'printer',
    description: 'Pay the downpayment via GCash, Maya or bank transfer and we start printing.',
  },
  {
    title: 'Pickup or delivery',
    icon: 'truck',
    description: 'Settle the balance, then pick up in-store or get it delivered.',
  },
];

/** Spec §8.1 Testimonials, the first quote. */
export const TESTIMONIAL_JUAN: ScenarioProps = {
  quote:
    'Seventeen pieces, names and numbers perfect, and ready before our liga opener. Colors are sharper than our old supplier.',
  name: 'Juan Dela Cruz',
  team: 'Captain, Brgy. San Roque Ballers',
};

/** A public (Blush only, D-14) marketing case at 390 and 1440 px; `responsive` adds 320 and 820 px. */
function marketingCase(
  id: string,
  node: ScenarioNode,
  states: readonly ScenarioState[] = ['rest'],
  responsive = false,
): Scenario {
  return { id, group: 'marketing', node, themes: ['light'], responsive, states, parity: true };
}

export const scenarios: readonly Scenario[] = [
  marketingCase('category-card', node('CategoryCard', CATEGORY_BASKETBALL), ['rest', 'hover']),
  marketingCase('process-steps', node('ProcessSteps', { steps: ORDERING_STEPS }), ['rest'], true),
  marketingCase('testimonial-card', node('TestimonialCard', TESTIMONIAL_JUAN)),
  marketingCase(
    'testimonial-card-rating-4',
    node('TestimonialCard', {
      quote:
        "Sizes ran true for the whole team and the names didn't fade after a full season of washing. Sulit na sulit.",
      name: 'Kristine Mendoza',
      team: 'Coach, Lady Spikers QC',
      rating: 4,
    }),
  ),
];
