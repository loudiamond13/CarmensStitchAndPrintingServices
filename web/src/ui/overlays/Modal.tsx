// Modal (App. D.3 "Overlays", CSPS-UI-SPEC.md §6.5; the PRD Dialog and, as `variant="slideover"`, the Drawer),
// converted to utilities (D-33) with the App. D.3 props and markup: the scrim (`.csp-overlay`), the dialog panel, the
// head with the title, an optional description and the "Close" icon button, the body and an optional footer. The looks
// are in overlays.recipe.ts. `inline` drops the fixed scrim so the dialog can sit in an Overlay region, as the mockups
// do (`<Overlay><Modal inline … /></Overlay>`).
//
// WEB-02 required fix (research Pitfall 9): App. D.3's Modal was not yet a working dialog. Here
// - focus moves into the dialog on open (the first field, else the first focusable element, else the dialog itself),
//   Tab and Shift+Tab are trapped through useFocusTrap on the dialog's own ref (no wrapper element), and focus returns
//   to the trigger on close;
// - Esc and a mousedown on the scrim close it, except while `loading`; the scrim listener is attached through a ref and
//   an effect (Pitfall 7), and in an Overlay region the region is the scrim; with dialogs stacked, Esc closes only the
//   one on top (UI-WR-01);
// - body scroll is locked with the `overflow-hidden` class while it is open (useBodyScrollLock).
// It renders where it is placed, inside the page root, never in a portal.
import { useEffect, useEffectEvent, useId, useRef, type ReactNode, type RefObject } from 'react';
import { Icon } from '@/ui/brand';
import { iconButtonClasses } from '@/ui/feedback';
import {
  modalBodyClasses,
  modalClasses,
  modalDescriptionClasses,
  modalFootClasses,
  modalHeadClasses,
  modalTitleClasses,
  overlayClasses,
  type ModalVariant,
} from './overlays.recipe';
import { useBodyScrollLock } from './useBodyScrollLock';
import { isTopFocusTrap, useFocusTrap } from './useFocusTrap';

export interface ModalProps {
  open?: boolean;
  title: string;
  description?: ReactNode;
  // SPEC-DEVIATION: exactOptionalPropertyTypes (TS2375). ConfirmDialog passes its optional onCancel straight through.
  /** Shows the "Close" button and lets Esc and the scrim close the dialog. */
  onClose?: (() => void) | undefined;
  footer?: ReactNode;
  variant?: ModalVariant;
  /** Render without the fixed scrim (inside an Overlay region, as in the mockups). */
  inline?: boolean;
  // SPEC-DEVIATION: WEB-02 / UI-SPEC Interaction Contract. A save or delete is in flight: Esc, the scrim and the Close
  // button do nothing until it settles, so the dialog cannot vanish under a pending request.
  loading?: boolean;
  // SPEC-DEVIATION: WEB-02 / A11Y-02. The element to focus on open when it is not the first field (ConfirmDialog's
  // Cancel). Pass a stable ref to an element inside the dialog.
  initialFocus?: RefObject<HTMLElement | null> | undefined;
  children?: ReactNode;
}

export function Modal({ open = true, ...props }: ModalProps) {
  return open ? <OpenModal {...props} /> : null;
}

function OpenModal({
  title,
  description,
  onClose,
  footer,
  variant = 'center',
  inline = false,
  loading = false,
  initialFocus,
  children,
}: Omit<ModalProps, 'open'>) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const hasDescription = Boolean(description);

  useFocusTrap(dialogRef, { initialFocus });
  useBodyScrollLock();

  const close = () => {
    if (!loading) {
      onClose?.();
    }
  };
  const requestClose = useEffectEvent(close);

  useEffect(() => {
    const overlay = overlayRef.current;
    if (overlay === null) {
      return undefined;
    }
    // In an Overlay region the inline overlay is only as tall as the dialog, so the region is the scrim around it.
    const region = overlay.parentElement;
    const scrims = inline && region?.dataset.ui === 's-overlay' ? [overlay, region] : [overlay];
    const onMouseDown = (event: MouseEvent) => {
      if (scrims.some((scrim) => scrim === event.target)) {
        requestClose();
      }
    };
    // UI-WR-01: only the dialog on top (the newest focus trap) answers Esc, and it marks the key as handled, so one Esc
    // never closes a dialog together with the dialog or drawer it was opened from.
    const dialog = dialogRef.current;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented && isTopFocusTrap(dialog)) {
        event.preventDefault();
        requestClose();
      }
    };
    for (const scrim of scrims) {
      scrim.addEventListener('mousedown', onMouseDown);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => {
      for (const scrim of scrims) {
        scrim.removeEventListener('mousedown', onMouseDown);
      }
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [inline]);

  return (
    <div ref={overlayRef} className={overlayClasses({ variant, inline })}>
      {/* SPEC-DEVIATION: WEB-02 / A11Y-02. Named by its heading (aria-labelledby) and described by the description,
          instead of App. D.3's aria-label copy of the title; tabIndex -1 lets the trap focus the dialog when nothing
          inside can take focus. Attributes only; no visual change. */}
      <div
        ref={dialogRef}
        className={modalClasses({ variant, inline })}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={hasDescription ? descriptionId : undefined}
        tabIndex={-1}
      >
        <header className={modalHeadClasses}>
          <div>
            <h2 id={titleId} className={modalTitleClasses}>
              {title}
            </h2>
            {hasDescription && (
              <p id={descriptionId} className={modalDescriptionClasses}>
                {description}
              </p>
            )}
          </div>
          {onClose !== undefined && (
            <button type="button" className={iconButtonClasses} onClick={close} aria-label="Close">
              <Icon name="x" size={20} />
            </button>
          )}
        </header>
        <div className={modalBodyClasses}>{children}</div>
        {Boolean(footer) && <footer className={modalFootClasses}>{footer}</footer>}
      </div>
    </div>
  );
}
