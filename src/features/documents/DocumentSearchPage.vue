<script setup lang="ts">
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import {
  AlertTriangle,
  Braces,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  Edit3,
  FileSearch,
  List,
  Play,
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
import SelectButton from 'primevue/selectbutton';
import Textarea from 'primevue/textarea';
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { SearchParams } from 'typesense/lib/Typesense/Types';

import {
  DocumentSearchError,
  HIGHLIGHT_END,
  HIGHLIGHT_START,
  buildFilterBy,
  collectHighlightSnippets,
  facetFields as deriveFacetFields,
  parseRawSearchParameters,
  parseSearchHistory,
  prependSearchHistory,
  searchableFieldNames,
  sortOptions as deriveSortOptions,
} from '@/features/documents/documentSearch';
import type {
  HighlightSnippet,
  NumericRange,
  SearchHistoryEntry,
  SearchMode,
} from '@/features/documents/documentSearch';
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
const rawRequestError = ref('');
const searchMode = ref<SearchMode>('builder');
const rawRequestText = ref('');
const submittedRawParameters = ref<SearchParams<object> | null>(null);
const rawExecution = ref(0);
const resultView = ref<'results' | 'response'>('results');
const historyOpen = ref(false);
const searchHistory = ref<SearchHistoryEntry[]>([]);
const searchModeOptions = [
  { label: 'Builder', value: 'builder' },
  { label: 'Raw JSON', value: 'raw' },
];
const resultViewOptions = [
  { label: 'Results', value: 'results' },
  { label: 'Response', value: 'response' },
];
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
const builderSearchParameters = computed<SearchParams<object>>(() => ({
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
}));
const activeSearchParameters = computed(() =>
  searchMode.value === 'raw' ? submittedRawParameters.value : builderSearchParameters.value,
);
const searchQueryKey = computed(() => [
  'documents',
  connection.sessionId,
  collectionName.value,
  searchMode.value,
  JSON.stringify(activeSearchParameters.value),
  rawExecution.value,
]);
const documentsQuery = useQuery({
  queryKey: searchQueryKey,
  queryFn: async () => {
    const parameters = activeSearchParameters.value;
    if (!parameters) throw new DocumentSearchError('Run a raw search request first.');
    const response = await searchDocuments(collectionName.value, parameters);
    recordSearchHistory(searchMode.value, parameters);
    return response;
  },
  enabled: computed(
    () => Boolean(collectionQuery.data.value) && Boolean(activeSearchParameters.value),
  ),
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
  rawRequestError.value = '';
  rawRequestText.value = '';
  submittedRawParameters.value = null;
  rawExecution.value = 0;
  resultView.value = 'results';
  historyOpen.value = false;
});

watch(
  [collectionName, () => connection.endpoint],
  () => {
    try {
      searchHistory.value = parseSearchHistory(sessionStorage.getItem(searchHistoryStorageKey()));
    } catch {
      searchHistory.value = [];
    }
  },
  { immediate: true },
);

watch(searchMode, (mode) => {
  rawRequestError.value = '';
  resultView.value = 'results';
  if (mode === 'raw' && !rawRequestText.value.trim()) resetRawRequest();
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

function searchHistoryStorageKey(): string {
  return `typesense-dashboard-search-history:${encodeURIComponent(connection.endpoint)}:${encodeURIComponent(collectionName.value)}`;
}

function recordSearchHistory(mode: SearchMode, parameters: SearchParams<object>): void {
  const entry: SearchHistoryEntry = {
    id: crypto.randomUUID(),
    mode,
    createdAt: new Date().toISOString(),
    parameters,
  };
  searchHistory.value = prependSearchHistory(searchHistory.value, entry);
  try {
    sessionStorage.setItem(searchHistoryStorageKey(), JSON.stringify(searchHistory.value));
  } catch {
    // Search remains usable when tab storage is unavailable or full.
  }
}

function clearSearchHistory(): void {
  searchHistory.value = [];
  try {
    sessionStorage.removeItem(searchHistoryStorageKey());
  } catch {
    // In-memory history has still been cleared.
  }
}

function runRawSearch(): void {
  rawRequestError.value = '';
  try {
    submittedRawParameters.value = parseRawSearchParameters(rawRequestText.value);
    rawExecution.value += 1;
    resultView.value = 'results';
  } catch (error) {
    rawRequestError.value =
      error instanceof DocumentSearchError ? error.message : 'Check the raw search request.';
  }
}

function resetRawRequest(): void {
  rawRequestText.value = JSON.stringify(builderSearchParameters.value, null, 2);
  submittedRawParameters.value = null;
  rawRequestError.value = '';
}

function replaySearch(entry: SearchHistoryEntry): void {
  searchMode.value = 'raw';
  rawRequestText.value = JSON.stringify(entry.parameters, null, 2);
  submittedRawParameters.value = entry.parameters;
  rawRequestError.value = '';
  rawExecution.value += 1;
  resultView.value = 'results';
  historyOpen.value = false;
}

function historySummary(entry: SearchHistoryEntry): string {
  const queryBy = typeof entry.parameters.query_by === 'string' ? entry.parameters.query_by : '';
  return queryBy ? `${entry.parameters.q} in ${queryBy}` : String(entry.parameters.q);
}

function historyTimestamp(entry: SearchHistoryEntry): string {
  const timestamp = new Date(entry.createdAt);
  return Number.isNaN(timestamp.getTime())
    ? 'Unknown time'
    : new Intl.DateTimeFormat(undefined, {
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
      }).format(timestamp);
}

function formatSearchResponse(): string {
  return JSON.stringify(documentsQuery.data.value, null, 2);
}

function downloadSearchResponse(): void {
  if (!documentsQuery.data.value) return;
  const url = URL.createObjectURL(new Blob([formatSearchResponse()], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${collectionName.value}.search-response.json`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
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
        v-if="
          filterError || rawRequestError || documentsQuery.error.value || exportMutation.error.value
        "
        class="inline-alert inline-alert--error"
        role="alert"
      >
        <AlertTriangle :size="18" aria-hidden="true" />
        <div>
          <strong>{{
            filterError || rawRequestError ? 'Invalid search request' : 'Document request failed'
          }}</strong>
          <span>{{
            filterError ||
            rawRequestError ||
            documentsQuery.error.value?.message ||
            exportMutation.error.value?.message
          }}</span>
        </div>
      </div>

      <div class="search-mode-bar">
        <SelectButton
          v-model="searchMode"
          :options="searchModeOptions"
          option-label="label"
          option-value="value"
          :allow-empty="false"
          aria-label="Search request mode"
        />
        <Button
          :label="'History (' + searchHistory.length + ')'"
          severity="secondary"
          outlined
          :aria-expanded="historyOpen"
          aria-controls="search-history"
          @click="historyOpen = !historyOpen"
        >
          <template #icon><Clock3 :size="16" /></template>
        </Button>
      </div>

      <section
        v-if="historyOpen"
        id="search-history"
        class="search-history-panel"
        aria-labelledby="search-history-heading"
      >
        <header>
          <div>
            <Clock3 :size="17" aria-hidden="true" />
            <h2 id="search-history-heading">Collection search history</h2>
          </div>
          <Button
            v-if="searchHistory.length"
            label="Clear"
            text
            severity="secondary"
            @click="clearSearchHistory"
          />
        </header>
        <p v-if="!searchHistory.length" class="search-history-empty">
          Successful searches for this collection appear here for this browser tab.
        </p>
        <ol v-else>
          <li v-for="entry in searchHistory" :key="entry.id">
            <div>
              <strong>{{ historySummary(entry) }}</strong>
              <span>
                {{ entry.mode === 'raw' ? 'Raw JSON' : 'Builder' }} at
                {{ historyTimestamp(entry) }}
              </span>
            </div>
            <Button
              v-tooltip.left="'Run this request again'"
              text
              rounded
              severity="secondary"
              :aria-label="'Run history request ' + historySummary(entry)"
              @click="replaySearch(entry)"
            >
              <RotateCcw :size="16" />
            </Button>
          </li>
        </ol>
      </section>

      <form
        v-if="searchMode === 'builder'"
        class="document-search-toolbar"
        role="search"
        @submit.prevent="submitSearch"
      >
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
        v-if="searchMode === 'builder' && (allFacetFields.length || sortOptions.length > 1)"
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

      <section v-if="searchMode === 'raw'" class="raw-search-panel">
        <header>
          <div>
            <Braces :size="17" aria-hidden="true" />
            <div>
              <h2>Request JSON</h2>
              <p>Parameters are sent to this collection's search endpoint.</p>
            </div>
          </div>
          <div>
            <Button
              v-tooltip.left="'Reset to the current builder request'"
              text
              rounded
              severity="secondary"
              aria-label="Reset raw search request"
              @click="resetRawRequest"
            >
              <RotateCcw :size="16" />
            </Button>
            <Button label="Run search" severity="secondary" @click="runRawSearch">
              <template #icon><Play :size="16" /></template>
            </Button>
          </div>
        </header>
        <Textarea
          v-model="rawRequestText"
          class="raw-search-editor"
          rows="14"
          spellcheck="false"
          aria-label="Raw search request"
          @keydown.meta.enter.prevent="runRawSearch"
          @keydown.ctrl.enter.prevent="runRawSearch"
        />
      </section>

      <div v-if="documentsQuery.data.value" class="search-result-bar">
        <SelectButton
          v-model="resultView"
          :options="resultViewOptions"
          option-label="label"
          option-value="value"
          :allow-empty="false"
          aria-label="Search result view"
        >
          <template #option="slotProps">
            <List v-if="slotProps.option.value === 'results'" :size="15" />
            <Braces v-else :size="15" />
            <span>{{ slotProps.option.label }}</span>
          </template>
        </SelectButton>
        <Button
          label="Download response"
          severity="secondary"
          outlined
          @click="downloadSearchResponse"
        >
          <template #icon><Download :size="16" /></template>
        </Button>
      </div>

      <div v-if="documentsQuery.isPending.value" class="status-loading" aria-live="polite">
        Searching documents...
      </div>

      <pre
        v-else-if="documentsQuery.data.value && resultView === 'response'"
        class="raw-search-response"
        aria-label="Raw search response"
        >{{ formatSearchResponse() }}</pre>

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

      <nav
        v-if="searchMode === 'builder' && resultView === 'results' && found > perPage"
        class="document-pagination"
        aria-label="Document pages"
      >
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
