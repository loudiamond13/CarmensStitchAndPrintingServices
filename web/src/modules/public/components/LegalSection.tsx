// SPEC-GAP: LegalSection (UI-SPEC L1 item 2; LEGAL-05, D-10): one section of a legal text, with `aria-labelledby` its h2 and each
// block kind of legalContent.ts. Text renders as React text only, never raw HTML (T-12-16); an external link always opens in a new
// tab with rel="noopener noreferrer" and the hidden suffix (T-12-17). Deep imports only (PERF-01).
import { UiLink } from '@/components/actions/UiLink';
import { srOnlyClasses } from '@/components/layout/layout.recipe';
import type { LegalBlock, LegalInline, LegalSectionData } from '../legalContent';
import { LEGAL_COPY } from '../legalCopy';
import { LegalFacts } from './LegalFacts';
import {
  blocksClasses,
  bodyClasses,
  descriptionClasses,
  inlineLinkClasses,
  labelClasses,
  listClasses,
  sectionClasses,
  sectionHeadingClasses,
  termListClasses,
} from './legal.recipe';

/** The id of a section's h2, the name of the section. */
export function sectionHeadingId(id: string): string {
  return `${id}-heading`;
}

function Inline({ part }: { part: LegalInline }) {
  if (typeof part === 'string') {
    return part;
  }
  if (part.external === true) {
    return (
      <UiLink to={part.href} className={inlineLinkClasses} target="_blank" rel="noopener noreferrer">
        {part.text}
        <span className={srOnlyClasses}>{LEGAL_COPY.externalSuffix}</span>
      </UiLink>
    );
  }
  return (
    <UiLink to={part.href} className={inlineLinkClasses}>
      {part.text}
    </UiLink>
  );
}

function Parts({ parts }: { parts: readonly LegalInline[] }) {
  return parts.map((part, index) => (
    <Inline key={`${String(index)}-${typeof part === 'string' ? part : part.href}`} part={part} />
  ));
}

function Block({ block }: { block: LegalBlock }) {
  switch (block.kind) {
    case 'p':
      return (
        <p className={bodyClasses}>
          <Parts parts={block.parts} />
        </p>
      );
    case 'ul':
      return (
        <ul className={listClasses}>
          {block.items.map((parts, index) => (
            <li key={`${String(index)}-${typeof parts[0] === 'string' ? parts[0] : ''}`}>
              <Parts parts={parts} />
            </li>
          ))}
        </ul>
      );
    case 'dl':
      return (
        <dl className={termListClasses}>
          {block.items.map((item) => (
            <div key={item.term}>
              <dt className={labelClasses}>{item.term}</dt>
              <dd className={descriptionClasses}>
                <Parts parts={item.parts} />
              </dd>
            </div>
          ))}
        </dl>
      );
    case 'h3':
      return <h3 className={labelClasses}>{block.text}</h3>;
    case 'facts':
      return <LegalFacts show={block.show} />;
  }
}

export interface LegalSectionProps {
  section: LegalSectionData;
}

export function LegalSection({ section }: LegalSectionProps) {
  const headingId = sectionHeadingId(section.id);
  return (
    <section id={section.id} aria-labelledby={headingId} className={sectionClasses}>
      <h2 id={headingId} className={sectionHeadingClasses}>
        {section.heading}
      </h2>
      <div className={blocksClasses}>
        {section.blocks.map((block, index) => (
          <Block key={`${String(index)}-${block.kind}`} block={block} />
        ))}
      </div>
    </section>
  );
}
