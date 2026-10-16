import { describe, expect, it } from 'vitest';
import type { SessionListItem } from '@/modules/admin/services/sessionsService';
import { deviceLabel, lastActiveText, orderDevices, rowSignOutName, signedInText } from './deviceSummary';

// The S7 row strings (UI-SPEC "S7 Signed-in devices"; D-43).

const NOW = Date.parse('2026-10-12T10:00:00Z');

function item(overrides: Partial<SessionListItem> = {}): SessionListItem {
  return {
    id: '3f1d6b0e-0a52-4b0e-9a55-6a3f7d8c1b11',
    device: 'Chrome on Android',
    signedInAt: '2026-10-12T07:42:00Z',
    lastActiveAt: '2026-10-12T09:59:30Z',
    persistent: false,
    current: false,
    ...overrides,
  };
}

function minutesAgo(minutes: number): string {
  return new Date(NOW - minutes * 60_000).toISOString();
}

describe('lastActiveText', () => {
  it('reads "Active now" for the current device, whatever its time', () => {
    expect(lastActiveText(item({ current: true, lastActiveAt: minutesAgo(500) }), NOW)).toBe('Active now');
  });

  it('reads "Just now" for 30 seconds', () => {
    expect(lastActiveText(item({ lastActiveAt: new Date(NOW - 30_000).toISOString() }), NOW)).toBe('Just now');
  });

  it('reads "Just now" for a time slightly ahead of the clock', () => {
    expect(lastActiveText(item({ lastActiveAt: new Date(NOW + 5_000).toISOString() }), NOW)).toBe('Just now');
  });

  it('switches to minutes at exactly one minute', () => {
    expect(lastActiveText(item({ lastActiveAt: minutesAgo(1) }), NOW)).toBe('1 min ago');
  });

  it('reads "59 min ago" for 59 minutes', () => {
    expect(lastActiveText(item({ lastActiveAt: minutesAgo(59) }), NOW)).toBe('59 min ago');
  });

  it('switches to hours at exactly one hour', () => {
    expect(lastActiveText(item({ lastActiveAt: minutesAgo(60) }), NOW)).toBe('1 hr ago');
  });

  it('reads "23 hr ago" for 23 hours', () => {
    expect(lastActiveText(item({ lastActiveAt: minutesAgo(23 * 60) }), NOW)).toBe('23 hr ago');
  });

  it('reads the absolute business time at 24 hours and later', () => {
    expect(lastActiveText(item({ lastActiveAt: minutesAgo(24 * 60) }), NOW)).toBe('Oct 11, 2026, 6:00 PM');
    expect(lastActiveText(item({ lastActiveAt: minutesAgo(25 * 60) }), NOW)).toBe('Oct 11, 2026, 5:00 PM');
  });

  it('gives null for an unreadable time, so the cell shows the empty-value icon', () => {
    expect(lastActiveText(item({ lastActiveAt: 'soon' }), NOW)).toBeNull();
  });
});

describe('signedInText', () => {
  it('is the absolute business time', () => {
    expect(signedInText(item())).toBe('Oct 12, 2026, 3:42 PM');
  });

  it('gives null for an unreadable time', () => {
    expect(signedInText(item({ signedInAt: '' }))).toBeNull();
  });
});

describe('deviceLabel', () => {
  it('is the server label', () => {
    expect(deviceLabel(item())).toBe('Chrome on Android');
  });

  it('reads "Unknown browser" for a blank label', () => {
    expect(deviceLabel(item({ device: '   ' }))).toBe('Unknown browser');
  });
});

describe('rowSignOutName', () => {
  it('names the device and its sign-in time', () => {
    expect(rowSignOutName(item())).toBe('Sign out Chrome on Android, signed in Oct 12, 2026, 3:42 PM');
  });

  it('names only the device when the sign-in time is unreadable', () => {
    expect(rowSignOutName(item({ signedInAt: 'x' }))).toBe('Sign out Chrome on Android');
  });

  it('uses the unknown-browser label for a blank device', () => {
    expect(rowSignOutName(item({ device: '' }))).toBe('Sign out Unknown browser, signed in Oct 12, 2026, 3:42 PM');
  });
});

describe('orderDevices', () => {
  it('puts this device first, then the others by last active, newest first', () => {
    const old = item({ id: 'old', lastActiveAt: minutesAgo(300) });
    const recent = item({ id: 'recent', lastActiveAt: minutesAgo(2) });
    const me = item({ id: 'me', current: true, lastActiveAt: minutesAgo(900) });

    expect(orderDevices([old, recent, me]).map((entry) => entry.id)).toEqual(['me', 'recent', 'old']);
  });

  it('keeps the server order for equal times and sorts an unreadable time last', () => {
    const a = item({ id: 'a', lastActiveAt: minutesAgo(10) });
    const b = item({ id: 'b', lastActiveAt: minutesAgo(10) });
    const broken = item({ id: 'broken', lastActiveAt: 'soon' });

    expect(orderDevices([broken, a, b]).map((entry) => entry.id)).toEqual(['a', 'b', 'broken']);
  });

  it('returns a new array and leaves its input alone', () => {
    const input = [item({ id: 'x' }), item({ id: 'y', current: true })];

    const ordered = orderDevices(input);

    expect(ordered).not.toBe(input);
    expect(input.map((entry) => entry.id)).toEqual(['x', 'y']);
  });
});
