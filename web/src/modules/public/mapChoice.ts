// The saved Show Map tap (D-65, amends D-55). One local storage key holds the value 'show' after the visitor taps Show Map
// once; it never expires, has no undo on the page and covers every Google map on the site. It stays in the browser and is
// never sent to the server. Every storage access is guarded, so blocked storage only means the tap is not remembered.

/** The one storage key. Only 'show' is ever written there. */
export const MAPS_KEY = 'csps-maps';

const SHOW = 'show';

/** The part of the Web Storage API the saved setting uses. */
export interface MapsStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** The browser's localStorage; reaching it can itself throw, so it is read inside the guards. */
function browserStorage(): MapsStorage {
  return window.localStorage;
}

const listeners = new Set<() => void>();

/** True only when exactly 'show' is saved; false for any other value and when the storage throws. */
export function readMapsShown(storage: () => MapsStorage = browserStorage): boolean {
  try {
    return storage().getItem(MAPS_KEY) === SHOW;
  } catch {
    return false;
  }
}

/** Saves 'show' and tells this page's listeners, even when the storage refuses the write. */
export function saveMapsShown(storage: () => MapsStorage = browserStorage): void {
  try {
    storage().setItem(MAPS_KEY, SHOW);
  } catch {
    // Blocked or full storage: the tap still shows the map for this view.
  }
  for (const listener of [...listeners]) listener();
}

/** Calls onChange after this page saves, and when another tab changes storage. Returns the unsubscribe. */
export function subscribeMapsShown(onChange: () => void): () => void {
  listeners.add(onChange);
  window.addEventListener('storage', onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener('storage', onChange);
  };
}
