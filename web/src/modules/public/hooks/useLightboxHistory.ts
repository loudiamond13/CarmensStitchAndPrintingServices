// Stub for the RED step: no history entry is made.
export interface LightboxHistory {
  close: () => void;
  leaveTo: (path: string) => void;
}

export function useLightboxHistory(open: boolean, onClose: () => void): LightboxHistory {
  return {
    close: () => {
      if (open) {
        onClose();
      }
    },
    leaveTo: () => {
      onClose();
    },
  };
}
