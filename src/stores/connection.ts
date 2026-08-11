import { computed, ref } from 'vue';
import { defineStore } from 'pinia';

import { activateClient, clearActiveClient, probeConnection } from '@/services/typesense/client';
import {
  displayEndpoint,
  isConnectionProfile,
  parseConnectionProfile,
} from '@/services/typesense/connection';
import type { ConnectionInput, ConnectionProfile } from '@/services/typesense/types';

const SESSION_KEY = 'typesense-dashboard-session';

function loadSession(): ConnectionProfile | null {
  try {
    const serialized = sessionStorage.getItem(SESSION_KEY);
    if (!serialized) return null;
    const parsed: unknown = JSON.parse(serialized);
    if (isConnectionProfile(parsed)) return parsed;
  } catch {
    // Invalid browser state is cleared below and treated as logged out.
  }
  sessionStorage.removeItem(SESSION_KEY);
  return null;
}

export const useConnectionStore = defineStore('connection', () => {
  const profile = ref<ConnectionProfile | null>(loadSession());
  const isConnecting = ref(false);
  const sessionId = ref(crypto.randomUUID());

  if (profile.value) activateClient(profile.value);

  const isConnected = computed(() => profile.value !== null);
  const endpoint = computed(() => (profile.value ? displayEndpoint(profile.value) : ''));

  async function connect(input: ConnectionInput): Promise<void> {
    const parsed = parseConnectionProfile(input);
    isConnecting.value = true;
    try {
      const client = await probeConnection(parsed);
      profile.value = parsed;
      sessionId.value = crypto.randomUUID();
      activateClient(parsed, client);
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(parsed));
    } finally {
      isConnecting.value = false;
    }
  }

  function disconnect(): void {
    profile.value = null;
    sessionId.value = crypto.randomUUID();
    clearActiveClient();
    sessionStorage.removeItem(SESSION_KEY);
  }

  return { profile, isConnected, isConnecting, sessionId, endpoint, connect, disconnect };
});
