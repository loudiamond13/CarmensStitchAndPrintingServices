// The staff lookup (CEXP-05, D-32; plan 06-12). Types come from the generated OpenAPI types. Both roles may call it: it
// lists only the people who can be named as the payer, an id and a name each, nothing else.
import { apiClient, type HttpClient } from '@/core/api/apiClient';
import type { components } from '@/types/api.generated';

export type StaffMember = components['schemas']['StaffMember'];

export interface StaffService {
  /** `GET /api/v1/staff`: the active Admins and Managers who can pay, sorted by first name, last name, then id. */
  list(signal?: AbortSignal): Promise<StaffMember[]>;
}

export function createStaffService(client: HttpClient): StaffService {
  return {
    list: (signal) => client.get<StaffMember[]>('/staff', { signal }),
  };
}

export const staffService: StaffService = createStaffService(apiClient);
