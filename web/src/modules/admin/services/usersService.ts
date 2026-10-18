// Staff roster calls (USER-01; plan 05-20). Types come from the generated OpenAPI types (D-16). Stub for the RED commit.
import { apiClient, type HttpClient } from '@/core/api/apiClient';
import type { components } from '@/types/api.generated';

type Schemas = components['schemas'];

export type UserListItem = Schemas['UserListItem'];
export type UserListResponse = Schemas['UserListResponse'];
export type UserDetailResponse = Schemas['UserDetailResponse'];

export const USER_ROLE_FILTERS = ['admin', 'manager'] as const;
export const USER_STATUS_FILTERS = ['active', 'inactive', 'locked'] as const;
export type UserRoleFilter = (typeof USER_ROLE_FILTERS)[number];
export type UserStatusFilter = (typeof USER_STATUS_FILTERS)[number];

/** What `GET /api/v1/users` is asked for; a null filter or search is not sent. */
export interface UsersListQuery {
  q: string | null;
  role: UserRoleFilter | null;
  status: UserStatusFilter | null;
  page: number;
  pageSize: number;
}

export interface UsersService {
  list(query: UsersListQuery, signal?: AbortSignal): Promise<UserListResponse>;
  get(id: string, signal?: AbortSignal): Promise<UserDetailResponse>;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- RED stub: the calls arrive in the GREEN commit.
export function createUsersService(client: HttpClient): UsersService {
  return {
    list: () => Promise.reject(new Error('not implemented')),
    get: () => Promise.reject(new Error('not implemented')),
  };
}

export const usersService: UsersService = createUsersService(apiClient);
