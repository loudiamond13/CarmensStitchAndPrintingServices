// The saved Show Map tap (D-65): one guarded storage key, true only for the exact value 'show'.
import { describe, expect, it, vi } from 'vitest';
import { MAPS_KEY, readMapsShown, saveMapsShown, subscribeMapsShown, type MapsStorage } from './mapChoice';

function fakeStorage(initial: string | null = null): MapsStorage & { value: string | null } {
  const store = {
    value: initial,
    getItem: () => store.value,
    setItem: (_key: string, value: string) => {
      store.value = value;
    },
  };
  return store;
}

const throwing = (): never => {
  throw new Error('storage blocked');
};

describe('readMapsShown', () => {
  it('uses the key csps-maps', () => {
    expect(MAPS_KEY).toBe('csps-maps');
  });

  it('is false when nothing is saved', () => {
    expect(readMapsShown(() => fakeStorage())).toBe(false);
  });

  it('is true only for the exact value show', () => {
    expect(readMapsShown(() => fakeStorage('show'))).toBe(true);
    expect(readMapsShown(() => fakeStorage('yes'))).toBe(false);
    expect(readMapsShown(() => fakeStorage('SHOW'))).toBe(false);
    expect(readMapsShown(() => fakeStorage(' show'))).toBe(false);
    expect(readMapsShown(() => fakeStorage(''))).toBe(false);
  });

  it('is false when reading the storage throws', () => {
    expect(readMapsShown(() => ({ getItem: throwing, setItem: throwing }))).toBe(false);
  });

  it('is false when reaching the storage itself throws', () => {
    expect(readMapsShown(throwing)).toBe(false);
  });
});

describe('saveMapsShown', () => {
  it('writes show under csps-maps', () => {
    const setItem = vi.fn();
    saveMapsShown(() => ({ getItem: () => null, setItem }));

    expect(setItem).toHaveBeenCalledWith('csps-maps', 'show');
  });

  it('does not throw and still calls the listeners when the write is refused', () => {
    const onChange = vi.fn();
    const unsubscribe = subscribeMapsShown(onChange);

    expect(() => {
      saveMapsShown(() => ({ getItem: () => null, setItem: throwing }));
    }).not.toThrow();
    expect(onChange).toHaveBeenCalledTimes(1);

    unsubscribe();
  });

  it('does not throw when reaching the storage itself throws', () => {
    expect(() => {
      saveMapsShown(throwing);
    }).not.toThrow();
  });
});

describe('subscribeMapsShown', () => {
  it('calls the listener after a save in this page', () => {
    const onChange = vi.fn();
    const unsubscribe = subscribeMapsShown(onChange);

    saveMapsShown(() => fakeStorage());

    expect(onChange).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('calls the listener when another tab changes storage (the window storage event)', () => {
    const onChange = vi.fn();
    const unsubscribe = subscribeMapsShown(onChange);

    window.dispatchEvent(new StorageEvent('storage', { key: MAPS_KEY, newValue: null }));

    expect(onChange).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('stops both the in-page call and the storage event call after unsubscribe', () => {
    const onChange = vi.fn();
    const unsubscribe = subscribeMapsShown(onChange);
    unsubscribe();

    saveMapsShown(() => fakeStorage());
    window.dispatchEvent(new StorageEvent('storage', { key: MAPS_KEY }));

    expect(onChange).not.toHaveBeenCalled();
  });
});
