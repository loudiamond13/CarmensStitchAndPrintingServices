// RED stub (plan 05-33): replaced in the GREEN commit.
import type { HttpClient } from '@/core/api/apiClient';
import type { components } from '@/types/api.generated';

type Schemas = components['schemas'];

export type AuditLogItem = Schemas['AuditLogItem'];
export type AuditLogResponse = Schemas['AuditLogResponse'];
export type AuditPerson = Schemas['AuditPerson'];

export interface AuditLogQuery {
  from: string | null;
  to: string | null;
  actor: string | null;
  action: string | null;
  target: string | null;
  page: number;
  pageSize: number;
}

export interface AuditLogService {
  list(query: AuditLogQuery, signal?: AbortSignal): Promise<AuditLogResponse>;
  people(signal?: AbortSignal): Promise<AuditPerson[]>;
}

export function createAuditLogService(_client: HttpClient): AuditLogService {
  return {
    list: () => Promise.resolve({ items: [], total: 0, page: 1, pageSize: 20 }),
    people: () => Promise.resolve([]),
  };
}
