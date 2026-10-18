// Staff roster, add and edit calls (USER-01, USER-02, USER-03; plans 05-20, 05-22, 05-25). Types come from the generated OpenAPI types (D-16). All calls are Manager only:
// an Admin or a Manager who lost the role mid-session gets 403. The id is encoded into the path, so it can never add a
// segment or a query. A null search or filter is not sent.
import { apiClient, type HttpClient } from '@/core/api/apiClient';
import type { components } from '@/types/api.generated';

type Schemas = components['schemas'];

export type UserListItem = Schemas['UserListItem'];
export type UserListResponse = Schemas['UserListResponse'];
export type UserDetailResponse = Schemas['UserDetailResponse'];
/** The Add User body; the temporary password is left out on the invitation route. */
export type CreateUserRequest = Omit<Schemas['CreateUserRequest'], 'temporaryPassword'> & {
  temporaryPassword?: string;
};
export type CreateUserResponse = Schemas['CreateUserResponse'];
/** The Edit User body (D-45): `email` is always sent; `emailChange` only when the email differs from the saved one. */
export type UpdateUserRequest = Schemas['UpdateUserRequest'];

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
  /**
   * `POST /api/v1/users`: adds a person by invitation or with a one-time temporary password (Manager only). The caller
   * supplies one Idempotency-Key per submission. The answer is the new id only: the password never comes back (D-14).
   */
  create(body: CreateUserRequest, idempotencyKey: string, signal?: AbortSignal): Promise<CreateUserResponse>;
  /**
   * `PUT /api/v1/users/{id}`: saves names, email and role against the edit version; resolves the saved person with the
   * new version. A PUT repeats safely, so it carries no Idempotency-Key. 409 `edit.stale`, 422 `users.last-active-manager`
   * or `users.own-account`, 404 `users.not-found`.
   */
  update(id: string, body: UpdateUserRequest, signal?: AbortSignal): Promise<UserDetailResponse>;
  /**
   * `POST /api/v1/users/{id}/deactivate`: they cannot sign in and every session of theirs ends at once (204; repeating it is
   * also 204). One Idempotency-Key per submission. 422 `users.last-active-manager` or `users.own-account`, 404 `users.not-found`.
   */
  deactivate(id: string, idempotencyKey: string, signal?: AbortSignal): Promise<void>;
  /** `POST /api/v1/users/{id}/activate`: lets them sign in again (204; repeating it is also 204). One Idempotency-Key per submission. */
  activate(id: string, idempotencyKey: string, signal?: AbortSignal): Promise<void>;
  /**
   * `DELETE /api/v1/users/{id}`: removes them for good (204). A DELETE repeats safely, so it carries no Idempotency-Key; deleting
   * someone already deleted is a 404. 422 `users.last-active-manager` or `users.own-account`.
   */
  remove(id: string, signal?: AbortSignal): Promise<void>;
}

export function createUsersService(client: HttpClient): UsersService {
  return {
    list: (query, signal) =>
      client.get<UserListResponse>('/users', {
        params: { q: query.q, role: query.role, status: query.status, page: query.page, pageSize: query.pageSize },
        signal,
      }),
    get: (id, signal) => client.get<UserDetailResponse>(`/users/${encodeURIComponent(id)}`, { signal }),
    create: (body, idempotencyKey, signal) =>
      client.post<CreateUserResponse>('/users', body, { idempotencyKey, signal }),
    update: (id, body, signal) => client.put<UserDetailResponse>(`/users/${encodeURIComponent(id)}`, body, { signal }),
    deactivate: () => Promise.reject(new Error('not implemented')),
    activate: () => Promise.reject(new Error('not implemented')),
    remove: () => Promise.reject(new Error('not implemented')),
  };
}

export const usersService: UsersService = createUsersService(apiClient);
