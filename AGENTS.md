# Agents — Coding Conventions

This file documents the conventions enforced by Biome (linter/formatter) and other project tooling.

---

## ⚠️ Golden Rule: No Direct Commits

**Never commit directly to the repo.** All changes must be presented to the user for review and approval before any commit is made. The agent stages edits, presents the diff, and waits for the user to confirm before committing.

---

## 🧹 Code Style (Enforced by Biome)

### ES6+ Syntax Only

- **Arrow functions over `function` keyword** — `const fn = () => {}` not `function fn() {}`
  - Rule: `complexity/useArrowFunction` (autofix)
  - Exceptions: class methods (`class Foo { method() {} }`) are allowed
- **`const` over `let`** — `useConst` (autofix)
- **No `var`** — `suspicious/noVar` (autofix)
- **Template literals over string concat** — `style/useTemplate` (autofix)
- **No double equals** — use `===` / `!==`

### Imports

- **Path aliases** — use `@/` instead of relative `../../` paths
  - `@/*` maps to `./src/*` within each workspace package
  - Example: `import { z } from 'zod'` stays as-is (npm package)
  - Example: `import { PROVIDERS } from '@/types'` (internal alias)
- **No `.js` extensions** in TypeScript imports — `import from '@/types'` not `'@/types.js'`
- **Organize imports** automatically on save (Biome `assist/organizeImports`)
- **Single quotes** for strings, including import paths
- **Semicolons** always

### Formatting

| Setting | Value |
|---------|-------|
| Indent style | tabs |
| Indent width | 2 |
| Line width | 120 |
| Quotes | single |
| Semicolons | always |

---

## 🔧 Tooling

### Constants & Environment

- All env-derived values go in `apps/web/src/constants.ts` and are imported via `@/constants`
- Never inline `process.env.*` checks — add a named constant in `@/constants`

### Biome

- Config: [`biome.json`](./biome.json)
- Run: `pnpm biome check .`
- Auto-fix: `pnpm biome check --write .`
- Format only: `pnpm biome format --write .`

### Husky (pre-commit hook)

- Runs `pnpm lint-staged` before every commit
- `lint-staged` runs `biome check --write` on staged JS/TS files
- Config: [`.husky/pre-commit`](./.husky/pre-commit)

### TypeScript

- Config: [`tsconfig.base.json`](./tsconfig.base.json)
- Module: `ESNext`, resolution: `bundler`
- Path aliases configured per-package in their own `tsconfig.json`
- Build: `tsc && tsc-alias` (rewrites `@/*` → relative paths in output)

---

## 📐 Schema Layer

All Zod schemas live in `src/schemas/`. **Never import `zod` directly in a component, hook, service, or API route.**

### Rules

- One file per domain: `src/schemas/<domain>.schema.ts`
- Define the full object schema first, derive field schemas from `.shape`
- Export an inferred `type` from the schema — never write the interface manually
- API routes, services, forms, and hooks all import from `@/schemas/<domain>.schema`

```ts
// src/schemas/example.schema.ts
import { z } from 'zod';

export const exampleSchema = z.object({
  name: z.string().min(1, 'Required'),
  email: z.string().min(1, 'Required').email('Enter a valid email'),
});

export type ExamplePayload = z.infer<typeof exampleSchema>;

// Field schemas for TanStack Form validators — always derived, never duplicated
export const exampleNameSchema = exampleSchema.shape.name;
export const exampleEmailSchema = exampleSchema.shape.email;
```

### File Naming

| Location | Convention |
|----------|------------|
| `src/schemas/<domain>.schema.ts` | kebab-case, `.schema.ts` suffix |

---

## 🏗️ Data-Fetching Architecture

All server communication follows a strict three-layer pattern: **Service → Hook → Component**.
Never call `fetch` directly inside a component or hook.

### Layer 1 — Service (`src/services/<domain>.service.ts`)

- ES6 class that owns the API calls for one domain.
- Instantiates `ApiService` from `@/services/index` (never raw `fetch`).
- Throws typed domain errors (e.g. `WaitlistError`) so TanStack Query can surface them.
- Exports a singleton instance **and** `mutationOptions` / `queryOptions` helpers.

```ts
import { mutationOptions } from '@tanstack/react-query';
import { ApiService } from '@/services/index';
import { TAGS } from '@/services/tags';

const api = new ApiService();

export class ExampleService {
  private readonly api: ApiService;

  constructor() {
    this.api = api;
  }

  async doSomething(payload: Payload): Promise<void> {
    logger.info({ payload }, 'Doing something');
    const result = await this.api.post<{ ok: boolean }>('/api/example', payload);
    if (result.isError) throw new ExampleError(result.error);
  }

  doSomethingMutationOptions() {
    return mutationOptions({
      mutationKey: TAGS.example.all,
      mutationFn: (payload: Payload) => this.doSomething(payload),
    });
  }
}

export const exampleService = new ExampleService();
```

### Layer 2 — Tags (`src/services/tags.ts`)

Central registry for all TanStack Query cache keys. Every domain registers its keys here.

```ts
export const TAGS = {
  example: {
    all: ['example'] as const,
    detail: (id: string) => [...TAGS.example.all, id] as const,
  },
} as const;
```

### Layer 3 — Hook (`src/hooks/use-<domain>-<action>.ts`)

- **File names must be kebab-case**: `use-waitlist-mutation.ts`, not `useWaitlistMutation.ts`.
- Wraps `useMutation` or `useQuery` using the service's pre-built options.
- Handles cache invalidation via `queryClient.invalidateQueries`.
- The component receives only the hook's return value — no raw service calls.

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { TAGS } from '@/services/tags';
import { exampleService } from '@/services/example.service';

export const useExampleMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    ...exampleService.doSomethingMutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TAGS.example.all });
    },
  });
};
```

### File Naming Summary

| Layer | Location | Convention |
|-------|----------|------------|
| Tags | `src/services/tags.ts` | Single file, all domains |
| Service | `src/services/<domain>.service.ts` | kebab-case |
| Hook | `src/hooks/use-<domain>-<action>.ts` | kebab-case, `use-` prefix |
| ApiService | `src/services/index.ts` | Base HTTP client, used only by services |

---

## 🚫 What Not To Do

- ❌ **No direct commits** — always confirm with the user before committing
- ❌ No `function` keyword declarations (use arrow functions or class methods)
- ❌ No `var`
- ❌ No `.js` extensions in import paths
- ❌ No deep relative imports like `../../types` (use `@/types` instead)
- ❌ No double equals (`==`)
- ❌ No inline `process.env.*` checks — add a named constant in `@/constants` instead
- ❌ No `import { z } from 'zod'` outside of `src/schemas/` — define schemas there and import the schema/type everywhere else
- ❌ No manually written interfaces for validated payloads — always use `z.infer<typeof schema>`
- ❌ No raw `fetch` in components or hooks — go through a `Service` class
