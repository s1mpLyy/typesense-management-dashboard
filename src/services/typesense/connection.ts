import { z } from 'zod';

import type {
  ConnectionField,
  ConnectionInput,
  ConnectionProfile,
} from '@/services/typesense/types';

const connectionProfileSchema = z.object({
  protocol: z.enum(['http', 'https']),
  host: z
    .string()
    .trim()
    .min(1, 'Enter a server host.')
    .refine((host) => !host.includes('://') && !host.includes('/'), {
      message: 'Enter the host without a protocol or path.',
    }),
  port: z.coerce.number().int().min(1).max(65_535),
  path: z
    .string()
    .trim()
    .optional()
    .transform((path) => normalizePath(path)),
  apiKey: z.string().trim().min(1, 'Enter an API key.'),
  connectionTimeoutSeconds: z.coerce.number().int().min(1).max(120),
});

export class ConnectionValidationError extends Error {
  readonly fields: Partial<Record<ConnectionField, string>>;

  constructor(fields: Partial<Record<ConnectionField, string>>) {
    super('Check the connection details and try again.');
    this.name = 'ConnectionValidationError';
    this.fields = fields;
  }
}

function normalizePath(path?: string): string | undefined {
  if (!path || path === '/') return undefined;
  return `/${path.replace(/^\/+|\/+$/g, '')}`;
}

export function parseConnectionProfile(input: ConnectionInput): ConnectionProfile {
  const result = connectionProfileSchema.safeParse(input);

  if (!result.success) {
    const fields: Partial<Record<ConnectionField, string>> = {};
    for (const issue of result.error.issues) {
      const field = issue.path[0];
      if (typeof field === 'string' && !(field in fields)) {
        fields[field as ConnectionField] = issue.message;
      }
    }
    throw new ConnectionValidationError(fields);
  }

  return result.data;
}

export function displayEndpoint(profile: ConnectionProfile): string {
  return `${profile.protocol}://${profile.host}:${profile.port}${profile.path ?? ''}`;
}

export function isConnectionProfile(value: unknown): value is ConnectionProfile {
  return connectionProfileSchema.safeParse(value).success;
}
