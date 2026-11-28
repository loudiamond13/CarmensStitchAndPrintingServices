// Keeps page fades to forward link clicks with motion allowed (PERF-07, 14 D-48). React Router replays a stored View Transition
// on Back and Forward, which a person did not ask for and which ignores a later reduced-motion setting, so the browser call
// is replaced where the router is created: Back, Forward and reduced motion run the page update at once, and a real
// transition that is skipped no longer raises an unhandled `ready` rejection.
interface GuardedRouter {
  subscribe: (listener: (state: { historyAction: string }) => void) => unknown;
}

type Start = Document['startViewTransition'];
type Guarded = Start & { original?: Start };

export function guardViewTransitions(router: GuardedRouter, doc: Document = document, win: Window = window): void {
  if (!('startViewTransition' in doc)) {
    return;
  }
  // Development only: a hot reload runs this again, so it starts from the browser's own call that the earlier guard kept.
  const earlier = import.meta.env.DEV ? (doc.startViewTransition as Guarded).original : undefined;
  const start = earlier ?? doc.startViewTransition.bind(doc);
  let action = 'PUSH';
  router.subscribe((state) => {
    action = state.historyAction;
  });
  const guarded: Guarded = (update?: ViewTransitionUpdateCallback) => {
    if (action === 'POP' || win.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const done = Promise.resolve().then(async () => {
        await update?.();
      });
      return {
        finished: done,
        ready: done,
        updateCallbackDone: done,
        skipTransition: () => undefined,
      } as ViewTransition;
    }
    const transition = start(update);
    transition.ready.catch(() => undefined);
    return transition;
  };
  if (import.meta.env.DEV) {
    guarded.original = start;
  }
  doc.startViewTransition = guarded;
}
