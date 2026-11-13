// useLightboxHistory (UI-SPEC G2 "History", T-11-80): opening the Gallery lightbox adds one history entry with the same URL and a
// router state that holds only an open flag, so the phone's Back button closes the lightbox instead of leaving the page. Closing
// by Esc, Close or a tap goes back that one entry, so none is left behind. The state carries nothing else, and nothing read from
// the history reaches a request.
//
// The lightbox is open while `open` is true. Back or Forward to an entry without the flag calls `onClose`; an entry that still has
// the flag while the lightbox is closed (a reload, Forward, a filter change) has it taken off with a replace.
import { useEffect, useEffectEvent, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router';

const FLAG = 'csps-gallery-lightbox';

function hasFlag(state: unknown): boolean {
  return typeof state === 'object' && state !== null && FLAG in state && state[FLAG] === true;
}

export interface LightboxHistory {
  /** Closes the lightbox: back one entry when the page made one, else straight away. */
  close: () => void;
  /** Goes to another page in place of the lightbox's entry, so Back from there lands on the Gallery with the lightbox closed. */
  leaveTo: (path: string) => void;
}

export function useLightboxHistory(open: boolean, onClose: () => void): LightboxHistory {
  const navigate = useNavigate();
  const location = useLocation();
  const flagged = hasFlag(location.state);
  // True once the entry with the flag has arrived, so its later loss means Back, not "not there yet".
  const arrived = useRef(false);
  const handleClose = useEffectEvent(onClose);
  const isFlagged = useEffectEvent(() => flagged);
  // The same URL with the flag on a new entry, or with the flag taken off the current one.
  const pushEntry = useEffectEvent(() => {
    void navigate(
      { pathname: location.pathname, search: location.search, hash: location.hash },
      { replace: false, state: { [FLAG]: true } },
    );
  });
  const clearFlag = useEffectEvent(() => {
    void navigate(
      { pathname: location.pathname, search: location.search, hash: location.hash },
      { replace: true, state: null },
    );
  });

  // Opening pushes the entry.
  useEffect(() => {
    if (open && !isFlagged()) {
      arrived.current = false;
      pushEntry();
    }
  }, [open]);

  // The entry arrived, or it went away under an open lightbox (Back), or it lingers under a closed one.
  useEffect(() => {
    if (open && flagged) {
      arrived.current = true;
    } else if (open && arrived.current) {
      arrived.current = false;
      handleClose();
    } else if (!open) {
      arrived.current = false;
      if (flagged) {
        clearFlag();
      }
    }
  }, [open, flagged]);

  return {
    close: () => {
      if (open && flagged) {
        void navigate(-1);
      } else {
        onClose();
      }
    },
    leaveTo: (path: string) => {
      void navigate(path, { replace: flagged });
    },
  };
}
