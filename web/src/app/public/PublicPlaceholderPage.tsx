// D-21 public placeholder page. Look: the App. E.2 page head (`section.s-pagehead.s-mesh` > `.s-wrap` with the E.2
// flex column and 20px gap > `.s-eyebrow`, `.s-h1`, `.s-lead`), transcribed to utilities from App. C, including its
// `@container pg` rules. `.s-pagehead .s-h1` (80px) outranks the tablet `.s-h1` rule (76px), so the head stays 80px
// down to the phone rule, where `.s-pagehead .s-h1` sets 52px. Copy: UI-SPEC Copywriting (SPEC-GAP, D-21).
export function PublicPlaceholderPage() {
  return (
    <section className="relative overflow-hidden bg-[image:radial-gradient(circle_at_1px_1px,color-mix(in_srgb,var(--ink)_9%,transparent)_1px,transparent_1.6px)] bg-size-[6px_6px] pt-16 pb-[calc(var(--space-12)+var(--cut-angle))] pg-phone:pt-8 pg-phone:pb-[calc(var(--space-8)+var(--cut-angle))]">
      <div className="mx-auto flex max-w-(--container-max) flex-col gap-[20px] px-6 pg-phone:px-4">
        <span className="inline-flex items-center gap-2 font-display text-[14px] leading-[1.15] font-bold tracking-[.16em] text-accent-ink uppercase before:h-[3px] before:w-[24px] before:[transform:skewX(-18deg)] before:bg-accent-line">
          Custom sublimation · Philippines
        </span>
        <h1 className="font-display text-[80px] leading-[.88] font-heavy tracking-[-.01em] uppercase italic pg-phone:text-[52px]">
          Site update <em className="text-accent-ink italic">in progress.</em>
        </h1>
        <p className="max-w-[560px] text-[18px] leading-[28px] text-ink-muted pg-phone:text-[16px] pg-phone:leading-[24px]">
          We&apos;re building our new website. To order now, message us on Messenger or call the shop. The details are
          below.
        </p>
      </div>
    </section>
  );
}
