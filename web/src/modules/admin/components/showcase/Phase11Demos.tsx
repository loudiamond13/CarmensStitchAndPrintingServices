// The Phase 11 demos of the Component Showcase (UI-SPEC Component Inventory "Component Showcase additions"; plan 11-37), in the "Site content and
// public website" section: PhotoSlot in its five states, PhoneNumbersField with one row, four rows and the main number moved, and the Public website
// card of an order in its five states, all on made-up data. The pieces are the real parts fed plain values: nothing here reads or writes a
// record. The slot's states come from PhotoSlotView, the same drawing PhotoSlot uses, fed each state in turn; a press on a static case does nothing.
import type { MouseEvent, ReactNode } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { MediaPlaceholder } from '@/components/brand';
import { PhoneNumbersField } from '@/modules/admin/components/PhoneNumbersField';
import { PhotoSlotView, type PhotoSlotViewProps, type SlotPhoto } from '@/modules/admin/components/PhotoSlot';
import { PublicWebsiteCard } from '@/modules/admin/components/PublicWebsiteCard';
import { DemoCase } from '@/modules/admin/components/showcase/Phase5Demos';
import { stillClasses, staffStackClasses } from '@/modules/admin/components/showcase/showcase.recipe';
import { SHOWCASE_COPY } from '@/modules/admin/components/showcase/showcaseCopy';
import type { BusinessInfoInput, PhoneRowInput } from '@/modules/admin/siteContentSchemas';
import type { OrderDetailResponse } from '@/modules/admin/services/ordersService';

const DEMO = SHOWCASE_COPY.siteContent;

const noop = (): void => undefined;

/** A press on a static case does nothing: no window opens and nothing is chosen or sent. */
function swallow(event: MouseEvent): void {
  event.preventDefault();
  event.stopPropagation();
}

/** Wraps a static case so that nothing in it can be pressed through to the app (it adds no box of its own). */
function Still({ children }: { children: ReactNode }) {
  return (
    <div className={stillClasses} onClickCapture={swallow}>
      {children}
    </div>
  );
}

// PhotoSlot (S1 card 6).

/** A flat-colour one-pixel PNG written out as a `data:` address, so nothing is ever requested. The frame gives it its shape. */
const DEMO_PHOTO: SlotPhoto = {
  src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGM4Xe4LAAOgAZDBbDQ6AAAAAElFTkSuQmCC',
  srcSet: '',
  width: 800,
  height: 1000,
};

const SLOT_BASE: PhotoSlotViewProps = {
  label: DEMO.photoLabel,
  noun: 'Photo',
  ratio: '4/5',
  photo: null,
  alt: DEMO.photoAlt,
  placeholder: <MediaPlaceholder label={DEMO.photoLabel} ratio="4 / 5" />,
  hint: DEMO.photoHint,
  pressed: null,
  removing: false,
  saved: false,
  refused: [],
  removable: true,
  locked: false,
  onChoose: noop,
  onTake: noop,
  onAskRemove: noop,
};

function SlotDemo(overrides: Partial<PhotoSlotViewProps>) {
  return (
    <Still>
      <PhotoSlotView {...SLOT_BASE} {...overrides} />
    </Still>
  );
}

// PhoneNumbersField (S1 card 3).

const GLOBE: PhoneRowInput = { number: '0917 123 4567', label: 'Globe', isMain: true };
const LANDLINE: PhoneRowInput = { number: '02 8123 4567', label: '', isMain: false };
const SMART: PhoneRowInput = { number: '0918 123 4567', label: 'Smart', isMain: false };
const SUN: PhoneRowInput = { number: '0922 123 4567', label: '', isMain: false };

/** The Business Info values the field sits in; only the phone list is drawn. */
function businessInfoWith(phones: PhoneRowInput[]): BusinessInfoInput {
  return {
    businessName: 'Demo Shop',
    tagline: 'A demo shop for the showcase.',
    aboutText: '',
    turnaroundLine: '',
    street: '12 Sample St., Poblacion',
    townOrCity: 'Sample City',
    province: 'Sample Province',
    postalCode: '1000',
    directionsUrl: '',
    mapEmbedUrl: '',
    messengerUrl: '',
    facebookUrl: '',
    instagramUrl: '',
    tiktokUrl: '',
    contactEmail: '',
    phones,
  };
}

/**
 * The field inside a form of its own, so adding, removing and moving the main number works on made-up numbers and saves nothing. The HTML
 * form also keeps each case's "Main number" radios in a group of their own: radios with one name and no form are one group for the whole
 * page, and choosing one would clear the others in every case.
 */
function PhonesDemo({ phones }: { phones: PhoneRowInput[] }) {
  const form = useForm<BusinessInfoInput>({ defaultValues: businessInfoWith(phones) });
  return (
    <FormProvider {...form}>
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
        }}
      >
        <PhoneNumbersField />
      </form>
    </FormProvider>
  );
}

// The Public website card (O1).

/** The order the card reads: only its team and its public website block matter to the card; the rest is empty. */
function demoOrder(
  publicWebsite: Partial<OrderDetailResponse['publicWebsite']>,
  status = 'production',
): OrderDetailResponse {
  return {
    id: '0b0f6c1e-0000-4000-8000-000000000148',
    number: 'ORD-2026-0148',
    customerName: 'Juan Dela Cruz',
    teamName: 'Brgy. San Roque Ballers',
    contactNumber: null,
    email: null,
    address: null,
    orderDate: '2026-09-28',
    dueDate: '2026-10-14',
    notes: null,
    status,
    statusChangedAt: '2026-10-01T02:00:00Z',
    statusHistory: [],
    items: [],
    discounts: [],
    payments: [],
    expenses: [],
    refunds: [],
    images: [],
    totals: {
      subtotal: 0,
      discount: 0,
      total: 0,
      paid: 0,
      refunded: 0,
      balance: 0,
      customerCredit: 0,
      expenses: 0,
      profit: 0,
      fullyPaid: false,
    },
    publicWebsite: {
      customerConsent: false,
      consentRecordedAtUtc: null,
      consentRecordedByName: null,
      shownOnWebsite: false,
      shownSinceUtc: null,
      productLineId: null,
      productLineTitle: null,
      autoProductLineId: null,
      publicName: null,
      pieces: 48,
      hasPhoto: true,
      canShow: status !== 'cancelled',
      ...publicWebsite,
    },
    recordedBy: null,
    recordedAt: '2026-09-28T02:00:00Z',
    lastChangedBy: null,
    lastChangedAt: null,
    today: '2026-10-08',
    version: 'AAAAAAAAB9E=',
  };
}

const OK_RECORDED = {
  customerConsent: true,
  consentRecordedAtUtc: '2026-10-06T02:00:00Z',
  consentRecordedByName: 'Liza Mercado',
  productLineId: '8c1f4a20-0000-4000-8000-000000000001',
  productLineTitle: 'Basketball Jerseys',
} as const;

const SHOWN = {
  ...OK_RECORDED,
  shownOnWebsite: true,
  shownSinceUtc: '2026-10-07T02:00:00Z',
} as const;

/** The Edit button is drawn but opens nothing: the window belongs to the real order page. */
function CardDemo({ order }: { order: OrderDetailResponse }) {
  return (
    <Still>
      <PublicWebsiteCard order={order} />
    </Still>
  );
}

/** Every Phase 11 demo, one case under another. */
export function Phase11Demos() {
  return (
    <div className={staffStackClasses}>
      <DemoCase id="site-content-photo-slot-empty">
        <SlotDemo />
      </DemoCase>
      <DemoCase id="site-content-photo-slot-uploading">
        <SlotDemo pressed="choose" />
      </DemoCase>
      <DemoCase id="site-content-photo-slot-saved">
        <SlotDemo photo={DEMO_PHOTO} saved />
      </DemoCase>
      <DemoCase id="site-content-photo-slot-error">
        <SlotDemo refused={[{ fileName: DEMO.refusedFile, reason: DEMO.refusedReason }]} />
      </DemoCase>
      <DemoCase id="site-content-photo-slot-with-photo">
        <SlotDemo photo={DEMO_PHOTO} />
      </DemoCase>
      <DemoCase id="site-content-phone-numbers-one">
        <PhonesDemo phones={[GLOBE]} />
      </DemoCase>
      <DemoCase id="site-content-phone-numbers-four">
        <PhonesDemo phones={[GLOBE, LANDLINE, SMART, SUN]} />
      </DemoCase>
      <DemoCase id="site-content-phone-numbers-main-moved">
        <PhonesDemo
          phones={[
            { ...GLOBE, isMain: false },
            { ...LANDLINE, isMain: true },
          ]}
        />
      </DemoCase>
      <DemoCase id="public-website-card-no-ok">
        <CardDemo order={demoOrder({})} />
      </DemoCase>
      <DemoCase id="public-website-card-ok-not-shown">
        <CardDemo order={demoOrder(OK_RECORDED)} />
      </DemoCase>
      <DemoCase id="public-website-card-shown">
        <CardDemo order={demoOrder(SHOWN)} />
      </DemoCase>
      <DemoCase id="public-website-card-shown-no-photo">
        <CardDemo order={demoOrder({ ...SHOWN, hasPhoto: false })} />
      </DemoCase>
      <DemoCase id="public-website-card-cancelled">
        <CardDemo order={demoOrder({}, 'cancelled')} />
      </DemoCase>
    </div>
  );
}
