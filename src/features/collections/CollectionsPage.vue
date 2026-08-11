<script setup lang="ts">
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { Braces, Database, Plus, Search, Trash2 } from '@lucide/vue';
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import type { CollectionSchema } from 'typesense/lib/Typesense/Collection';
import type { CollectionCreateSchema } from 'typesense/lib/Typesense/Collections';

import CollectionCreateDialog from '@/features/collections/CollectionCreateDialog.vue';
import { createCollection, deleteCollection, listCollections } from '@/services/typesense/client';
import { useConnectionStore } from '@/stores/connection';

const router = useRouter();
const queryClient = useQueryClient();
const connection = useConnectionStore();
const filter = ref('');
const createOpen = ref(false);
const createError = ref('');
const deleteTarget = ref<CollectionSchema | null>(null);

const collectionsQuery = useQuery({
  queryKey: computed(() => ['collections', connection.sessionId]),
  queryFn: listCollections,
});

const filteredCollections = computed(() => {
  const query = filter.value.trim().toLocaleLowerCase();
  return [...(collectionsQuery.data.value ?? [])]
    .filter((collection) => !query || collection.name.toLocaleLowerCase().includes(query))
    .sort((left, right) => left.name.localeCompare(right.name));
});

const createMutation = useMutation({
  mutationFn: createCollection,
  onSuccess: async (collection) => {
    await refreshCollections();
    createOpen.value = false;
    await router.push(`/collection/${collection.name}/schema`);
  },
  onError: (error) => {
    createError.value = error.message;
  },
});

const deleteMutation = useMutation({
  mutationFn: deleteCollection,
  onSuccess: async () => {
    deleteTarget.value = null;
    await refreshCollections();
  },
});

async function refreshCollections(): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['collections'] }),
    queryClient.invalidateQueries({ queryKey: ['server-status'] }),
  ]);
}

function openCreate(): void {
  createError.value = '';
  createOpen.value = true;
}

function submitCreate(schema: CollectionCreateSchema): void {
  createError.value = '';
  createMutation.mutate(schema);
}

function requestDelete(collection: CollectionSchema): void {
  deleteMutation.reset();
  deleteTarget.value = collection;
}

function confirmDelete(): void {
  if (deleteTarget.value) deleteMutation.mutate(deleteTarget.value.name);
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
    <div class="page-header">
      <div>
        <p class="eyebrow">Data</p>
        <h1>Collections</h1>
        <p>Inspect schemas and manage the collections on this Typesense node.</p>
      </div>
      <Button label="Create collection" @click="openCreate">
        <template #icon><Plus :size="17" /></template>
      </Button>
    </div>

    <div v-if="collectionsQuery.error.value" class="inline-alert inline-alert--error" role="alert">
      {{ collectionsQuery.error.value.message }}
    </div>

    <div class="resource-toolbar">
      <div class="search-input">
        <Search :size="17" aria-hidden="true" />
        <InputText
          v-model="filter"
          aria-label="Filter collections"
          placeholder="Filter collections"
        />
      </div>
      <span>
        {{ filteredCollections.length }}
        {{ filteredCollections.length === 1 ? 'collection' : 'collections' }}
      </span>
    </div>

    <div v-if="collectionsQuery.isPending.value" class="status-loading" aria-live="polite">
      Loading collections...
    </div>

    <div v-else-if="filteredCollections.length" class="collection-table" role="table">
      <div class="collection-table-header" role="row">
        <span role="columnheader">Name</span>
        <span role="columnheader">Documents</span>
        <span role="columnheader">Fields</span>
        <span role="columnheader">Created</span>
        <span role="columnheader">Actions</span>
      </div>
      <article
        v-for="collection in filteredCollections"
        :key="collection.name"
        class="collection-row"
        role="row"
      >
        <div class="collection-name" role="cell">
          <Database :size="18" aria-hidden="true" />
          <RouterLink :to="`/collection/${collection.name}/search`">
            {{ collection.name }}
          </RouterLink>
        </div>
        <div class="collection-stat" role="cell" data-label="Documents">
          {{ collection.num_documents.toLocaleString() }}
        </div>
        <div class="collection-stat" role="cell" data-label="Fields">
          {{ collection.fields.length.toLocaleString() }}
        </div>
        <time
          role="cell"
          data-label="Created"
          :datetime="new Date(collection.created_at * 1000).toISOString()"
        >
          {{ formatCreated(collection.created_at) }}
        </time>
        <div class="collection-actions" role="cell">
          <Button
            v-tooltip.top="'Open schema'"
            text
            rounded
            severity="secondary"
            :aria-label="`Open ${collection.name} schema`"
            @click="router.push(`/collection/${collection.name}/schema`)"
          >
            <Braces :size="17" />
          </Button>
          <Button
            v-tooltip.top="'Delete collection'"
            text
            rounded
            severity="danger"
            :aria-label="`Delete ${collection.name}`"
            @click="requestDelete(collection)"
          >
            <Trash2 :size="17" />
          </Button>
        </div>
      </article>
    </div>

    <div v-else class="empty-state">
      <Database :size="24" aria-hidden="true" />
      <h2>{{ filter ? 'No matching collections' : 'No collections yet' }}</h2>
      <p>
        {{
          filter
            ? 'Adjust the filter to find another collection.'
            : 'Create a collection to define a schema and begin indexing documents.'
        }}
      </p>
      <Button
        v-if="!filter"
        label="Create collection"
        severity="secondary"
        outlined
        @click="openCreate"
      />
    </div>

    <CollectionCreateDialog
      v-model:visible="createOpen"
      :loading="createMutation.isPending.value"
      :server-error="createError"
      @submit="submitCreate"
    />

    <Dialog
      :visible="Boolean(deleteTarget)"
      modal
      header="Delete collection"
      class="confirm-dialog"
      :closable="!deleteMutation.isPending.value"
      @update:visible="!$event && (deleteTarget = null)"
    >
      <p>
        Delete <strong>{{ deleteTarget?.name }}</strong> and all of its documents?
      </p>
      <div v-if="deleteMutation.error.value" class="inline-alert inline-alert--error" role="alert">
        {{ deleteMutation.error.value.message }}
      </div>
      <template #footer>
        <Button
          label="Cancel"
          severity="secondary"
          text
          :disabled="deleteMutation.isPending.value"
          @click="deleteTarget = null"
        />
        <Button
          label="Delete collection"
          severity="danger"
          :loading="deleteMutation.isPending.value"
          @click="confirmDelete"
        />
      </template>
    </Dialog>
  </section>
</template>
