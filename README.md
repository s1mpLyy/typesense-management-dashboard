# Typesense Dashboard Vue Reimplementation

This directory is the isolated workspace for the new dashboard. The existing
application in the repository root remains the reference implementation for
behavior, API calls, and feature parity.

See [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) for the delivery steps and
completion criteria. Phase-one behavior discovery is tracked in the
[feature-parity checklist](./docs/parity-checklist.md), while
[IMPLEMENTATION_CHECKLIST.md](./IMPLEMENTATION_CHECKLIST.md) tracks completed and
remaining Vue features. See [STACK.md](./STACK.md) for the selected technologies,
architecture boundaries, and security decisions.

## Current Status

The Vue 3 scaffold, responsive shell, connection flow, server status, collection
administration, schema editing, document batch import, and document search are
implemented. Unmigrated routes remain visible as placeholders.

The parity checklist remains the source of truth for feature behavior. Its
outstanding evidence and bug dispositions block migration approval, but do not
block foundation and shell development.

## Local Development

Requirements: Node.js 20.19 or newer and pnpm 11.16.

```sh
pnpm install
pnpm dev
```

Run the complete local quality gate with:

```sh
pnpm check
pnpm build
```

The current foundation includes Vue 3, strict TypeScript, Vite, Vue Router,
PrimeVue 4, Lucide Vue, Pinia, TanStack Vue Query, Zod, VeeValidate, the
Typesense client, Vitest, MSW, and Playwright.
