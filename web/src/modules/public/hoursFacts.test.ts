// weekHours (PUB-02, D-21): the API's day number, which the generated type allows as text, read as 1 to 7.
import { describe, expect, it } from 'vitest';
import { demoSite } from '@/test/publicFixtures';
import { weekHours } from './hoursFacts';

describe('weekHours', () => {
  it('keeps the seven days with their times', () => {
    const week = weekHours(demoSite);

    expect(week).toHaveLength(7);
    expect(week[0]).toEqual({ day: 1, opensAt: '09:00', closesAt: '18:00' });
    expect(week[6]).toEqual({ day: 7, opensAt: null, closesAt: null });
  });

  it('reads a day number sent as text', () => {
    const week = weekHours({ ...demoSite, hours: [{ day: '3', opensAt: '10:00', closesAt: '16:00' }] });

    expect(week).toEqual([{ day: 3, opensAt: '10:00', closesAt: '16:00' }]);
  });

  it('drops a day that is not 1 to 7', () => {
    const week = weekHours({
      ...demoSite,
      hours: [
        { day: 0, opensAt: '09:00', closesAt: '18:00' },
        { day: 8, opensAt: '09:00', closesAt: '18:00' },
        { day: 'x', opensAt: '09:00', closesAt: '18:00' },
        { day: 1.5, opensAt: '09:00', closesAt: '18:00' },
      ],
    });

    expect(week).toEqual([]);
  });
});
