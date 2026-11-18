import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { downloadCsv } from './downloadCsv';

// The CSV download (ANL-08, D-25; Pitfall 3): a Blob that starts with the UTF-8 byte-order mark, saved through a temporary object URL and
// an a[download] click, then the URL is let go.

const CSV = 'Date,Unique visitors,Visits,Page views\r\n2026-11-15,1,2,3\r\n';

let blobs: Blob[];
let revoked: string[];
let clicked: HTMLAnchorElement[];

beforeEach(() => {
  blobs = [];
  revoked = [];
  clicked = [];
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: (blob: Blob) => {
      blobs.push(blob);
      return 'blob:csps/1';
    },
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: (url: string) => {
      revoked.push(url);
    },
  });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    clicked.push(this);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function firstBytes(blob: Blob | undefined, count: number): Promise<string> {
  if (blob === undefined) return '';
  const bytes = [...new Uint8Array(await blob.arrayBuffer())].slice(0, count);
  return bytes.map((byte) => byte.toString(16).padStart(2, '0')).join(' ');
}

describe('downloadCsv', () => {
  it('builds a text/csv Blob whose first bytes are the UTF-8 byte-order mark EF BB BF', async () => {
    downloadCsv(CSV, 'visitor-stats-2026-11-15-to-2026-11-15.csv');

    expect(await firstBytes(blobs[0], 4)).toBe('ef bb bf 44');
    expect(blobs[0]?.type).toBe('text/csv;charset=utf-8');
  });

  it('keeps one byte-order mark when the text already starts with one', async () => {
    downloadCsv(`\uFEFF${CSV}`, 'a.csv');

    expect(await firstBytes(blobs[0], 4)).toBe('ef bb bf 44');
  });

  it('saves the Blob under the file name through one link click, then revokes the object URL', () => {
    vi.useFakeTimers();
    try {
      downloadCsv(CSV, 'visitor-stats-2026-10-17-to-2026-11-15.csv');

      expect(clicked).toHaveLength(1);
      expect(clicked[0]?.download).toBe('visitor-stats-2026-10-17-to-2026-11-15.csv');
      expect(clicked[0]?.href).toBe('blob:csps/1');
      // Kept for a moment so the browser can start the download (Safari fails on an early revoke).
      expect(revoked).toHaveLength(0);
      vi.advanceTimersByTime(10_000);
      expect(revoked.join(' ')).toBe('blob:csps/1');
    } finally {
      vi.useRealTimers();
    }
  });

  it('leaves no link in the page', () => {
    downloadCsv(CSV, 'a.csv');

    expect(document.querySelectorAll('a[download]')).toHaveLength(0);
  });
});
