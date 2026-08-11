# Vue Reimplementation Checklist

Updated: 2026-08-11

This checklist tracks implemented behavior in the Vue application. Reference
behavior and evidence remain tracked separately in
[`../docs/parity-checklist.md`](../docs/parity-checklist.md).

## Complete

- [x] Vue 3, strict TypeScript, Vite, PrimeVue, Pinia, Vue Query, Vitest, ESLint,
      and Prettier foundation
- [x] Responsive application shell, navigation, collection selector, light/dark
      theme, and mobile navigation
- [x] Typesense connection form, validation, protected routes, tab-scoped session
      restoration, and disconnect
- [x] Server status reads for health, version, metrics, stats, collections, and
      degraded permission states
- [x] Collection list, filter, empty/mobile states, create form/JSON modes, and
      confirmed deletion
- [x] Collection schema metadata, incremental field add/drop, missing-resource
      state, and collection deletion
- [x] Document JSON editor with schema-derived starter values and add-row action
- [x] Document `create`, `upsert`, and partial `update` batch imports
- [x] Per-row document success/failure results, JSON validation, JSON/JSONL file
      loading, and missing-resource state
- [x] Document browse-all and indexed-text search with result counts, page-size
      controls, pagination, and empty/error states
- [x] JSONL export, authoritative edit-by-ID handoff, and confirmed single-document
      deletion
- [x] Schema-derived string/boolean facets, numeric ranges, sortable fields, and
      safely rendered highlighted snippets
- [x] Unit/component coverage for current services and pages
- [x] Production build and document workflow verification on desktop and mobile

## Remaining

### Connection and Server

- [ ] Saved connection history and cluster tagging
- [ ] Cluster status and safe node switching
- [ ] Server operations: compact database, clear cache, slow-query threshold, and
      snapshots

### Collections and Documents

- [ ] Collection clone and aliases
- [ ] Unsaved document navigation guard
- [ ] Bulk/query document deletion with confirmation
- [ ] Large-file import progress, cancellation, and failed-row retry

### Search

- [ ] Facet-value search, stopword selection, max candidates, and advanced request
      controls
- [ ] Raw JSON search, response view/export, and per-collection history
- [ ] Invalid-parameter, timeout, and server-error recovery states

### Configuration

- [ ] API keys
- [ ] Analytics rules
- [ ] Search presets
- [ ] Stopword sets
- [ ] Stemming dictionaries
- [ ] Synonyms and synonym sets
- [ ] Overrides, curations, and curation sets

### Release Hardening

- [ ] Route-level end-to-end tests for all completed workflows
- [ ] Keyboard and accessibility audit
- [ ] Tablet and wide-screen responsive audit
- [ ] Multiple supported Typesense versions and multi-node cluster verification
- [ ] Initial bundle analysis and code-splitting improvements
- [ ] Hosting, deployment, migration, and rollback documentation
