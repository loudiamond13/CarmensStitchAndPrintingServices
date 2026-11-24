// Scenario wrapper (plan 13-23) for the dev pages and the Manager showcase: it ships in the showcase chunks, never in a public
// chunk, so it holds made-up data only. The real Get a Quote form in one of its eight states, for the owner's review. It hands
// the form a demo service, fills the fields with made-up values and presses Send the way a visitor would, so each state is the
// form's own drawing. Nothing is sent: the ticket, the create and the photo uploads are answered here, and the shop facts and
// product lines are made-up ones from a PublicDataScope, so the app's shared stores are left alone. The form loads as its own
// piece, as on the Contact page.
import { lazy, Suspense, useEffect, useRef, useState, type RefObject } from 'react';
import { HttpError } from '@/core/api/errors';
import { fixedAnswer, PublicDataScope } from '@/lib/public-data/publicResource';
import { productLinesResource } from '@/modules/public/hooks/useProductLinesQuery';
import { siteResource } from '@/modules/public/hooks/useSiteQuery';
import type { PublicProductLine, PublicProductLines } from '@/modules/public/services/contentService';
import type { QuoteService } from '@/modules/public/services/quoteService';
import { PARITY_SITE } from './PublicShell';

export type QuoteFormDemoState =
  | 'empty'
  | 'field-errors'
  | 'photos-refused'
  | 'sending'
  | 'sent'
  | 'sent-photos-missing'
  | 'rate-limited'
  | 'send-failed';

const DemoForm = lazy(async () => ({
  default: (await import('@/modules/public/components/QuoteForm')).QuoteForm,
}));

/** A made-up product line with only what the form reads filled in. */
function line(key: string, title: string, number: string): PublicProductLine {
  return {
    key,
    title,
    number,
    shortName: title,
    cardText: '',
    description: '',
    customize: { collar: '', cut: '', fabric: '', logos: '', names: '' },
    hasGalleryItems: false,
    minimumQuantity: null,
    photos: { main: null, back: null, fabric: null },
    placeholderArt: '',
    startsAtPrice: null,
  };
}

const DEMO_LINES: PublicProductLines = {
  lines: [line('basketball-jerseys', 'Basketball Jerseys', '01'), line('polo-shirts', 'Polo Shirts', '02')],
};

/** The shop facts and product lines the form shows, with no request and no write to the shared stores. */
const DEMO_DATA = new Map([
  fixedAnswer(productLinesResource, DEMO_LINES),
  // An in-page Messenger link: the demo never points at an outside account.
  fixedAnswer(siteResource, { ...PARITY_SITE, messengerUrl: '#' }),
]);

/** A one-pixel PNG, so the picked photos have a real preview. */
const PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGM4Xe4LAAOgAZDBbDQ6AAAAAElFTkSuQmCC';

function png(name: string): File {
  const bytes = Uint8Array.from(atob(PNG_BASE64), (char) => char.charCodeAt(0));
  return new File([bytes], name, { type: 'image/png' });
}

function pdf(name: string): File {
  return new File([new TextEncoder().encode('%PDF-1.7\n')], name, { type: 'application/pdf' });
}

/** What a visitor types: a made-up name, a 0917 555 01xx number and an example.test address. */
const VALID = {
  customerName: 'Juan Dela Cruz',
  teamName: 'Brgy. San Roque Ballers',
  contactNumber: '0917 555 0123',
  email: 'juan.delacruz@example.test',
  product: 'line:basketball-jerseys',
  quantity: '21-50',
  message: 'Home and away jerseys for 18 players, before the league opens.',
};

/** A value for every field a visitor can get wrong: no name, a long team, a landline-like number, a half email, a long message. */
const INVALID = {
  customerName: '',
  teamName: 'Sample Team '.repeat(9),
  contactNumber: '12345',
  email: 'juan@',
  product: '',
  quantity: '',
  message: 'Sample message for the demo. '.repeat(70),
};

type Values = typeof VALID;

interface DemoSteps {
  values?: Values;
  photos?: () => File[];
  submit?: boolean;
}

const STEPS: Readonly<Record<QuoteFormDemoState, DemoSteps>> = {
  empty: {},
  'field-errors': { values: INVALID, submit: true },
  'photos-refused': { photos: () => [png('team-logo.png'), png('jersey-sketch.png'), pdf('price-list.pdf')] },
  sending: { values: VALID, photos: () => [png('team-logo.png')], submit: true },
  sent: { values: VALID, submit: true },
  'sent-photos-missing': {
    values: VALID,
    photos: () => [png('team-logo.png'), png('front-sketch.png'), png('back-sketch.png')],
    submit: true,
  },
  'rate-limited': { values: VALID, submit: true },
  'send-failed': { values: VALID, submit: true },
};

function problemError(status: number, title: string): HttpError {
  return new HttpError({
    kind: 'http',
    status,
    problem: {
      type: undefined,
      title,
      status,
      detail: undefined,
      instance: undefined,
      traceId: undefined,
      code: undefined,
      errors: {},
    },
  });
}

/** The demo answers of one state: the ticket at once, then the create and the uploads as that state needs. */
function demoService(state: QuoteFormDemoState): QuoteService {
  return {
    getTicket: () =>
      Promise.resolve({
        ticket: 'demo-ticket',
        minimumSeconds: 0,
        photoRules: { maxPhotos: 5, maxBytes: 10_485_760, maxPixels: 25_000_000 },
      }),
    create: (body) => {
      if (state === 'sending') return new Promise(() => undefined);
      if (state === 'rate-limited') return Promise.reject(problemError(429, 'Too many requests.'));
      if (state === 'send-failed') return Promise.reject(problemError(500, 'Something went wrong.'));
      const photoSlots = (body.photos ?? []).map((fileName, slot) => ({ slot, fileName }));
      return Promise.resolve({ id: '0b0f6c1e-0000-4000-8000-000000000123', photoSlots });
    },
    // The first photo arrives; the others are refused, so they show as missing.
    uploadPhoto: (_id, slot) =>
      slot === 0 ? Promise.resolve(undefined) : Promise.reject(problemError(422, 'The photo was refused.')),
  };
}

/** Sets a field's value the way typing or choosing does, so React's onChange sees it. */
function setValue(field: Element | RadioNodeList | null, value: string): void {
  if (field instanceof HTMLSelectElement) {
    field.value = value;
    field.dispatchEvent(new Event('change', { bubbles: true }));
  } else if (field instanceof HTMLTextAreaElement) {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set?.call(field, value);
    field.dispatchEvent(new Event('input', { bubbles: true }));
  } else if (field instanceof HTMLInputElement) {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(field, value);
    field.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

/** Picks files through the form's file input, as the file chooser does. */
function pickFiles(input: HTMLInputElement, files: File[]): void {
  if (typeof DataTransfer === 'function') {
    const transfer = new DataTransfer();
    for (const file of files) transfer.items.add(file);
    input.files = transfer.files;
  } else {
    // The test DOM has no DataTransfer; a plain list reads the same.
    Object.defineProperty(input, 'files', { configurable: true, value: files });
  }
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

/** Plays the state's steps once the form is on the page. */
function PlaySteps({ state, frame }: { state: QuoteFormDemoState; frame: RefObject<HTMLDivElement | null> }) {
  const done = useRef(false);
  useEffect(() => {
    // Once only: a development re-run of the effect must not type or send twice.
    if (done.current) return;
    done.current = true;
    const form = frame.current?.querySelector('form');
    if (form === null || form === undefined) return;
    const { values, photos, submit = false } = STEPS[state];
    if (values !== undefined) {
      for (const [name, value] of Object.entries(values)) {
        setValue(form.elements.namedItem(name), value);
      }
    }
    const input = form.querySelector<HTMLInputElement>('input[type="file"]');
    if (photos !== undefined && input !== null) {
      pickFiles(input, photos());
    }
    if (submit) {
      form.requestSubmit();
    }
  }, [state, frame]);
  return null;
}

export interface QuoteFormDemoProps {
  state?: QuoteFormDemoState;
}

export function QuoteFormDemo({ state = 'empty' }: QuoteFormDemoProps) {
  const frame = useRef<HTMLDivElement>(null);
  const [service] = useState(() => demoService(state));
  return (
    <PublicDataScope value={DEMO_DATA}>
      <div ref={frame}>
        <Suspense fallback={null}>
          <DemoForm service={service} />
          <PlaySteps state={state} frame={frame} />
        </Suspense>
      </div>
    </PublicDataScope>
  );
}
