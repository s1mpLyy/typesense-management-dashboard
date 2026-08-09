# Vue Reimplementation Plan

## Objective

Rebuild Typesense Dashboard as a clean Vue 3 application with the same Typesense
features and behavior as the existing project, while improving navigation,
information density, responsiveness, accessibility, loading states, and error
handling.

The existing application remains the source of truth for business logic until
each feature has a verified replacement.

## Selected Foundation

- Vue 3 with Composition API, `<script setup>`, and strict TypeScript
- Vite for development and production builds
- Vue Router for application navigation
- PrimeVue 4 styled mode with project-owned design tokens
- Lucide Vue for application icons
- Pinia for connection, session, and shared client state
- TanStack Vue Query for Typesense server state and mutations
- Zod and VeeValidate for runtime validation and forms
- Official Typesense JavaScript client behind typed domain services
- Monaco Editor for JSON and schema editing
- Vitest, Vue Test Utils, and MSW for unit and component tests
- Playwright for critical end-to-end workflows
- pnpm for dependency management
- ESLint and Prettier for code quality
- Tauri 2 as an optional desktop shell after web feature parity

The dashboard will remain a client-rendered SPA. Nuxt and SSR are intentionally
excluded because the application does not need SEO, connects directly to
user-selected Typesense nodes, and must remain deployable to static hosting.

See `STACK.md` for detailed ownership boundaries and rationale.

## Implementation Steps

### 1. Record the Current Behavior

- Create a feature-parity matrix for every route and user action.
- Capture the login, navigation, collection, search, and document workflows.
- Record Typesense version-dependent behavior and feature detection.
- List local-storage keys, default values, API payloads, and error cases.
- Mark bugs in the old UI separately so they are not reproduced as requirements.

Deliverable: an approved parity checklist used throughout the rewrite.

### 2. Scaffold the New Vue Application

- Initialize Vue 3, Vite, and TypeScript inside this directory.
- Add Vue Router, PrimeVue, Lucide Vue, Pinia, TanStack Vue Query, Zod,
  VeeValidate, and test tooling.
- Configure path aliases, environment variables, linting, formatting, and builds.
- Create a feature-oriented directory structure with separate application shell,
  domain services, stores, shared UI, and test support.
- Add continuous checks for type checking, linting, unit tests, and production
  builds.

Deliverable: a runnable application shell with automated quality checks.

### 3. Build the Design System and App Shell

- Define color, typography, spacing, border, elevation, and state tokens.
- Build the responsive sidebar, top bar, collection context selector, page
  header, breadcrumbs, and mobile navigation.
- Add reusable table, form, modal, confirmation, empty, loading, and error
  patterns.
- Support keyboard navigation, visible focus states, and accessible labels.
- Add light and dark themes only if both can be maintained consistently.

Deliverable: a polished, responsive shell ready for feature pages.

### 4. Migrate Connection and Session Logic

- Implement Typesense node configuration and client initialization.
- Rebuild login with API key, protocol, host, port, path, timeout, and advanced
  connection settings.
- Migrate connection history, cluster grouping, remembered settings, and logout.
- Keep API keys in memory or session storage by default. Persistent credential
  storage must be explicit and clearly explained to the user.
- Preserve local data compatibility where practical, but never expose API keys in
  logs, analytics, URLs, or error messages.
- Add clear validation, connection progress, failure messages, and retry actions.

Deliverable: verified login and session restoration against supported Typesense
servers.

### 5. Create the Typed API and Domain Layer

- Move Typesense access behind focused services instead of calling the client
  directly from pages.
- Use Pinia only for client-owned state and TanStack Vue Query for remotely owned
  Typesense data.
- Define shared request, response, and UI model types.
- Centralize error normalization, timeout handling, feature detection, and
  version compatibility.
- Add unit tests for payload construction and data transformations.
- Keep stores focused on shared state; keep page-only state inside pages or
  composables.

Deliverable: tested services that reproduce the current API behavior.

### 6. Implement Server and Cluster Features

- Server status, health, metrics, stats, and debug information
- Cluster status and node presentation
- Refresh controls, timestamps, loading skeletons, and degraded-state handling

Deliverable: server and cluster pages with parity tests.

### 7. Implement Collections and Documents

- Collection list, details, creation, schema editing, and deletion
- Collection aliases
- Document creation, editing, bulk import, export, and deletion
- Large-data tables with pagination, filtering, stable layouts, and safe
  destructive-action confirmations
- Schema-aware editors and JSON validation

Deliverable: complete collection and document administration workflows.

### 8. Implement Search

- Collection selection and search parameter controls
- Search results, highlighting, facets, sorting, pagination, and raw response view
- Persist useful page state without leaking credentials
- Handle empty queries, invalid fields, malformed parameters, and server errors

Deliverable: search behavior matching the current dashboard with improved result
inspection and control layout.

### 9. Implement Configuration Resources

- API keys
- Analytics rules
- Search presets
- Stopword sets
- Stemming dictionaries
- Synonyms and synonym sets
- Overrides, curations, and curation sets

Each resource should use consistent list, create, edit, delete, validation,
loading, empty, success, and failure patterns.

Deliverable: feature parity for every configuration route supported by the
connected Typesense version.

### 10. Harden the User Experience

- Add route-level error boundaries and recovery actions.
- Prevent accidental duplicate submissions and navigation with unsaved changes.
- Review responsive layouts at phone, tablet, laptop, and wide desktop sizes.
- Verify tables, editors, dialogs, menus, and long values never overlap or resize
  unpredictably.
- Audit accessibility and keyboard-only operation.
- Measure initial load and heavy-page performance, then optimize where evidence
  shows a problem.

Deliverable: production-quality behavior across expected devices and states.

### 11. Verify Parity and Prepare Migration

- Run the parity matrix against the old and new applications.
- Add Playwright coverage for login, collection management, document management,
  search, and representative configuration resources.
- Test against multiple supported Typesense versions and a multi-node cluster.
- Document configuration, local development, production build, hosting, and
  desktop packaging decisions.
- Switch deployment only after all required parity items pass; retain a rollback
  path during the first release.

Deliverable: a tested release candidate and deployment checklist.

## Suggested Delivery Order

1. Foundation and app shell
2. Login and connection management
3. Typed API layer
4. Server status and collections
5. Documents and search
6. Configuration resources
7. Accessibility, performance, and release verification

This order validates the highest-risk connection and data-management logic early,
then applies established UI and service patterns to the remaining resources.

## Definition of Done

- Every required route and action is represented in the parity matrix.
- Supported workflows produce equivalent Typesense API behavior.
- Loading, empty, success, validation, and error states are implemented.
- Destructive operations require clear confirmation.
- Type checking, linting, unit tests, end-to-end tests, and production builds pass.
- Primary workflows work on mobile and desktop without clipping or overlap.
- Setup, configuration, security considerations, and deployment are documented.
