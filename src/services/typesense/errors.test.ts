import { describe, expect, it } from 'vitest';

import { normalizeTypesenseError } from '@/services/typesense/errors';

describe('normalizeTypesenseError', () => {
  it('distinguishes rejected and under-scoped API keys', () => {
    expect(
      normalizeTypesenseError(Object.assign(new Error('Unauthorized'), { httpStatus: 401 })),
    ).toMatchObject({
      status: 401,
      message: 'The API key was rejected by this server.',
    });
    expect(
      normalizeTypesenseError(Object.assign(new Error('Forbidden'), { httpStatus: 403 })),
    ).toMatchObject({
      status: 403,
      message: 'This API key cannot list collections. Use a key with dashboard read access.',
    });
  });

  it('turns network failures into an actionable message', () => {
    expect(normalizeTypesenseError(new Error('Network Error')).message).toContain(
      'Check the address, TLS, and CORS configuration.',
    );
  });

  it('preserves actionable duplicate errors', () => {
    expect(
      normalizeTypesenseError(
        Object.assign(new Error('A collection with name products already exists.'), {
          httpStatus: 409,
        }),
      ),
    ).toMatchObject({
      status: 409,
      message: 'A collection with name products already exists.',
    });
  });
});
