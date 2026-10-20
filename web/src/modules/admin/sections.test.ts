import { describe, expect, it } from 'vitest';
import { AUDIT_NAV_ITEM } from '@/components/navigation';
import { adminNavItemForPath } from './sections';

// adminNavItemForPath (plan 02-31) names the section the shell marks current; the Audit Log joined it in plan 05-32 (OQ-2).

describe('adminNavItemForPath', () => {
  it('finds the five App. D.3 sections by path, one trailing slash allowed', () => {
    expect(adminNavItemForPath('/admin')?.id).toBe('dashboard');
    expect(adminNavItemForPath('/admin/orders/')?.id).toBe('orders');
    expect(adminNavItemForPath('/admin/users')?.id).toBe('users');
    expect(adminNavItemForPath('/admin/profile')?.id).toBe('profile');
  });

  it('finds the Audit Log item for /admin/audit-log, so the shell marks it current', () => {
    expect(adminNavItemForPath('/admin/audit-log')).toBe(AUDIT_NAV_ITEM);
    expect(adminNavItemForPath('/admin/audit-log/')?.id).toBe('audit');
  });

  it('returns undefined for a path that is no section', () => {
    expect(adminNavItemForPath('/admin/nowhere')).toBeUndefined();
    expect(adminNavItemForPath('/dev/components')).toBeUndefined();
  });
});
