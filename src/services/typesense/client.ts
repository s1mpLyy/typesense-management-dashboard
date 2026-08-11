import { Client } from 'typesense';
import type { CollectionSchema, CollectionUpdateSchema } from 'typesense/lib/Typesense/Collection';
import type { CollectionCreateSchema } from 'typesense/lib/Typesense/Collections';
import type { ImportResponse, SearchResponse } from 'typesense/lib/Typesense/Documents';
import type { SearchParams } from 'typesense/lib/Typesense/Types';

import { normalizeTypesenseError } from '@/services/typesense/errors';
import type { ConnectionProfile, ServerStatusSnapshot } from '@/services/typesense/types';

let activeClient: Client | null = null;

export function createTypesenseClient(profile: ConnectionProfile): Client {
  return new Client({
    apiKey: profile.apiKey,
    nodes: [
      {
        host: profile.host,
        port: profile.port,
        protocol: profile.protocol,
        ...(profile.path ? { path: profile.path } : {}),
      },
    ],
    connectionTimeoutSeconds: profile.connectionTimeoutSeconds,
    numRetries: 0,
    sendApiKeyAsQueryParam: false,
  });
}

export async function probeConnection(profile: ConnectionProfile): Promise<Client> {
  const client = createTypesenseClient(profile);
  try {
    await client.collections().retrieve();
    return client;
  } catch (error) {
    throw normalizeTypesenseError(error);
  }
}

export function activateClient(profile: ConnectionProfile, client?: Client): void {
  activeClient = client ?? createTypesenseClient(profile);
}

export function clearActiveClient(): void {
  activeClient = null;
}

export function requireClient(): Client {
  if (!activeClient) {
    throw new Error('No active Typesense connection.');
  }
  return activeClient;
}

export async function listCollections(): Promise<CollectionSchema[]> {
  try {
    return await requireClient().collections().retrieve();
  } catch (error) {
    throw normalizeTypesenseError(error);
  }
}

export async function createCollection(schema: CollectionCreateSchema): Promise<CollectionSchema> {
  try {
    return await requireClient().collections().create(schema);
  } catch (error) {
    throw normalizeTypesenseError(error);
  }
}

export async function deleteCollection(name: string): Promise<CollectionSchema> {
  try {
    return await requireClient().collections(name).delete();
  } catch (error) {
    throw normalizeTypesenseError(error);
  }
}

export async function getCollection(name: string): Promise<CollectionSchema> {
  try {
    return await requireClient().collections(name).retrieve();
  } catch (error) {
    throw normalizeTypesenseError(error);
  }
}

export async function updateCollection(
  name: string,
  schema: CollectionUpdateSchema,
): Promise<CollectionSchema> {
  try {
    const collection = requireClient().collections(name);
    await collection.update(schema);
    return await collection.retrieve();
  } catch (error) {
    throw normalizeTypesenseError(error);
  }
}

export type DocumentAction = 'create' | 'upsert' | 'update';
export type DocumentRecord = Record<string, unknown>;
export type DocumentImportResult = ImportResponse<DocumentRecord>;

export async function importDocuments(
  collectionName: string,
  documents: DocumentRecord[],
  action: DocumentAction,
): Promise<DocumentImportResult[]> {
  try {
    return (await requireClient().collections(collectionName).documents().import(documents, {
      action,
      throwOnFail: false,
    })) as DocumentImportResult[];
  } catch (error) {
    throw normalizeTypesenseError(error);
  }
}

export async function searchDocuments(
  collectionName: string,
  parameters: SearchParams<object>,
): Promise<SearchResponse<DocumentRecord>> {
  try {
    return (await requireClient()
      .collections(collectionName)
      .documents()
      .search(parameters)) as unknown as SearchResponse<DocumentRecord>;
  } catch (error) {
    throw normalizeTypesenseError(error);
  }
}

export async function getDocument(
  collectionName: string,
  documentId: string,
): Promise<DocumentRecord> {
  try {
    return (await requireClient()
      .collections(collectionName)
      .documents(documentId)
      .retrieve()) as DocumentRecord;
  } catch (error) {
    throw normalizeTypesenseError(error);
  }
}

export async function deleteDocument(
  collectionName: string,
  documentId: string,
): Promise<DocumentRecord> {
  try {
    return (await requireClient()
      .collections(collectionName)
      .documents(documentId)
      .delete()) as DocumentRecord;
  } catch (error) {
    throw normalizeTypesenseError(error);
  }
}

export async function exportDocuments(collectionName: string): Promise<string> {
  try {
    return await requireClient().collections(collectionName).documents().export();
  } catch (error) {
    throw normalizeTypesenseError(error);
  }
}

function settledValue<T>(result: PromiseSettledResult<T>): T | null {
  return result.status === 'fulfilled' ? result.value : null;
}

function numberValue(value: string | number | undefined): number | null {
  if (value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function fetchServerStatus(): Promise<ServerStatusSnapshot> {
  const client = requireClient();
  const [collectionsResult, healthResult, metricsResult, statsResult, debugResult] =
    await Promise.allSettled([
      client.collections().retrieve(),
      client.health.retrieve(),
      client.metrics.retrieve(),
      client.stats.retrieve(),
      client.debug.retrieve(),
    ]);

  if (collectionsResult.status === 'rejected') {
    throw normalizeTypesenseError(collectionsResult.reason);
  }

  const collections = collectionsResult.value;
  const health = settledValue(healthResult);
  const metrics = settledValue(metricsResult);
  const stats = settledValue(statsResult);
  const debug = settledValue(debugResult);
  const unavailableResources: string[] = [];
  if (healthResult.status === 'rejected') unavailableResources.push('health');
  if (metricsResult.status === 'rejected') unavailableResources.push('metrics');
  if (statsResult.status === 'rejected') unavailableResources.push('stats');
  if (debugResult.status === 'rejected') unavailableResources.push('debug');

  return {
    health: health?.ok ?? null,
    version: debug?.version ?? null,
    collectionCount: collections.length,
    documentCount: collections.reduce((total, collection) => total + collection.num_documents, 0),
    diskUsedBytes: numberValue(metrics?.system_disk_used_bytes),
    diskTotalBytes: numberValue(metrics?.system_disk_total_bytes),
    searchRequestsPerSecond: numberValue(stats?.search_requests_per_second),
    writeRequestsPerSecond: numberValue(stats?.write_requests_per_second),
    totalRequestsPerSecond: numberValue(stats?.total_requests_per_second),
    pendingWriteBatches: numberValue(stats?.pending_write_batches),
    fetchedAt: new Date(),
    unavailableResources,
  };
}
