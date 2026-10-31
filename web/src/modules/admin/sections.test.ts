import { describe, expect, it } from 'vitest';
import { AUDIT_NAV_ITEM, SETTINGS_NAV_ITEM } from '@/components/navigation';
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

  it('finds the Settings item for /admin/settings, so the shell marks it current and no tab is', () => {
    expect(adminNavItemForPath('/admin/settings')).toBe(SETTINGS_NAV_ITEM);
    expect(adminNavItemForPath('/admin/settings/')?.id).toBe('settings');
  });

  it('finds the Company Expenses item for /admin/expenses/deleted, so the sidebar and tab bar keep it current (UI-SPEC routes)', () => {
    expect(adminNavItemForPath('/admin/expenses')?.id).toBe('expenses');
    expect(adminNavItemForPath('/admin/expenses/deleted')?.id).toBe('expenses');
    expect(adminNavItemForPath('/admin/expenses/deleted/')?.id).toBe('expenses');
    expect(adminNavItemForPath('/admin/expenses/other')).toBeUndefined();
  });

  it('finds the Orders item for /admin/orders/deleted, so the sidebar and tab bar keep it current (plan 08-20)', () => {
    expect(adminNavItemForPath('/admin/orders/deleted')?.id).toBe('orders');
    expect(adminNavItemForPath('/admin/orders/deleted/')?.id).toBe('orders');
  });

  it('returns undefined for a path that is no section', () => {
    expect(adminNavItemForPath('/admin/nowhere')).toBeUndefined();
    expect(adminNavItemForPath('/dev/components')).toBeUndefined();
  });
});
