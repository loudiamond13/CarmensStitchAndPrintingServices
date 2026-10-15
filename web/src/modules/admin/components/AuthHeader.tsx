// SPEC-GAP: AuthHeader (UI-SPEC "AuthHeader"; plan 04-26). The auth card's header block from App. E.5: the eyebrow, the
// h1 and the muted subline, 8px apart. The h1 can take focus by script (`tabIndex={-1}`, no outline) for the screens that
// move focus to it.
import clsx from 'clsx';
import type { ReactNode, Ref } from 'react';
import { loginEyebrowClasses, loginTitleClasses, pageSublineClasses } from '@/components/layout/layout.recipe';
import { AUTH_COPY } from '@/modules/admin/authCopy';

export interface AuthHeaderProps {
  title: string;
  subline: ReactNode;
  headingRef?: Ref<HTMLHeadingElement>;
}

export function AuthHeader({ title, subline, headingRef }: AuthHeaderProps) {
  return (
    <div className="flex flex-col gap-2">
      <span className={loginEyebrowClasses}>{AUTH_COPY.eyebrow}</span>
      <h1 ref={headingRef} tabIndex={-1} className={loginTitleClasses}>
        {title}
      </h1>
      <p className={clsx(pageSublineClasses, 'wrap-anywhere')}>{subline}</p>
    </div>
  );
}
