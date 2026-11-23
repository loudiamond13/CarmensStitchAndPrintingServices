// Photo files for the quote form tests (INQ-02): a real PNG signature, so the picker reads the type from the first bytes.
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** A small PNG-looking file. Two sizes give two different files, so a test can tell them apart. */
export function pngFile(name: string, size = 64): File {
  const bytes = new Uint8Array(size);
  bytes.set(PNG_SIGNATURE);
  bytes[PNG_SIGNATURE.length] = size % 251;
  return new File([bytes], name, { type: 'image/png' });
}
