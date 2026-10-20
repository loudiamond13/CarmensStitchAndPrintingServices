// Audit log calls (AUDIT-02, D-26..D-29; plans 05-29, 05-41, 05-33). Types come from the generated OpenAPI types (D-16). Both
// calls are Manager only: an Admin, or a Manager who lost the role mid-session, gets 403. A null filter is not sent. The log is
// read only, and there is no export (D-29).
import { apiClient, type HttpClient } from '@/core/api/apiClient';
import type { components } from '@/types/api.generated';

type Schemas = components['schemas'];

export type AuditLogItem = Schemas['AuditLogItem'];
export type AuditLogResponse = Schemas['AuditLogResponse'];
export type AuditPerson = Schemas['AuditPerson'];

/** What `GET /api/v1/audit-log` is asked for. from and to are business days (`YYYY-MM-DD`); actor and target are user ids. */
export interface AuditLogQuery {
  from: string | null;
  to: string | null;
  /** A user id, or `system`. */
  actor: string | null;
  action: string | null;
  target: string | null;
  page: number;
  pageSize: number;
}

export interface AuditLogService {
  /** `GET /api/v1/audit-log`: one page of entries, newest first. 400 field errors on `from` and `to`. */
  list(query: AuditLogQuery, signal?: AbortSignal): Promise<AuditLogResponse>;
  /** `GET /api/v1/audit-log/people`: everyone the Done by and Done to filters can offer, former staff last. */
  people(signal?: AbortSignal): Promise<AuditPerson[]>;
}

export function createAuditLogService(client: HttpClient): AuditLogService {
  return {
    list: (query, signal) =>
      client.get<AuditLogResponse>('/audit-log', {
        params: {
          from: query.from,
          to: query.to,
          actor: query.actor,
          action: query.action,
          target: query.target,
          page: query.page,
          pageSize: query.pageSize,
        },
        signal,
      }),
    people: (signal) => client.get<AuditPerson[]>('/audit-log/people', { signal }),
  };
}

export const auditLogService: AuditLogService = createAuditLogService(apiClient);
