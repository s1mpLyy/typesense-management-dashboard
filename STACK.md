# Technology and Architecture Decisions

## Selected Stack

| Concern | Selection | Purpose |
| --- | --- | --- |
| Application | Vue 3 and TypeScript | Type-safe component and feature development |
| Build | Vite | Fast local development and static production builds |
| Routing | Vue Router | Authenticated routes and collection-scoped navigation |
| UI system | PrimeVue 4 styled mode | Accessible, mature dashboard controls |
| Design | Project-owned semantic tokens | Consistent visual identity without Quasar coupling |
| Icons | Lucide Vue | Consistent, recognizable interface actions |
| Client state | Pinia | Connection, session, preferences, and current context |
| Server state | TanStack Vue Query | Fetching, caching, invalidation, retries, and mutations |
| Validation | Zod and VeeValidate | Shared runtime schemas and form validation |
| Typesense access | Typesense client plus typed REST adapter | Supported APIs and version-specific endpoints |
| Code editor | Monaco Editor | JSON documents, schemas, and raw responses |
| Unit testing | Vitest and Vue Test Utils | Services, composables, stores, and components |
| API mocking | MSW | Repeatable browser-level API behavior in tests |
| End-to-end testing | Playwright | Critical workflows and responsive visual checks |
| Package manager | pnpm | Reproducible and space-efficient dependency management |
| Desktop shell | Tauri 2, optional | Desktop packaging after web feature parity |

## Runtime Model

The application is a client-rendered SPA. It connects from the browser directly
to a Typesense node selected by the user. It must continue to work from static
hosting, including GitHub Pages-compatible deployments.

Nuxt and SSR are not part of the baseline. They would add a server rendering
model without improving a private operational dashboard that has no SEO
requirement. A backend-for-frontend can be evaluated separately if the product
later changes to a centrally hosted, multi-user service with SSO.

## State Ownership

Pinia owns only client-side state:

- Active connection profile and session status
- Current collection and navigation context
- UI preferences and explicitly remembered settings
- Typesense capability and version flags derived during connection

TanStack Vue Query owns server-side state:

- Collections, documents, aliases, and API keys
- Analytics rules, search presets, synonyms, curations, stopwords, and stemming
- Server health, metrics, debug information, and cluster state
- Mutation status, cache invalidation, refresh, and retry behavior

Feature pages must not copy remote resource lists into Pinia. This avoids stale
duplicate caches and keeps refresh behavior consistent.

## Typesense Boundary

Vue pages and components do not call the Typesense client or `fetch` directly.
They call feature queries and mutations, which depend on typed domain services.

The service layer is responsible for:

- Typesense client construction and node failover configuration
- REST calls for APIs not covered by the installed client version
- Version and capability detection
- Request and response typing
- Error normalization and timeout handling
- Preventing secrets from appearing in logs, URLs, and user-facing diagnostics

## Feature Structure

The application should be organized around product features rather than file
types alone:

```text
src/
  app/                 # Bootstrap, router, providers, and main layout
  components/ui/       # Shared project-owned UI patterns
  features/
    auth/
    server-status/
    clusters/
    collections/
    documents/
    search/
    aliases/
    api-keys/
    analytics-rules/
    search-presets/
    synonyms/
    curations/
    stopwords/
    stemming/
  services/typesense/  # Client, REST adapter, errors, and capabilities
  stores/              # Pinia stores for client-owned state
  styles/              # Tokens, theme preset, and global styles
  test/                # Test setup, factories, and mock handlers
```

Each feature may contain its own pages, components, schemas, query keys,
queries, mutations, types, and tests.

## Credential Security

- Keep API keys in memory for the active session.
- Use session storage for refresh recovery when required.
- Make persistent browser storage opt-in and explain its risk.
- Never place API keys in route parameters, query strings, logs, analytics, or
  copied diagnostic output.
- Prefer narrowly scoped Typesense keys where the required operation permits it.
- If a Tauri desktop build is added, use operating-system-backed secret storage
  instead of browser local storage.

Because the generic dashboard connects directly to arbitrary Typesense nodes, a
browser session must temporarily possess the supplied key. A future hosted
multi-user edition should use a backend proxy and normal user authentication
instead of exposing administrative credentials to the browser.

## UI Rules

- Use PrimeVue for complex controls and project components for repeated product
  patterns such as page headers, resource tables, editors, confirmations, and
  error states.
- Customize PrimeVue through semantic design tokens instead of scattered style
  overrides.
- Use Lucide icons for familiar actions and include tooltips for unfamiliar
  icon-only controls.
- Keep operational pages dense, predictable, and optimized for repeated use.
- Implement loading, empty, validation, success, failure, and permission-denied
  states for every resource workflow.
- Verify phone, tablet, laptop, and wide desktop layouts with Playwright.

## Desktop Packaging

Desktop packaging is deferred until the web application reaches feature parity.
Tauri 2 is the preferred option because the Vue application can remain a normal
Vite SPA while the desktop-specific security and filesystem capabilities stay in
a narrow platform layer.
