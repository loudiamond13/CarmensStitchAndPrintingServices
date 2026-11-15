// Opening hours calls (WEB-04). Types come from the generated OpenAPI types (D-16). Both are the Manager's.
import { apiClient, type HttpClient } from '@/core/api/apiClient';
import type { components } from '@/types/api.generated';

export type OpeningHours = components['schemas']['OpeningHoursDto'];
export type DayHours = components['schemas']['DayHoursDto'];
/** The weekly hours form as the API takes it: all seven days and the version the form was opened with. */
export type UpdateOpeningHoursRequest = components['schemas']['UpdateOpeningHoursRequest'];

export interface OpeningHoursService {
  /** `GET /api/v1/opening-hours` (Manager only): the seven days, Monday first, the version a save sends back and who last changed them. */
  get(signal?: AbortSignal): Promise<OpeningHours>;
  /**
   * `PUT /api/v1/opening-hours` (Manager only): saves the weekly hours and answers them as saved. The body carries the version the form
   * was opened with: 409 `edit.stale` when it is not the stored one. A form save is never retried, so it carries no Idempotency-Key
   * (SEC-07). 400 lists the field errors, keyed `days[i].opensAt` and `days[i].closesAt`, 403 for an Admin.
   */
  update(body: UpdateOpeningHoursRequest, signal?: AbortSignal): Promise<OpeningHours>;
}

export function createOpeningHoursService(client: HttpClient): OpeningHoursService {
  return {
    get: (signal) => client.get<OpeningHours>('/opening-hours', { signal }),
    update: (body, signal) => client.put<OpeningHours>('/opening-hours', body, { signal }),
  };
}

export const openingHoursService: OpeningHoursService = createOpeningHoursService(apiClient);
