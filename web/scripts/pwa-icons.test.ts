// @vitest-environment node
// PERF-06 (plan 14-02), UI-SPEC W1 "Icons": the staff app manifest lists only icons that exist, each PNG has the size its
// name says, and the maskable and Apple icons have no transparent pixel (SPEC-DEVIATION ICON-BLEED). No package: a small
// PNG reader on node:zlib stands in for an image library.
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';

const PUBLIC = fileURLToPath(new URL('../public/', import.meta.url));
const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const COLOR_RGB = 2;
const COLOR_RGBA = 6;

interface Png {
  width: number;
  height: number;
  colorType: number;
  /** True when no pixel has an alpha below 255. */
  opaque: boolean;
}

interface ManifestIcon {
  src: string;
  sizes: string;
  type: string;
  purpose: string;
}

interface Manifest {
  [key: string]: unknown;
  icons: ManifestIcon[];
}

function loadManifest(): Manifest {
  return JSON.parse(readFileSync(`${PUBLIC}manifest.webmanifest`, 'utf8')) as Manifest;
}

/** The Paeth predictor of the PNG filter type 4. */
function paeth(left: number, up: number, upLeft: number): number {
  const estimate = left + up - upLeft;
  const distanceLeft = Math.abs(estimate - left);
  const distanceUp = Math.abs(estimate - up);
  const distanceUpLeft = Math.abs(estimate - upLeft);
  if (distanceLeft <= distanceUp && distanceLeft <= distanceUpLeft) {
    return left;
  }
  return distanceUp <= distanceUpLeft ? up : upLeft;
}

/** Reads an 8-bit RGB or RGBA PNG: its size, and whether every pixel is opaque. */
function readPng(file: string): Png {
  const bytes = readFileSync(file);
  expect(bytes.subarray(0, SIGNATURE.length).equals(SIGNATURE)).toBe(true);

  let width = 0;
  let height = 0;
  let colorType = -1;
  const data: Buffer[] = [];
  let offset = SIGNATURE.length;
  while (offset < bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString('ascii', offset + 4, offset + 8);
    const body = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      expect(body[8]).toBe(8);
      colorType = body[9] ?? -1;
      expect(body[12]).toBe(0);
    } else if (type === 'IDAT') {
      data.push(body);
    }
    offset += 12 + length;
  }

  if (colorType === COLOR_RGB) {
    return { width, height, colorType, opaque: true };
  }
  expect(colorType).toBe(COLOR_RGBA);

  const bpp = 4;
  const stride = width * bpp;
  const raw = inflateSync(Buffer.concat(data));
  expect(raw.length).toBe(height * (stride + 1));
  const rows = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)] ?? 0;
    for (let x = 0; x < stride; x += 1) {
      const value = raw[y * (stride + 1) + 1 + x] ?? 0;
      const left = x >= bpp ? (rows[y * stride + x - bpp] ?? 0) : 0;
      const up = y > 0 ? (rows[(y - 1) * stride + x] ?? 0) : 0;
      const upLeft = y > 0 && x >= bpp ? (rows[(y - 1) * stride + x - bpp] ?? 0) : 0;
      const predictor = [0, left, up, (left + up) >> 1, paeth(left, up, upLeft)][filter];
      if (predictor === undefined) {
        throw new Error(`Unknown PNG row filter ${String(filter)}.`);
      }
      rows[y * stride + x] = (value + predictor) & 0xff;
    }
  }

  let opaque = true;
  for (let index = 3; index < rows.length; index += bpp) {
    if (rows[index] !== 255) {
      opaque = false;
      break;
    }
  }
  return { width, height, colorType, opaque };
}

const png = (name: string): Png => readPng(`${PUBLIC}pwa/${name}`);

describe('PWA manifest', () => {
  it('holds the staff app values (14 D-33, D-42)', () => {
    const manifest = loadManifest();

    expect(manifest).toMatchObject({
      id: '/admin/',
      name: 'CSPS Admin',
      short_name: 'CSPS Admin',
      start_url: '/admin/login',
      scope: '/admin',
      display: 'standalone',
      lang: 'en',
      dir: 'ltr',
      theme_color: '#572e2b',
      background_color: '#f6dfd1',
    });
    expect(manifest.short_name).toHaveLength(10);
    expect(manifest.description).toBe(
      "The staff portal of Carmen's Stitch & Printing Services: orders, payments, expenses and quote requests.",
    );
    for (const absent of ['orientation', 'shortcuts', 'screenshots', 'share_target']) {
      expect(manifest).not.toHaveProperty(absent);
    }
  });

  it('lists only icons that exist under web/public', () => {
    const { icons } = loadManifest();

    expect(icons.length).toBeGreaterThan(0);
    for (const icon of icons) {
      expect(icon.src.startsWith('/')).toBe(true);
      expect(existsSync(`${PUBLIC}${icon.src.slice(1)}`), icon.src).toBe(true);
    }
  });

  it('lists each PNG with the size it really has', () => {
    const { icons } = loadManifest();
    const pngs = icons.filter((icon) => icon.type === 'image/png');

    expect(pngs.map((icon) => `${icon.src} ${icon.sizes} ${icon.purpose}`)).toEqual([
      '/pwa/icon-192.png 192x192 any',
      '/pwa/icon-512.png 512x512 any',
      '/pwa/icon-maskable-512.png 512x512 maskable',
    ]);
    for (const icon of pngs) {
      const { width, height } = readPng(`${PUBLIC}${icon.src.slice(1)}`);
      expect(`${String(width)}x${String(height)}`, icon.src).toBe(icon.sizes);
    }
  });

  it('has no long dash in any string (OR-4)', () => {
    expect(readFileSync(`${PUBLIC}manifest.webmanifest`, 'utf8')).not.toMatch(/[‒-―−]/u);
  });
});

describe('PWA icons', () => {
  it('draws the two "any" icons at 192 and 512', () => {
    expect(png('icon-192.png')).toMatchObject({ width: 192, height: 192 });
    expect(png('icon-512.png')).toMatchObject({ width: 512, height: 512 });
  });

  it('fills every pixel of the maskable icon (512 x 512)', () => {
    expect(png('icon-maskable-512.png')).toMatchObject({ width: 512, height: 512, opaque: true });
  });

  it('fills every pixel of the Apple icon (180 x 180)', () => {
    expect(png('apple-touch-icon-180.png')).toMatchObject({ width: 180, height: 180, opaque: true });
  });

  it('keeps the transparent corners of the two "any" icons', () => {
    expect(png('icon-192.png').opaque).toBe(false);
    expect(png('icon-512.png').opaque).toBe(false);
  });
});
