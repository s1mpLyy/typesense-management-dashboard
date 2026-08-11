<script setup lang="ts">
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  FileJson,
  Plus,
  Send,
  Upload,
  XCircle,
} from '@lucide/vue';
import Button from 'primevue/button';
import SelectButton from 'primevue/selectbutton';
import Textarea from 'primevue/textarea';
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import {
  DocumentInputError,
  createStarterDocument,
  formatDocuments,
  parseDocumentFile,
  parseDocumentJson,
} from '@/features/documents/documentInput';
import { getCollection, getDocument, importDocuments } from '@/services/typesense/client';
import type {
  DocumentAction,
  DocumentImportResult,
  DocumentRecord,
} from '@/services/typesense/client';
import { TypesenseDashboardError } from '@/services/typesense/errors';
import { useConnectionStore } from '@/stores/connection';

const route = useRoute();
const router = useRouter();
const queryClient = useQueryClient();
const connection = useConnectionStore();
const collectionName = computed(() => String(route.params.name ?? ''));
const editId = computed(() => (typeof route.query.edit === 'string' ? route.query.edit : ''));
const collectionQueryKey = computed(() => [
  'collection',
  connection.sessionId,
  collectionName.value,
]);
const rawJson = ref('[]');
const action = ref<DocumentAction>('upsert');
const inputError = ref('');
const fileInput = ref<HTMLInputElement | null>(null);
const results = ref<DocumentImportResult[]>([]);
const initializedEditor = ref('');

const actionOptions: { label: string; value: DocumentAction }[] = [
  { label: 'Create', value: 'create' },
  { label: 'Upsert', value: 'upsert' },
  { label: 'Update', value: 'update' },
];
const actionDescriptions: Record<DocumentAction, string> = {
  create: 'Create new documents. Rows with existing IDs fail.',
  upsert: 'Create new documents or replace documents with matching IDs.',
  update: 'Update existing documents. Partial document fields are allowed.',
};

const collectionQuery = useQuery({
  queryKey: collectionQueryKey,
  queryFn: () => getCollection(collectionName.value),
  retry: (failureCount, error) =>
    !(error instanceof TypesenseDashboardError && error.status === 404) && failureCount < 1,
});

const documentQuery = useQuery({
  queryKey: computed(() => ['document', connection.sessionId, collectionName.value, editId.value]),
  queryFn: () => getDocument(collectionName.value, editId.value),
  enabled: computed(() => Boolean(editId.value)),
  retry: (failureCount, error) =>
    !(error instanceof TypesenseDashboardError && error.status === 404) && failureCount < 1,
});

const importMutation = useMutation({
  mutationFn: (documents: DocumentRecord[]) =>
    importDocuments(collectionName.value, documents, action.value),
  onSuccess: async (response) => {
    results.value = response;
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: collectionQueryKey.value }),
      queryClient.invalidateQueries({ queryKey: ['collections'] }),
      queryClient.invalidateQueries({ queryKey: ['server-status'] }),
    ]);
  },
});

const isMissing = computed(
  () =>
    collectionQuery.error.value instanceof TypesenseDashboardError &&
    collectionQuery.error.value.status === 404,
);
const documentCount = computed(() => {
  try {
    return parseDocumentJson(rawJson.value).length;
  } catch {
    return 0;
  }
});
const successCount = computed(() => results.value.filter((result) => result.success).length);
const failureCount = computed(() => results.value.length - successCount.value);
const editorReady = computed(() => !editId.value || Boolean(documentQuery.data.value));

watch(
  [collectionName, () => collectionQuery.data.value, editId, () => documentQuery.data.value],
  ([name, collection, documentId, document]) => {
    const editorKey = `${name}:${documentId || 'new'}`;
    if (
      !collection ||
      collection.name !== name ||
      initializedEditor.value === editorKey ||
      (documentId && !document)
    )
      return;
    initializedEditor.value = editorKey;
    action.value = 'upsert';
    rawJson.value = formatDocuments([
      documentId && document ? document : createStarterDocument(collection.fields),
    ]);
    inputError.value = '';
    results.value = [];
    importMutation.reset();
  },
  { immediate: true },
);

watch(rawJson, () => {
  results.value = [];
  importMutation.reset();
  try {
    parseDocumentJson(rawJson.value);
    inputError.value = '';
  } catch (error) {
    inputError.value =
      error instanceof DocumentInputError ? error.message : 'Check the document JSON.';
  }
});

function addDocument(): void {
  const collection = collectionQuery.data.value;
  if (!collection) return;

  try {
    const documents = parseDocumentJson(rawJson.value);
    rawJson.value = formatDocuments([...documents, createStarterDocument(collection.fields)]);
  } catch (error) {
    inputError.value =
      error instanceof DocumentInputError ? error.message : 'Check the document JSON.';
  }
}

function submitImport(): void {
  try {
    importMutation.mutate(parseDocumentJson(rawJson.value));
  } catch (error) {
    inputError.value =
      error instanceof DocumentInputError ? error.message : 'Check the document JSON.';
  }
}

function openFilePicker(): void {
  fileInput.value?.click();
}

async function loadFile(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  try {
    rawJson.value = formatDocuments(parseDocumentFile(await file.text()));
    inputError.value = '';
  } catch (error) {
    inputError.value =
      error instanceof DocumentInputError ? error.message : 'The selected file could not be read.';
  } finally {
    input.value = '';
  }
}

function resultIdentifier(result: DocumentImportResult, index: number): string {
  if (result.id) return result.id;
  if (result.document && typeof result.document.id === 'string') return result.document.id;

  try {
    const document = parseDocumentJson(rawJson.value)[index];
    return typeof document?.id === 'string' ? document.id : `Row ${index + 1}`;
  } catch {
    return `Row ${index + 1}`;
  }
}
</script>

<template>
  <section class="page-section">
    <div v-if="collectionQuery.isPending.value" class="status-loading" aria-live="polite">
      Loading document editor...
    </div>

    <div v-else-if="collectionQuery.error.value" class="standalone-panel">
      <BookOpen :size="26" aria-hidden="true" />
      <h1>{{ isMissing ? 'Collection not found' : 'Documents unavailable' }}</h1>
      <p>
        {{
          isMissing
            ? `No collection named ${collectionName} exists on this node.`
            : collectionQuery.error.value.message
        }}
      </p>
      <div>
        <Button
          label="Back to collections"
          severity="secondary"
          outlined
          @click="router.push('/collections')"
        />
        <Button
          v-if="!isMissing"
          label="Retry"
          severity="secondary"
          @click="collectionQuery.refetch()"
        />
      </div>
    </div>

    <template v-else-if="collectionQuery.data.value">
      <div class="page-header">
        <div>
          <p class="eyebrow">Documents</p>
          <h1>{{ collectionQuery.data.value.name }}</h1>
          <p>
            {{
              editId
                ? `Editing document ${editId}.`
                : 'Create or update documents with a JSON batch.'
            }}
          </p>
        </div>
        <div class="page-header-actions">
          <input
            ref="fileInput"
            class="visually-hidden"
            type="file"
            accept=".json,.jsonl,application/json,application/x-ndjson"
            aria-label="Choose document file"
            @change="loadFile"
          />
          <Button label="Load file" severity="secondary" outlined @click="openFilePicker">
            <template #icon><Upload :size="16" /></template>
          </Button>
          <Button
            v-if="editId"
            label="New batch"
            severity="secondary"
            @click="
              router.replace({ name: 'collection-documents', params: { name: collectionName } })
            "
          >
            <template #icon><Plus :size="16" /></template>
          </Button>
        </div>
      </div>

      <div v-if="editId && documentQuery.isPending.value" class="status-loading" aria-live="polite">
        Loading document...
      </div>

      <div
        v-else-if="editId && documentQuery.error.value"
        class="inline-alert inline-alert--error"
        role="alert"
      >
        <AlertTriangle :size="18" aria-hidden="true" />
        <div>
          <strong>Document unavailable</strong>
          <span>{{ documentQuery.error.value.message }}</span>
        </div>
      </div>

      <div v-if="editorReady && inputError" class="inline-alert inline-alert--error" role="alert">
        <AlertTriangle :size="18" aria-hidden="true" />
        <div>
          <strong>Invalid document input</strong>
          <span>{{ inputError }}</span>
        </div>
      </div>

      <div v-if="importMutation.error.value" class="inline-alert inline-alert--error" role="alert">
        <AlertTriangle :size="18" aria-hidden="true" />
        <div>
          <strong>Import request failed</strong>
          <span>{{ importMutation.error.value.message }}</span>
        </div>
      </div>

      <section
        v-if="editorReady"
        class="document-editor-panel"
        aria-labelledby="document-editor-heading"
      >
        <div class="document-editor-header">
          <div>
            <FileJson :size="18" aria-hidden="true" />
            <div>
              <h2 id="document-editor-heading">Document JSON</h2>
              <p>{{ documentCount }} {{ documentCount === 1 ? 'document' : 'documents' }}</p>
            </div>
          </div>
          <Button label="Add document" severity="secondary" text @click="addDocument">
            <template #icon><Plus :size="16" /></template>
          </Button>
        </div>

        <Textarea
          v-model="rawJson"
          class="document-json-editor"
          rows="18"
          spellcheck="false"
          aria-label="Document JSON"
        />

        <div class="document-import-bar">
          <div class="document-action-mode">
            <SelectButton
              v-model="action"
              :options="actionOptions"
              option-label="label"
              option-value="value"
              :allow-empty="false"
              aria-label="Document action mode"
            />
            <span>{{ actionDescriptions[action] }}</span>
          </div>
          <Button
            label="Import documents"
            :loading="importMutation.isPending.value"
            :disabled="Boolean(inputError) || documentCount === 0"
            @click="submitImport"
          >
            <template #icon><Send :size="16" /></template>
          </Button>
        </div>
      </section>

      <section v-if="results.length" class="document-results" aria-live="polite">
        <div class="document-results-header">
          <div>
            <h2>Import results</h2>
            <p>{{ successCount }} succeeded, {{ failureCount }} failed</p>
          </div>
        </div>
        <ol>
          <li
            v-for="(result, index) in results"
            :key="`${index}-${resultIdentifier(result, index)}`"
            :class="result.success ? 'document-result--success' : 'document-result--error'"
          >
            <CheckCircle2 v-if="result.success" :size="18" aria-hidden="true" />
            <XCircle v-else :size="18" aria-hidden="true" />
            <div>
              <strong>{{ resultIdentifier(result, index) }}</strong>
              <span>{{ result.success ? 'Imported successfully' : result.error }}</span>
            </div>
          </li>
        </ol>
      </section>
    </template>
  </section>
</template>
