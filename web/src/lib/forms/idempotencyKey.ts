// The Idempotency-Key factory for form submissions (WEB-09, SEC-06). useSubmission creates one key per submission;
// the HTTP client only carries it.

function hex(byte: number): string {
  return byte.toString(16).padStart(2, '0');
}

/**
 * Returns a random RFC 4122 version 4 UUID. crypto.randomUUID exists only in secure contexts (localhost and HTTPS);
 * over a plain-HTTP LAN address the key is built from crypto.getRandomValues instead (research Pitfall 15). It never
 * uses a non-cryptographic source such as Math.random: a predictable key could be guessed (T-02-45).
 */
export function newIdempotencyKey(): string {
  const { crypto } = globalThis;
  // Typed as always present, but missing at run time outside a secure context.
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const digits = Array.from(bytes, (byte, index) => {
    if (index === 6) {
      return hex((byte & 0x0f) | 0x40); // version 4
    }
    if (index === 8) {
      return hex((byte & 0x3f) | 0x80); // variant 10xx
    }
    return hex(byte);
  }).join('');
  return `${digits.slice(0, 8)}-${digits.slice(8, 12)}-${digits.slice(12, 16)}-${digits.slice(16, 20)}-${digits.slice(20)}`;
}
