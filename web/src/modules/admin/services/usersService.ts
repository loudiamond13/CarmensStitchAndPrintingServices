// Staff roster calls (USER-01; plan 05-20). Types come from the generated OpenAPI types (D-16). Both calls are Manager only:
// an Admin or a Manager who lost the role mid-session gets 403. The id is encoded into the path, so it can never add a
// segment or a query. A null search or filter is not sent.
import { apiClient, type HttpClient } from '@/core/api/apiClient';
import type { components } from '@/types/api.generated';

type Schemas = components['schemas'];

export type UserListItem = Schemas['UserListItem'];
export type UserListResponse = Schemas['UserListResponse'];
export type UserDetailResponse = Schemas['UserDetailResponse'];
export type CreateUserRequest = Schemas['CreateUserRequest'];
export type CreateUserResponse = Schemas['CreateUserResponse'];

export const USER_ROLE_FILTERS = ['admin', 'manager'] as const;
export const USER_STATUS_FILTERS = ['active', 'inactive', 'locked'] as const;
export type UserRoleFilter = (typeof USER_ROLE_FILTERS)[number];
export type UserStatusFilter = (typeof USER_STATUS_FILTERS)[number];

/** What `GET /api/v1/users` is asked for. */
export interface UsersListQuery {
  q: string | null;
  role: UserRoleFilter | null;
  status: UserStatusFilter | null;
  page: number;
  pageSize: number;
}

export interface UsersService {
  /** `GET /api/v1/users`: one page of the roster, sorted by first name, last name, id. */
  list(query: UsersListQuery, signal?: AbortSignal): Promise<UserListResponse>;
  /** `GET /api/v1/users/{id}`: one person with the edit version and who recorded and last changed them. */
  get(id: string, signal?: AbortSignal): Promise<UserDetailResponse>;
  /** `POST /api/v1/users`: adds a person (RED stub). */
  create(body: CreateUserRequest, idempotencyKey: string, signal?: AbortSignal): Promise<CreateUserResponse>;
}

export function createUsersService(client: HttpClient): UsersService {
  return {
    list: (query, signal) =>
      client.get<UserListResponse>('/users', {
        params: { q: query.q, role: query.role, status: query.status, page: query.page, pageSize: query.pageSize },
        signal,
      }),
    get: (id, signal) => client.get<UserDetailResponse>(`/users/${encodeURIComponent(id)}`, { signal }),
    create: () => Promise.reject(new Error('not implemented')),
  };
}

export const usersService: UsersService = createUsersService(apiClient);
