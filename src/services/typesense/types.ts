export type ConnectionProtocol = 'http' | 'https';

export interface ConnectionInput {
  protocol: ConnectionProtocol;
  host: string;
  port: number | string;
  path?: string;
  apiKey: string;
  connectionTimeoutSeconds: number | string;
}

export interface ConnectionProfile {
  protocol: ConnectionProtocol;
  host: string;
  port: number;
  path?: string;
  apiKey: string;
  connectionTimeoutSeconds: number;
}

export type ConnectionField = keyof ConnectionInput;

export interface ServerStatusSnapshot {
  health: boolean | null;
  version: string | null;
  collectionCount: number;
  documentCount: number;
  diskUsedBytes: number | null;
  diskTotalBytes: number | null;
  searchRequestsPerSecond: number | null;
  writeRequestsPerSecond: number | null;
  totalRequestsPerSecond: number | null;
  pendingWriteBatches: number | null;
  fetchedAt: Date;
  unavailableResources: string[];
}
