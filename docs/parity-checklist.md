# Feature-parity checklist

## Purpose

This checklist is the acceptance record for the Vue rewrite. The reference
application remains authoritative: an item can move to **Verified** only after
its behavior has been observed there and the evidence column has been filled
in. Items intentionally changed in the rewrite must link to a decision record
instead of silently changing behavior.

## Status and evidence

| Status             | Meaning                                                                                                             |
| ------------------ | ------------------------------------------------------------------------------------------------------------------- |
| To observe         | Expected surface inferred from the implementation plan; reference behavior has not been captured yet.               |
| Verified           | Reproduced in the reference application and backed by a screenshot, recording, source location, or request capture. |
| Version-gated      | Verified, but exposed only for recorded Typesense versions or capabilities.                                         |
| Intentional change | Reference behavior is understood and an approved replacement is documented.                                         |
| Not required       | Explicitly excluded from parity, with an explanation and approval.                                                  |

Evidence should be stored under `docs/parity-evidence/<item-id>/`. Do not store
API keys, authorization headers, document contents, hostnames, or other private
cluster data in evidence. Network captures must be sanitized before commit.

## Cross-cutting behavior

The following states must be checked for every applicable page or action, not
only for the representative rows below.

- [ ] Direct navigation and browser refresh restore the expected page.
- [ ] Loading prevents duplicate actions and leaves the layout stable.
- [ ] Empty data has a useful explanation and next action.
- [ ] Validation identifies the field or JSON location that needs attention.
- [ ] Permission, authentication, network, timeout, and server errors remain
      distinguishable and never reveal credentials.
- [ ] Success refreshes affected data and gives visible feedback.
- [ ] Destructive actions name the affected resource and require confirmation.
- [ ] Pagination, filters, sort order, and collection context behave consistently
      across navigation.
- [ ] Keyboard operation, focus order, accessible names, and narrow layouts have
      been recorded.

## Route and action matrix

Route paths are deliberately recorded as **TBD** until observed. This prevents
guessed URLs from becoming rewrite requirements.

| ID           | Area / route                      | Actions and states to capture                                                                                                                   | Expected API surface                                                | Status     | Evidence / notes                                                            |
| ------------ | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------- |
| AUTH-01      | Login (`TBD`)                     | Enter protocol, host, port, path, API key, timeout; toggle advanced settings; submit; invalid input; failed and successful connection           | health/debug or equivalent connection probe                         | To observe | Record defaults and whether each setting is optional.                       |
| AUTH-02      | Session restoration               | Refresh, reopen tab, select remembered connection, remove history entry, log out                                                                | connection probe after restoration                                  | To observe | Complete the storage inventory below before testing with a real key.        |
| NAV-01       | Application shell                 | Open every navigation group; collapse/expand; switch collection; use breadcrumbs; mobile navigation; direct URL                                 | collection list where selector is present                           | To observe | Capture labels, ordering, icons, active state, and responsive breakpoints.  |
| SERVER-01    | Server status (`TBD`)             | View health, version, stats, metrics, debug data; refresh; partial/degraded response                                                            | `/health`, `/stats.json`, `/metrics.json`, `/debug` as supported    | To observe | Record refresh interval and timestamp behavior.                             |
| CLUSTER-01   | Cluster (`TBD`)                   | View nodes and roles; refresh; unavailable node; single-node cluster                                                                            | `/operations/snapshot` or cluster/debug endpoints used by reference | To observe | Determine actual reference requests; do not treat this guess as a contract. |
| COLL-01      | Collections list (`TBD`)          | List, paginate/filter if present, open details, start create, delete with cancel/confirm                                                        | `GET /collections`, `DELETE /collections/:name`                     | To observe | Check long names and zero collections.                                      |
| COLL-02      | Create collection (`TBD`)         | Define name and fields; add/remove/reorder fields; configure default sort, nested fields, token separators/symbols; submit invalid/valid schema | `POST /collections`                                                 | To observe | Save exact payloads for simple and advanced schemas.                        |
| COLL-03      | Collection details/schema (`TBD`) | Inspect schema and metadata; copy values; edit supported schema settings; handle immutable fields                                               | `GET /collections/:name`, collection update endpoint when supported | To observe | Record version-dependent edit controls.                                     |
| ALIAS-01     | Collection aliases (`TBD`)        | List, create, update target, delete; missing target; duplicate alias                                                                            | `/aliases` and `/aliases/:name`                                     | To observe | Check whether aliases appear in collection selectors.                       |
| DOC-01       | Documents list (`TBD`)            | Browse, paginate, filter/search, change displayed fields, open document, copy ID                                                                | collection documents search endpoint                                | To observe | Record default page size, query, sort, and field formatting.                |
| DOC-02       | Create/edit document (`TBD`)      | Edit JSON; format; validate; create; update; cancel with dirty data                                                                             | `/collections/:name/documents` and `/:id`                           | To observe | Capture handling for inferred schema, arrays, nulls, and ID.                |
| DOC-03       | Import documents (`TBD`)          | Paste/upload JSONL; choose action/batch options; import; inspect partial failures; retry                                                        | `/collections/:name/documents/import`                               | To observe | Record limits, progress UI, and summary format.                             |
| DOC-04       | Export/delete documents (`TBD`)   | Export; delete one; delete by filter/query if present; cancel/confirm; failed deletion                                                          | export and delete endpoints                                         | To observe | Confirm download naming and whether export is streamed.                     |
| SEARCH-01    | Search (`TBD`)                    | Select collection; empty and non-empty query; select query fields; filter; facet; sort; page; highlight; inspect raw response                   | `/collections/:name/documents/search` or multi-search               | To observe | Capture request for default, facets, filters, and pagination.               |
| SEARCH-02    | Search state                      | Reload, back/forward, share/copy state, reset controls, malformed parameter                                                                     | same as SEARCH-01                                                   | To observe | Identify which settings are URL-, storage-, or memory-backed.               |
| KEY-01       | API keys (`TBD`)                  | List redacted keys; create scoped key; inspect/copy newly created value; delete                                                                 | `/keys`                                                             | To observe | Evidence must never contain a usable key. Record one-time visibility rules. |
| ANALYTICS-01 | Analytics rules (`TBD`)           | List, create/edit rule, validate parameters, delete                                                                                             | `/analytics/rules`                                                  | To observe | Record rule types exposed by each server version.                           |
| PRESET-01    | Search presets (`TBD`)            | List, create/edit JSON parameters, apply/view, delete                                                                                           | `/presets`                                                          | To observe | Capture named and inline preset validation.                                 |
| STOP-01      | Stopword sets (`TBD`)             | List, create/edit words and locale, delete                                                                                                      | `/stopwords`                                                        | To observe | Record locale defaults and normalization.                                   |
| STEM-01      | Stemming dictionaries (`TBD`)     | List, import/create/edit entries, delete                                                                                                        | stemming dictionary endpoints                                       | To observe | Record capability detection and import format.                              |
| SYN-01       | Synonyms (`TBD`)                  | Select collection; list, create one-way/multi-way synonym, edit, delete                                                                         | collection synonym endpoints                                        | To observe | Record legacy-versus-set UI by version.                                     |
| SYN-02       | Synonym sets (`TBD`)              | List/create/edit/delete set and entries; unsupported server                                                                                     | synonym-set endpoints                                               | To observe | Record the minimum supported version/capability response.                   |
| CUR-01       | Overrides / curations (`TBD`)     | Select collection; list, create/edit match conditions and includes/excludes, delete                                                             | collection override endpoints                                       | To observe | Record naming used by the UI versus API.                                    |
| CUR-02       | Curation sets (`TBD`)             | List/create/edit/delete set and entries; unsupported server                                                                                     | curation-set endpoints                                              | To observe | Record the minimum supported version/capability response.                   |

## Workflow captures

Complete these in order with a disposable local cluster and synthetic data.
Each capture must include the initial state, user steps, network request (method,
path, sanitized body), response class, visible result, and persisted state.

### W-01: Connect and navigate

1. Start with no saved application data.
2. Record every login default and validation message.
3. Attempt an unreachable node, a rejected key, and then a valid connection.
4. Refresh on the landing page and on a nested route.
5. Navigate every top-level entry, switch collection context, then log out.
6. Record storage changes after each step.

### W-02: Collection lifecycle

1. Create a schema containing string, numeric, boolean, array, optional, faceted,
   sortable, and nested fields where supported.
2. Inspect the resulting details page and collection list.
3. Attempt invalid and duplicate schemas.
4. Exercise every supported schema update.
5. Cancel a deletion, confirm it, and record dependent-resource behavior.

### W-03: Document lifecycle

1. Create a document, then create one that fails schema validation.
2. Edit and save a document; navigate away with unsaved changes.
3. Import mixed valid/invalid JSONL and inspect row-level errors.
4. Browse/filter/paginate, export, delete one document, and exercise any bulk
   deletion supported by the reference UI.

### W-04: Search

1. Run an empty/default search and a text query.
2. Add facets, filters, sorting, highlighting, pagination, and advanced options
   one at a time, saving the request delta for each.
3. Trigger invalid-field, malformed-filter, no-results, timeout, and server-error
   states.
4. Reload and use browser back/forward to establish persistence behavior.

### W-05: Configuration resources

For every resource row above, capture list, empty, create, validation, edit,
delete-cancel, delete-confirm, unsupported-version, forbidden, and server-error
states. Use unique synthetic identifiers so cleanup can be verified.

## Version and capability matrix

Fill one column per tested server release. The version set must include the
oldest supported release, the current production release, and the intended
latest release before this phase can be approved.

| Capability                                | Oldest (`TBD`) | Production (`TBD`) | Latest (`TBD`) | Detection evidence |
| ----------------------------------------- | -------------- | ------------------ | -------------- | ------------------ |
| Server version source and parsing         | To observe     | To observe         | To observe     |                    |
| Collection schema update                  | To observe     | To observe         | To observe     |                    |
| Nested fields                             | To observe     | To observe         | To observe     |                    |
| Analytics rules                           | To observe     | To observe         | To observe     |                    |
| Stopword sets                             | To observe     | To observe         | To observe     |                    |
| Stemming dictionaries                     | To observe     | To observe         | To observe     |                    |
| Synonym sets versus collection synonyms   | To observe     | To observe         | To observe     |                    |
| Curation sets versus collection overrides | To observe     | To observe         | To observe     |                    |
| Metrics/stats/debug endpoints             | To observe     | To observe         | To observe     |                    |

## Browser storage and defaults inventory

Never paste a credential value into this file. Record only key names, value
shape, lifetime, and behavior.

| Storage        | Key | Value shape / default | Written when | Cleared when | Status / evidence |
| -------------- | --- | --------------------- | ------------ | ------------ | ----------------- |
| localStorage   | TBD | TBD                   | TBD          | TBD          | To observe        |
| sessionStorage | TBD | TBD                   | TBD          | TBD          | To observe        |
| cookie         | TBD | TBD                   | TBD          | TBD          | To observe        |
| URL state      | TBD | TBD                   | TBD          | TBD          | To observe        |
| memory only    | TBD | TBD                   | TBD          | TBD          | To observe        |

## Payload and failure inventory

Create one row for every distinct request shape observed. Sanitized fixtures may
be stored beside the evidence and linked here.

| Matrix ID | Method and path template | Default query/body fields | Success response used by UI | Failure cases observed | Evidence |
| --------- | ------------------------ | ------------------------- | --------------------------- | ---------------------- | -------- |
| TBD       | TBD                      | TBD                       | TBD                         | TBD                    | TBD      |

At minimum, observe offline/DNS failure, refused connection, TLS/CORS failure,
timeout, 400 validation, 401/403 authentication or authorization, 404 missing
resource, 409/duplicate where applicable, 429 throttling, and 5xx/malformed
response. Record the reference UI's message and recovery action separately from
the raw response.

## Reference bug and intentional-change register

A surprising behavior is not automatically a requirement. Log it here, link its
evidence, and get a disposition before implementation.

| ID      | Related matrix ID | Reference behavior | User impact | Disposition             | Approval / evidence |
| ------- | ----------------- | ------------------ | ----------- | ----------------------- | ------------------- |
| BUG-TBD | TBD               | TBD                | TBD         | Reproduce / fix / defer | TBD                 |

## Phase-one approval gate

Phase one is complete only when:

- [ ] Every route and user action has a matrix row and observed route path.
- [ ] W-01 through W-05 have sanitized evidence.
- [ ] Storage key names, shapes, defaults, and deletion behavior are complete.
- [ ] Representative success and failure payloads are recorded.
- [ ] Version-dependent controls and their detection mechanism are verified on
      the agreed server versions.
- [ ] Suspected reference bugs have an explicit disposition.
- [ ] Product and engineering reviewers have approved this checklist.

Approval: **Not yet requested — observation evidence is still required.**
