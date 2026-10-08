// WEB-09 / T-02-45: every submission key is a random RFC 4122 version 4 UUID from the Web Crypto API, never from
// Math.random, including on a plain-HTTP LAN address where crypto.randomUUID does not exist (research Pitfall 15).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { newIdempotencyKey } from './idempotencyKey';

const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const realCrypto = globalThis.crypto;

/** A crypto object without randomUUID, as in an insecure (plain-HTTP) context. */
function insecureCrypto() {
  const getRandomValues = vi.fn(<T extends ArrayBufferView>(array: T): T => {
    const bytes = realCrypto.getRandomValues(new Uint8Array(array.byteLength));
    new Uint8Array(array.buffer, array.byteOffset, array.byteLength).set(bytes);
    return array;
  });
  return { getRandomValues };
}

describe('newIdempotencyKey', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns the v4 UUID from crypto.randomUUID in a secure context, without calling Math.random', () => {
    const randomUUID = vi.fn(() => realCrypto.randomUUID());
    const getRandomValues = vi.fn();
    vi.stubGlobal('crypto', { randomUUID, getRandomValues });
    const random = vi.spyOn(Math, 'random');

    const key = newIdempotencyKey();

    expect(key).toMatch(uuidV4);
    expect(randomUUID).toHaveBeenCalledTimes(1);
    expect(key).toBe(randomUUID.mock.results[0]?.value);
    expect(getRandomValues).not.toHaveBeenCalled();
    expect(random).not.toHaveBeenCalled();
  });

  it('returns a different key every call', () => {
    const keys = new Set(Array.from({ length: 50 }, () => newIdempotencyKey()));

    expect(keys.size).toBe(50);
    for (const key of keys) {
      expect(key).toMatch(uuidV4);
    }
  });

  it('builds a v4 UUID from crypto.getRandomValues when randomUUID is missing, without calling Math.random', () => {
    const fallback = insecureCrypto();
    vi.stubGlobal('crypto', fallback);
    const random = vi.spyOn(Math, 'random');

    const first = newIdempotencyKey();
    const second = newIdempotencyKey();

    expect(first).toMatch(uuidV4);
    expect(second).toMatch(uuidV4);
    expect(second).not.toBe(first);
    expect(fallback.getRandomValues).toHaveBeenCalledTimes(2);
    expect(random).not.toHaveBeenCalled();
  });

  it.each([
    [0xff, 'ffffffff-ffff-4fff-bfff-ffffffffffff'],
    [0x00, '00000000-0000-4000-8000-000000000000'],
  ])('sets the version and variant bits on the fallback path when every random byte is %i', (fill, expected) => {
    vi.stubGlobal('crypto', {
      getRandomValues: <T extends ArrayBufferView>(array: T): T => {
        new Uint8Array(array.buffer, array.byteOffset, array.byteLength).fill(fill);
        return array;
      },
    });

    expect(newIdempotencyKey()).toBe(expected);
  });
});
