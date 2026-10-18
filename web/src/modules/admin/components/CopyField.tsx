// SPEC-GAP: CopyField (UI-SPEC "CopyField behaviour", D-14; plan 05-22). A read-only Field holding a password that is shown
// once, with a secondary "Copy Password" button beside it (below it on phones). Copy Password calls
// navigator.clipboard.writeText. On success the label reads "Copied" with a check for 2 seconds and a visually hidden
// polite status says "Password copied.". On failure, or with no clipboard at all, the field's text is selected and the
// message under it tells the person to copy it themselves. The value lives in the field only: it is never logged, stored,
// put in a URL or repeated as text.
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/actions';
import { Icon } from '@/components/brand';
import { Field, messageClasses } from '@/components/forms';
import { srOnlyClasses } from '@/components/layout/layout.recipe';
import {
  usersCopyFieldClasses,
  usersCopyRowClasses,
  usersCopyStackClasses,
} from '@/modules/admin/components/users.recipe';
import { USERS_COPY } from '@/modules/admin/usersCopy';

const COPY = USERS_COPY.copyField;

/** How long "Copied" stays on the button. */
const COPIED_MS = 2000;

export interface CopyFieldProps {
  /** The field's label, for example "Temporary password for Ana". */
  label: string;
  /** The text shown and copied. */
  value: string;
  /** Moves focus into the read-only field when it appears. */
  focusOnMount?: boolean;
}

export function CopyField({ label, value, focusOnMount = false }: CopyFieldProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  const input = (): HTMLInputElement | null => rowRef.current?.querySelector('input') ?? null;

  useEffect(() => {
    if (focusOnMount) {
      input()?.focus();
    }
  }, [focusOnMount]);

  // "Copied" goes back to "Copy Password" after 2 seconds, or when the field goes away.
  useEffect(() => {
    if (!copied) {
      return undefined;
    }
    const timer = window.setTimeout(() => {
      setCopied(false);
    }, COPIED_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [copied]);

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(value);
      setFailed(false);
      setCopied(true);
    } catch {
      setCopied(false);
      setFailed(true);
      input()?.select();
    }
  };

  return (
    <div className={usersCopyStackClasses}>
      <div ref={rowRef} className={usersCopyRowClasses}>
        <Field
          className={usersCopyFieldClasses}
          label={label}
          value={value}
          type="text"
          readOnly
          autoComplete="off"
          spellCheck={false}
          onChange={() => undefined}
        />
        <Button
          variant="secondary"
          icon={copied ? 'check' : 'copy'}
          onClick={() => {
            void copy();
          }}
        >
          {copied ? COPY.copied : COPY.copy}
        </Button>
      </div>
      {failed && (
        <p className={messageClasses({ error: true })}>
          <Icon name="triangle-alert" size={14} />
          {COPY.failed}
        </p>
      )}
      <span role="status" className={srOnlyClasses}>
        {copied ? COPY.announce : ''}
      </span>
    </div>
  );
}
