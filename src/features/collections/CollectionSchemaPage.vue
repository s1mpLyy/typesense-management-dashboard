<script setup lang="ts">
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { Braces, CalendarDays, Database, FileText, Plus, RefreshCw, Trash2 } from '@lucide/vue';
import Button from 'primevue/button';
import Checkbox from 'primevue/checkbox';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { CollectionFieldSchema } from 'typesense/lib/Typesense/Collection';

import {
  CollectionSchemaError,
  FIELD_TYPES,
  emptyCollectionField,
  fieldDraftToSchema,
} from '@/features/collections/collectionSchema';
import type { CollectionFieldUpdateDraft } from '@/features/collections/collectionSchema';
import { deleteCollection, getCollection, updateCollection } from '@/services/typesense/client';
import { TypesenseDashboardError } from '@/services/typesense/errors';
import { useConnectionStore } from '@/stores/connection';

const route = useRoute();
const router = useRouter();
const queryClient = useQueryClient();
const connection = useConnectionStore();
const collectionName = computed(() => String(route.params.name ?? ''));
const collectionQueryKey = computed(() => [
  'collection',
  connection.sessionId,
  collectionName.value,
]);
const addOpen = ref(false);
const addError = ref('');
const newField = ref<CollectionFieldUpdateDraft>(emptyCollectionField());
const dropFieldTarget = ref<CollectionFieldSchema | null>(null);
const deleteCollectionOpen = ref(false);
const fieldTypeOptions = [...FIELD_TYPES];

const collectionQuery = useQuery({
  queryKey: collectionQueryKey,
  queryFn: () => getCollection(collectionName.value),
  retry: (failureCount, error) =>
    !(error instanceof TypesenseDashboardError && error.status === 404) && failureCount < 1,
});

const addFieldMutation = useMutation({
  mutationFn: (field: CollectionFieldSchema) =>
    updateCollection(collectionName.value, { fields: [field] }),
  onSuccess: async (collection) => {
    addOpen.value = false;
    queryClient.setQueryData(collectionQueryKey.value, collection);
    await refreshSharedData();
  },
  onError: (error) => {
    addError.value = error.message;
  },
});

const dropFieldMutation = useMutation({
  mutationFn: (fieldName: string) =>
    updateCollection(collectionName.value, { fields: [{ name: fieldName, drop: true }] }),
  onSuccess: async (collection) => {
    dropFieldTarget.value = null;
    queryClient.setQueryData(collectionQueryKey.value, collection);
    await refreshSharedData();
  },
});

const deleteCollectionMutation = useMutation({
  mutationFn: () => deleteCollection(collectionName.value),
  onSuccess: async () => {
    await refreshSharedData();
    await router.replace({ name: 'collections' });
  },
});

const isMissing = computed(
  () =>
    collectionQuery.error.value instanceof TypesenseDashboardError &&
    collectionQuery.error.value.status === 404,
);

function openAddField(): void {
  newField.value = emptyCollectionField();
  addError.value = '';
  addFieldMutation.reset();
  addOpen.value = true;
}

function submitField(): void {
  addError.value = '';
  try {
    const field = fieldDraftToSchema(
      newField.value,
      collectionQuery.data.value?.fields.map((item) => item.name) ?? [],
    );
    addFieldMutation.mutate(field);
  } catch (error) {
    addError.value =
      error instanceof CollectionSchemaError ? error.message : 'Check the field definition.';
  }
}

function confirmDropField(): void {
  if (dropFieldTarget.value) dropFieldMutation.mutate(dropFieldTarget.value.name);
}

async function refreshSharedData(): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['collections'] }),
    queryClient.invalidateQueries({ queryKey: ['server-status'] }),
  ]);
}

function fieldTraits(field: CollectionFieldSchema): string[] {
  return [
    field.optional ? 'Optional' : 'Required',
    field.index === false ? 'Not indexed' : 'Indexed',
    ...(field.facet ? ['Facet'] : []),
    ...(field.sort ? ['Sortable'] : []),
    ...(field.infix ? ['Infix'] : []),
    ...(field.stem ? ['Stemmed'] : []),
    ...(field.range_index ? ['Range index'] : []),
  ];
}

function formatCreated(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}
</script>

<template>
  <section class="page-section">
    <div v-if="collectionQuery.isPending.value" class="status-loading" aria-live="polite">
      Loading collection schema...
    </div>

    <div v-else-if="collectionQuery.error.value" class="standalone-panel">
      <Braces :size="26" aria-hidden="true" />
      <h1>{{ isMissing ? 'Collection not found' : 'Schema unavailable' }}</h1>
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
          <p class="eyebrow">Collection schema</p>
          <h1>{{ collectionQuery.data.value.name }}</h1>
          <p>Inspect indexed fields and apply incremental schema changes.</p>
        </div>
        <div class="page-header-actions">
          <Button label="Add field" @click="openAddField">
            <template #icon><Plus :size="17" /></template>
          </Button>
          <Button
            v-tooltip.top="'Refresh schema'"
            text
            rounded
            severity="secondary"
            aria-label="Refresh schema"
            :loading="collectionQuery.isFetching.value"
            @click="collectionQuery.refetch()"
          >
            <RefreshCw :size="18" />
          </Button>
        </div>
      </div>

      <div class="schema-summary" aria-label="Collection details">
        <div>
          <FileText :size="18" aria-hidden="true" />
          <span>Documents</span>
          <strong>{{ collectionQuery.data.value.num_documents.toLocaleString() }}</strong>
        </div>
        <div>
          <Braces :size="18" aria-hidden="true" />
          <span>Fields</span>
          <strong>{{ collectionQuery.data.value.fields.length.toLocaleString() }}</strong>
        </div>
        <div>
          <Database :size="18" aria-hidden="true" />
          <span>Nested fields</span>
          <strong>{{
            collectionQuery.data.value.enable_nested_fields ? 'Enabled' : 'Disabled'
          }}</strong>
        </div>
        <div>
          <CalendarDays :size="18" aria-hidden="true" />
          <span>Created</span>
          <strong>{{ formatCreated(collectionQuery.data.value.created_at) }}</strong>
        </div>
      </div>

      <section class="schema-panel">
        <div class="panel-header">
          <div>
            <h2>Fields</h2>
            <p>Existing fields are immutable. Add a replacement or explicitly drop a field.</p>
          </div>
        </div>
        <div class="schema-field-list">
          <article
            v-for="field in collectionQuery.data.value.fields"
            :key="field.name"
            class="schema-field-row"
          >
            <div class="schema-field-name">
              <strong>{{ field.name }}</strong>
              <code>{{ field.type }}</code>
            </div>
            <div class="schema-field-traits">
              <span v-for="trait in fieldTraits(field)" :key="trait">{{ trait }}</span>
            </div>
            <Button
              v-tooltip.left="'Drop field'"
              text
              rounded
              severity="danger"
              :aria-label="`Drop ${field.name} field`"
              @click="dropFieldTarget = field"
            >
              <Trash2 :size="17" />
            </Button>
          </article>
        </div>
      </section>

      <section class="danger-zone">
        <div>
          <h2>Delete collection</h2>
          <p>Permanently remove this collection and all indexed documents.</p>
        </div>
        <Button
          label="Delete collection"
          severity="danger"
          outlined
          @click="deleteCollectionOpen = true"
        />
      </section>
    </template>

    <Dialog
      v-model:visible="addOpen"
      modal
      header="Add schema field"
      class="field-dialog"
      :closable="!addFieldMutation.isPending.value"
    >
      <form id="add-schema-field" class="collection-form" novalidate @submit.prevent="submitField">
        <div v-if="addError" class="inline-alert inline-alert--error" role="alert">
          {{ addError }}
        </div>
        <div class="collection-field-main collection-field-main--dialog">
          <label>
            <span>Field name</span>
            <InputText v-model="newField.name" placeholder="category" autofocus />
          </label>
          <label>
            <span>Type</span>
            <Select v-model="newField.type" :options="fieldTypeOptions" />
          </label>
        </div>
        <div class="collection-field-options collection-field-options--dialog">
          <label for="new-field-optional">
            <Checkbox v-model="newField.optional" input-id="new-field-optional" binary />
            <span>Optional</span>
          </label>
          <label for="new-field-facet">
            <Checkbox v-model="newField.facet" input-id="new-field-facet" binary />
            <span>Facet</span>
          </label>
          <label for="new-field-sort">
            <Checkbox v-model="newField.sort" input-id="new-field-sort" binary />
            <span>Sortable</span>
          </label>
        </div>
      </form>
      <template #footer>
        <Button
          label="Cancel"
          severity="secondary"
          text
          :disabled="addFieldMutation.isPending.value"
          @click="addOpen = false"
        />
        <Button
          form="add-schema-field"
          type="submit"
          label="Add field"
          :loading="addFieldMutation.isPending.value"
        />
      </template>
    </Dialog>

    <Dialog
      :visible="Boolean(dropFieldTarget)"
      modal
      header="Drop schema field"
      class="confirm-dialog"
      :closable="!dropFieldMutation.isPending.value"
      @update:visible="!$event && (dropFieldTarget = null)"
    >
      <p>
        Drop <strong>{{ dropFieldTarget?.name }}</strong> from <strong>{{ collectionName }}</strong
        >?
      </p>
      <div
        v-if="dropFieldMutation.error.value"
        class="inline-alert inline-alert--error"
        role="alert"
      >
        {{ dropFieldMutation.error.value.message }}
      </div>
      <template #footer>
        <Button
          label="Cancel"
          severity="secondary"
          text
          :disabled="dropFieldMutation.isPending.value"
          @click="dropFieldTarget = null"
        />
        <Button
          label="Drop field"
          severity="danger"
          :loading="dropFieldMutation.isPending.value"
          @click="confirmDropField"
        />
      </template>
    </Dialog>

    <Dialog
      v-model:visible="deleteCollectionOpen"
      modal
      header="Delete collection"
      class="confirm-dialog"
      :closable="!deleteCollectionMutation.isPending.value"
    >
      <p>
        Delete <strong>{{ collectionName }}</strong> and all of its documents? This cannot be
        undone.
      </p>
      <div
        v-if="deleteCollectionMutation.error.value"
        class="inline-alert inline-alert--error"
        role="alert"
      >
        {{ deleteCollectionMutation.error.value.message }}
      </div>
      <template #footer>
        <Button
          label="Cancel"
          severity="secondary"
          text
          :disabled="deleteCollectionMutation.isPending.value"
          @click="deleteCollectionOpen = false"
        />
        <Button
          label="Delete collection"
          severity="danger"
          :loading="deleteCollectionMutation.isPending.value"
          @click="deleteCollectionMutation.mutate()"
        />
      </template>
    </Dialog>
  </section>
</template>
