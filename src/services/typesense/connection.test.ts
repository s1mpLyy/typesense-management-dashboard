import { describe, expect, it } from 'vitest';

import {
  ConnectionValidationError,
  displayEndpoint,
  parseConnectionProfile,
} from '@/services/typesense/connection';

describe('connection profile', () => {
  it('normalizes numeric fields and an optional path', () => {
    const profile = parseConnectionProfile({
      protocol: 'https',
      host: 'search.example.com',
      port: '443',
      path: '/typesense/',
      apiKey: 'search-key',
      connectionTimeoutSeconds: '15',
    });

    expect(profile).toEqual({
      protocol: 'https',
      host: 'search.example.com',
      port: 443,
      path: '/typesense',
      apiKey: 'search-key',
      connectionTimeoutSeconds: 15,
    });
    expect(displayEndpoint(profile)).toBe('https://search.example.com:443/typesense');
  });

  it('returns field-level errors for an invalid endpoint', () => {
    expect(() =>
      parseConnectionProfile({
        protocol: 'http',
        host: 'http://localhost',
        port: '70000',
        apiKey: '',
        connectionTimeoutSeconds: '0',
      }),
    ).toThrow(ConnectionValidationError);

    let caughtError: unknown;
    try {
      parseConnectionProfile({
        protocol: 'http',
        host: 'http://localhost',
        port: '70000',
        apiKey: '',
        connectionTimeoutSeconds: '0',
      });
    } catch (error) {
      caughtError = error;
    }

    expect(caughtError).toBeInstanceOf(ConnectionValidationError);
    expect((caughtError as ConnectionValidationError).fields).toMatchObject({
      host: 'Enter the host without a protocol or path.',
      port: expect.any(String),
      apiKey: 'Enter an API key.',
      connectionTimeoutSeconds: expect.any(String),
    });
  });
});
