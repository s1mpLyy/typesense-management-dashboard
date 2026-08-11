<script setup lang="ts">
import { ChevronDown, Database, LockKeyhole } from '@lucide/vue';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Password from 'primevue/password';
import Select from 'primevue/select';
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { ConnectionValidationError } from '@/services/typesense/connection';
import type { ConnectionField, ConnectionProtocol } from '@/services/typesense/types';
import { useConnectionStore } from '@/stores/connection';

const route = useRoute();
const router = useRouter();
const connection = useConnectionStore();

const protocol = ref<ConnectionProtocol>('http');
const host = ref('localhost');
const port = ref('8108');
const path = ref('');
const timeout = ref('10');
const apiKey = ref('');
const showAdvanced = ref(false);
const errorMessage = ref('');
const fieldErrors = ref<Partial<Record<ConnectionField, string>>>({});

function redirectTarget(): string {
  const target = route.query.redirect;
  return typeof target === 'string' && target.startsWith('/') && !target.startsWith('//')
    ? target
    : '/';
}

async function continueToDashboard(): Promise<void> {
  errorMessage.value = '';
  fieldErrors.value = {};

  try {
    await connection.connect({
      protocol: protocol.value,
      host: host.value,
      port: port.value,
      path: path.value,
      apiKey: apiKey.value,
      connectionTimeoutSeconds: timeout.value,
    });
    await router.replace(redirectTarget());
  } catch (error) {
    if (error instanceof ConnectionValidationError) {
      fieldErrors.value = error.fields;
    }
    errorMessage.value = error instanceof Error ? error.message : 'The connection failed.';
  }
}
</script>

<template>
  <main class="login-page">
    <section class="login-panel">
      <div class="login-brand"><Database :size="24" /><span>Typesense</span></div>
      <div class="login-heading">
        <p class="eyebrow">Connect a node</p>
        <h1>Open your dashboard</h1>
        <p>Enter an endpoint and an API key that can list the resources you need.</p>
      </div>

      <div v-if="errorMessage" class="inline-alert inline-alert--error" role="alert">
        {{ errorMessage }}
      </div>

      <form class="login-form" novalidate @submit.prevent="continueToDashboard">
        <label>
          <span>Server address</span>
          <div class="server-address">
            <Select v-model="protocol" :options="['http', 'https']" aria-label="Protocol" />
            <InputText
              v-model="host"
              aria-label="Host"
              autocomplete="url"
              :invalid="Boolean(fieldErrors.host)"
            />
            <InputText
              v-model="port"
              aria-label="Port"
              inputmode="numeric"
              :invalid="Boolean(fieldErrors.port)"
            />
          </div>
          <small v-if="fieldErrors.host || fieldErrors.port" class="field-error">
            {{ fieldErrors.host ?? fieldErrors.port }}
          </small>
        </label>

        <label>
          <span>API key</span>
          <Password
            v-model="apiKey"
            input-id="api-key"
            :feedback="false"
            toggle-mask
            fluid
            autocomplete="current-password"
            :invalid="Boolean(fieldErrors.apiKey)"
          />
          <small v-if="fieldErrors.apiKey" class="field-error">{{ fieldErrors.apiKey }}</small>
        </label>

        <Button
          type="button"
          class="advanced-toggle"
          severity="secondary"
          text
          :aria-expanded="showAdvanced"
          @click="showAdvanced = !showAdvanced"
        >
          <template #icon>
            <ChevronDown :size="16" :class="{ 'advanced-toggle__icon--open': showAdvanced }" />
          </template>
          <span>Advanced connection settings</span>
        </Button>

        <div v-if="showAdvanced" class="advanced-fields">
          <label>
            <span>Path</span>
            <InputText
              v-model="path"
              placeholder="/typesense"
              :invalid="Boolean(fieldErrors.path)"
            />
            <small v-if="fieldErrors.path" class="field-error">{{ fieldErrors.path }}</small>
          </label>
          <label>
            <span>Timeout (seconds)</span>
            <InputText
              v-model="timeout"
              inputmode="numeric"
              :invalid="Boolean(fieldErrors.connectionTimeoutSeconds)"
            />
            <small v-if="fieldErrors.connectionTimeoutSeconds" class="field-error">
              {{ fieldErrors.connectionTimeoutSeconds }}
            </small>
          </label>
        </div>

        <Button type="submit" label="Connect" fluid :loading="connection.isConnecting">
          <template #icon><LockKeyhole :size="17" /></template>
        </Button>
      </form>
      <p class="credential-note">
        Credentials remain in this browser tab and are cleared when you disconnect.
      </p>
    </section>
  </main>
</template>
