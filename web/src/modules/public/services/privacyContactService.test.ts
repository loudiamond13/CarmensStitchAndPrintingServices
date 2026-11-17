// The privacy contact service (D-13, D-29): one typed GET over the shared client.
import { describe, expect, it } from 'vitest';
import { createHttpClient } from '@/core/api/apiClient';
import { isHttpError } from '@/core/api/errors';
import { createFakeFetch } from '@/test/fakeFetch';
import { createPrivacyContactService } from './privacyContactService';

describe('privacyContactService.getPrivacyContact', () => {
  it('calls GET /api/v1/public/privacy-contact once and resolves the typed body', async () => {
    const fake = createFakeFetch([{ body: { email: 'shop-private@example.test' } }]);
    const client = createHttpClient({ baseURL: '/api/v1', fetch: fake.fetch });

    const contact = await createPrivacyContactService(client).getPrivacyContact(new AbortController().signal);

    expect(contact).toEqual({ email: 'shop-private@example.test' });
    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]?.method).toBe('GET');
    expect(fake.calls[0]?.url).toBe('/api/v1/public/privacy-contact');
  });

  it('resolves a null email when none is stored', async () => {
    const fake = createFakeFetch([{ body: { email: null } }]);
    const client = createHttpClient({ baseURL: '/api/v1', fetch: fake.fetch });

    const contact = await createPrivacyContactService(client).getPrivacyContact();

    expect(contact.email).toBeNull();
  });

  it('rejects with an HttpError when the read fails', async () => {
    const fake = createFakeFetch([
      { status: 500, headers: { 'Content-Type': 'application/problem+json' }, body: { title: 'Failed', status: 500 } },
    ]);
    const client = createHttpClient({ baseURL: '/api/v1', fetch: fake.fetch, retry: { max: 0 } });

    const error = await createPrivacyContactService(client)
      .getPrivacyContact()
      .then(
        () => undefined,
        (failure: unknown) => failure,
      );

    expect(isHttpError(error)).toBe(true);
  });
});
