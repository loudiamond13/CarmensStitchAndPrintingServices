export function usePresence(open: boolean) {
  return { mounted: open, state: open ? 'open' : 'closed', ref: (_node: HTMLElement | null) => undefined } as const;
}
