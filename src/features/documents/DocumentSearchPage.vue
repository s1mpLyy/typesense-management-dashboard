<script setup lang="ts">
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Download,
  Edit3,
  FileSearch,
  Plus,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Trash2,
} from '@lucide/vue';
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import InputNumber from 'primevue/inputnumber';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import {
  DocumentSearchError,
  HIGHLIGHT_END,
  HIGHLIGHT_START,
  buildFilterBy,
  collectHighlightSnippets,
  facetFields as deriveFacetFields,
  searchableFieldNames,
  sortOptions as deriveSortOptions,
} from '@/features/documents/documentSearch';
import type { HighlightSnippet, NumericRange } from '@/features/documents/documentSearch';
import {
  deleteDocument,
  exportDocuments,
  getCollection,
  searchDocuments,
} from '@/services/typesense/client';
import type { DocumentRecord } from '@/services/typesense/client';
import { TypesenseDashboardError } from '@/services/typesense/errors';
import { useConnectionStore } from '@/stores/connection';

const route = useRoute();
const router = useRouter();
const queryClient = useQueryClient();
const connection = useConnectionStore();
const collectionName = computed(() => String(route.params.name ?? ''));
const searchInput = ref('');
const submittedQuery = ref('');
const page = ref(1);
const perPage = ref(12);
const perPageOptions = [12, 48, 100];
const deleteTarget = ref<DocumentRecord | null>(null);
const facetSelections = ref<Record<string, string | undefined>>({});
const numericMinimums = ref<Record<string, number | null>>({});
const numericMaximums = ref<Record<string, number | null>>({});
const appliedFilterBy = ref('');
const selectedSort = ref('');
const filterError = ref('');
const booleanOptions = [
  { label: 'Any value', value: '' },
  { label: 'True', value: 'true' },
  { label: 'False', value: 'false' },
];

const collectionQueryKey = computed(() => [
  'collection',
  connection.sessionId,
  collectionName.value,
]);
const collectionQuery = useQuery({
  queryKey: collectionQueryKey,
  queryFn: () => getCollection(collectionName.value),
  retry: (failureCount, error) =>
    !(error instanceof TypesenseDashboardError && error.status === 404) && failureCount < 1,
});

const collectionFields = computed(() => collectionQuery.data.value?.fields ?? []);
const queryFields = computed(() => searchableFieldNames(collectionFields.value));
const stringFacetFields = computed(() =>
  deriveFacetFields(collectionFields.value, ['string', 'string[]']),
);
const booleanFacetFields = computed(() =>
  deriveFacetFields(collectionFields.value, ['bool', 'bool[]']),
);
const numericFacetFields = computed(() =>
  deriveFacetFields(collectionFields.value, [
    'int32',
    'int32[]',
    'int64',
    'int64[]',
    'float',
    'float[]',
  ]),
);
const allFacetFields = computed(() => [
  ...stringFacetFields.value,
  ...booleanFacetFields.value,
  ...numericFacetFields.value,
]);
const sortOptions = computed(() => deriveSortOptions(collectionFields.value));
const searchQueryKey = computed(() => [
  'documents',
  connection.sessionId,
  collectionName.value,
  submittedQuery.value,
  page.value,
  perPage.value,
  appliedFilterBy.value,
  selectedSort.value,
]);
const documentsQuery = useQuery({
  queryKey: searchQueryKey,
  queryFn: () =>
    searchDocuments(collectionName.value, {
      q: submittedQuery.value.trim() || '*',
      ...(queryFields.value.length ? { query_by: queryFields.value.join(',') } : {}),
      ...(allFacetFields.value.length
        ? { facet_by: allFacetFields.value.map((field) => field.name).join(',') }
        : {}),
      ...(appliedFilterBy.value ? { filter_by: appliedFilterBy.value } : {}),
      ...(selectedSort.value ? { sort_by: selectedSort.value } : {}),
      ...(queryFields.value.length
        ? {
            highlight_fields: queryFields.value.join(','),
            highlight_start_tag: HIGHLIGHT_START,
            highlight_end_tag: HIGHLIGHT_END,
          }
        : {}),
      page: page.value,
      per_page: perPage.value,
    }),
  enabled: computed(() => Boolean(collectionQuery.data.value)),
  retry: false,
});

const hits = computed(() => documentsQuery.data.value?.hits ?? []);
const found = computed(() => documentsQuery.data.value?.found ?? 0);
const totalPages = computed(() => Math.max(1, Math.ceil(found.value / perPage.value)));
const isMissing = computed(
  () =>
    collectionQuery.error.value instanceof TypesenseDashboardError &&
    collectionQuery.error.value.status === 404,
);

const deleteMutation = useMutation({
  mutationFn: (id: string) => deleteDocument(collectionName.value, id),
  onSuccess: async () => {
    deleteTarget.value = null;
    await refreshDocumentData();
  },
});

const exportMutation = useMutation({
  mutationFn: () => exportDocuments(collectionName.value),
  onSuccess: (jsonl) => {
    const url = URL.createObjectURL(new Blob([jsonl], { type: 'application/x-ndjson' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${collectionName.value}.jsonl`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  },
});

watch(collectionName, () => {
  searchInput.value = '';
  submittedQuery.value = '';
  page.value = 1;
  deleteTarget.value = null;
  facetSelections.value = {};
  numericMinimums.value = {};
  numericMaximums.value = {};
  appliedFilterBy.value = '';
  selectedSort.value = '';
  filterError.value = '';
});

watch(perPage, () => {
  page.value = 1;
});

watch(selectedSort, () => {
  page.value = 1;
});

function submitSearch(): void {
  page.value = 1;
  submittedQuery.value = searchInput.value;
}

function applyFilters(): void {
  filterError.value = '';
  const ranges = Object.fromEntries(
    numericFacetFields.value.map((field) => [
      field.name,
      {
        min: numericMinimums.value[field.name] ?? null,
        max: numericMaximums.value[field.name] ?? null,
      } satisfies NumericRange,
    ]),
  );
  try {
    appliedFilterBy.value = buildFilterBy(
      facetSelections.value,
      ranges,
      booleanFacetFields.value.map((field) => field.name),
    );
    page.value = 1;
  } catch (error) {
    filterError.value =
      error instanceof DocumentSearchError ? error.message : 'Check the search filters.';
  }
}

function resetFilters(): void {
  facetSelections.value = {};
  numericMinimums.value = {};
  numericMaximums.value = {};
  appliedFilterBy.value = '';
  selectedSort.value = '';
  filterError.value = '';
  page.value = 1;
}

function facetOptions(fieldName: string): { label: string; value: string }[] {
  const facet = documentsQuery.data.value?.facet_counts?.find(
    (item) => item.field_name === fieldName,
  );
  return (facet?.counts ?? []).map((count) => ({
    label: `${count.value} (${count.count.toLocaleString()})`,
    value: count.value,
  }));
}

function documentId(document: DocumentRecord): string {
  return typeof document.id === 'string' ? document.id : '';
}

function editDocument(document: DocumentRecord): void {
  const id = documentId(document);
  if (!id) return;
  void router.push({
    name: 'collection-documents',
    params: { name: collectionName.value },
    query: { edit: id },
  });
}

function requestDelete(document: DocumentRecord): void {
  deleteMutation.reset();
  deleteTarget.value = document;
}

function confirmDelete(): void {
  const id = deleteTarget.value ? documentId(deleteTarget.value) : '';
  if (id) deleteMutation.mutate(id);
}

async function refreshDocumentData(): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['documents'] }),
    queryClient.invalidateQueries({ queryKey: collectionQueryKey.value }),
    queryClient.invalidateQueries({ queryKey: ['collections'] }),
    queryClient.invalidateQueries({ queryKey: ['server-status'] }),
  ]);
}

function formatDocument(document: DocumentRecord): string {
  return JSON.stringify(document, null, 2);
}

function highlightMatches(highlight: unknown): HighlightSnippet[] {
  return collectHighlightSnippets(highlight);
}
</script>

<template>
  <section class="page-section">
    <div v-if="collectionQuery.isPending.value" class="status-loading" aria-live="polite">
      Loading collection documents...
    </div>

    <div v-else-if="collectionQuery.error.value" class="standalone-panel">
      <FileSearch :size="26" aria-hidden="true" />
      <h1>{{ isMissing ? 'Collection not found' : 'Search unavailable' }}</h1>
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
          <p class="eyebrow">Document browser</p>
          <h1>{{ collectionQuery.data.value.name }}</h1>
          <p>Search indexed text fields and inspect stored documents.</p>
        </div>
        <div class="page-header-actions">
          <Button
            label="Export JSONL"
            severity="secondary"
            outlined
            :loading="exportMutation.isPending.value"
            @click="exportMutation.mutate()"
          >
            <template #icon><Download :size="16" /></template>
          </Button>
          <Button
            label="Add documents"
            @click="router.push(`/collection/${collectionName}/document`)"
          >
            <template #icon><Plus :size="16" /></template>
          </Button>
        </div>
      </div>

      <div
        v-if="filterError || documentsQuery.error.value || exportMutation.error.value"
        class="inline-alert inline-alert--error"
        role="alert"
      >
        <AlertTriangle :size="18" aria-hidden="true" />
        <div>
          <strong>{{ filterError ? 'Invalid search filter' : 'Document request failed' }}</strong>
          <span>{{
            filterError ||
            documentsQuery.error.value?.message ||
            exportMutation.error.value?.message
          }}</span>
        </div>
      </div>

      <form class="document-search-toolbar" role="search" @submit.prevent="submitSearch">
        <div class="search-input document-search-input">
          <Search :size="17" aria-hidden="true" />
          <InputText
            v-model="searchInput"
            aria-label="Search documents"
            :placeholder="
              queryFields.length ? `Search ${queryFields.join(', ')}` : 'Browse documents'
            "
          />
        </div>
        <Button type="submit" label="Search" severity="secondary" />
        <Select
          v-model="perPage"
          :options="perPageOptions"
          aria-label="Documents per page"
          class="document-page-size"
        />
        <span>{{ found.toLocaleString() }} {{ found === 1 ? 'result' : 'results' }}</span>
      </form>

      <section
        v-if="allFacetFields.length || sortOptions.length > 1"
        class="advanced-search-panel"
        aria-labelledby="advanced-search-heading"
      >
        <div class="advanced-search-header">
          <div>
            <SlidersHorizontal :size="17" aria-hidden="true" />
            <h2 id="advanced-search-heading">Filters and sorting</h2>
          </div>
          <Button
            v-tooltip.left="'Reset filters and sorting'"
            text
            rounded
            severity="secondary"
            aria-label="Reset filters and sorting"
            @click="resetFilters"
          >
            <RotateCcw :size="16" />
          </Button>
        </div>

        <div class="advanced-search-controls">
          <label v-if="sortOptions.length > 1" class="advanced-search-field">
            <span>Sort by</span>
            <Select
              v-model="selectedSort"
              :options="sortOptions"
              option-label="label"
              option-value="value"
              placeholder="Relevance"
              aria-label="Sort documents"
            />
          </label>

          <label v-for="field in stringFacetFields" :key="field.name" class="advanced-search-field">
            <span>{{ field.name }}</span>
            <Select
              v-model="facetSelections[field.name]"
              :options="facetOptions(field.name)"
              option-label="label"
              option-value="value"
              :placeholder="`Any ${field.name}`"
              show-clear
              :aria-label="`Filter ${field.name}`"
            />
          </label>

          <label
            v-for="field in booleanFacetFields"
            :key="field.name"
            class="advanced-search-field"
          >
            <span>{{ field.name }}</span>
            <Select
              v-model="facetSelections[field.name]"
              :options="booleanOptions"
              option-label="label"
              option-value="value"
              placeholder="Any value"
              :aria-label="`Filter ${field.name}`"
            />
          </label>

          <fieldset
            v-for="field in numericFacetFields"
            :key="field.name"
            class="advanced-range-field"
          >
            <legend>{{ field.name }}</legend>
            <InputNumber
              v-model="numericMinimums[field.name]"
              :use-grouping="false"
              placeholder="Minimum"
              :aria-label="`${field.name} minimum`"
            />
            <span>to</span>
            <InputNumber
              v-model="numericMaximums[field.name]"
              :use-grouping="false"
              placeholder="Maximum"
              :aria-label="`${field.name} maximum`"
            />
          </fieldset>
        </div>

        <div class="advanced-search-footer">
          <span v-if="appliedFilterBy">{{ appliedFilterBy }}</span>
          <span v-else>No filters applied</span>
          <Button label="Apply filters" severity="secondary" @click="applyFilters" />
        </div>
      </section>

      <div v-if="documentsQuery.isPending.value" class="status-loading" aria-live="polite">
        Searching documents...
      </div>

      <div v-else-if="hits.length" class="document-result-grid">
        <article v-for="hit in hits" :key="documentId(hit.document)" class="document-card">
          <header>
            <strong>{{ documentId(hit.document) || 'Generated ID' }}</strong>
            <div>
              <Button
                v-tooltip.top="'Edit document'"
                text
                rounded
                severity="secondary"
                :disabled="!documentId(hit.document)"
                :aria-label="`Edit document ${documentId(hit.document)}`"
                @click="editDocument(hit.document)"
              >
                <Edit3 :size="16" />
              </Button>
              <Button
                v-tooltip.top="'Delete document'"
                text
                rounded
                severity="danger"
                :disabled="!documentId(hit.document)"
                :aria-label="`Delete document ${documentId(hit.document)}`"
                @click="requestDelete(hit.document)"
              >
                <Trash2 :size="16" />
              </Button>
            </div>
          </header>
          <div v-if="highlightMatches(hit.highlight).length" class="document-highlights">
            <p v-for="match in highlightMatches(hit.highlight)" :key="match.field">
              <strong>{{ match.field }}</strong>
              <span>
                <template v-for="(segment, index) in match.segments" :key="index">
                  <mark v-if="segment.matched">{{ segment.text }}</mark>
                  <template v-else>{{ segment.text }}</template>
                </template>
              </span>
            </p>
          </div>
          <pre>{{ formatDocument(hit.document) }}</pre>
        </article>
      </div>

      <div v-else-if="!documentsQuery.error.value" class="empty-state document-empty-state">
        <FileSearch :size="24" aria-hidden="true" />
        <h2>No documents found</h2>
        <p>
          {{
            submittedQuery
              ? 'Try another search term or clear the query to browse every document.'
              : 'Import documents into this collection to make them available here.'
          }}
        </p>
      </div>

      <nav v-if="found > perPage" class="document-pagination" aria-label="Document pages">
        <Button
          v-tooltip.top="'Previous page'"
          text
          rounded
          severity="secondary"
          aria-label="Previous page"
          :disabled="page <= 1"
          @click="page -= 1"
        >
          <ChevronLeft :size="18" />
        </Button>
        <span>Page {{ page }} of {{ totalPages }}</span>
        <Button
          v-tooltip.top="'Next page'"
          text
          rounded
          severity="secondary"
          aria-label="Next page"
          :disabled="page >= totalPages"
          @click="page += 1"
        >
          <ChevronRight :size="18" />
        </Button>
      </nav>
    </template>

    <Dialog
      :visible="Boolean(deleteTarget)"
      modal
      header="Delete document"
      class="confirm-dialog"
      :closable="!deleteMutation.isPending.value"
      @update:visible="!$event && (deleteTarget = null)"
    >
      <p>
        Delete document <strong>{{ deleteTarget ? documentId(deleteTarget) : '' }}</strong
        >?
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
          label="Delete document"
          severity="danger"
          :loading="deleteMutation.isPending.value"
          @click="confirmDelete"
        />
      </template>
    </Dialog>
  </section>
</template>
