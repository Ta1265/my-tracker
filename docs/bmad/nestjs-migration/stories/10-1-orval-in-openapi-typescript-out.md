# Story 10.1: Orval in, `openapi-typescript` out

Status: Done

## Context

First story of the epic and the only one that edits backend source (architecture,
"Epic 10 - the generated client": "10.1 is the only story that edits backend source, and
it must land first and complete"). It fixes the spec itself - explicit `operationId`s and
the `TransactionAddRequestDto.unit` deletion - regenerates `backend/openapi.json` from
those fixes, then installs and configures Orval against the corrected snapshot. Nothing
consumes the generated output yet: `frontend/types/api.d.ts` and
`frontend/types/contracts.ts` stay in place and keep compiling, and
`scripts/generate-api-contract.mjs` and both Dockerfiles are untouched (story 10.3's job).
Story 10.2 depends on this story's `frontend/src/api/http-client.ts` stub existing, since
Orval's config points at it and needs it to load.

**Expected transient breakage, not a defect to chase**: this story removes the
`openapi-typescript` devDependency, which `scripts/generate-api-contract.mjs`'s
`--only=types` half still imports and `frontend/Dockerfile`'s `builder` stage still
calls. `TARGET=prod docker compose build` for the frontend image is expected to fail
between this story landing and story 10.3 fixing it. `docker compose up` (the `dev`
target, which the day-to-day dev loop uses) is unaffected - it never invokes the script.

## Acceptance Criteria

### A. Explicit `operationId` on all 22 controller methods (D50)

- [x] Add `operationId: '<name>'` to every `@ApiOperation({ ... })` call below. Three of
  the 22 currently have `@ApiOperation` with no `operationId` at all
  (`auth.controller.ts:75` logout, `auth.controller.ts:86` session,
  `transactions.controller.ts:23` addTransaction, `transactions.controller.ts:61`
  deleteTransaction - four, not three); `health.controller.ts`'s `@Get()` at line 5 has
  no `@ApiOperation` decorator at all and needs one added with only `operationId:
  'health'`. Every other method already carries `@ApiOperation({ description: ... })` -
  add `operationId` as a sibling key, do not touch `description`.

  | Method and spec path | File | `operationId` |
  | --- | --- | --- |
  | GET `/health` | `backend/src/health/health.controller.ts:5` | `health` |
  | POST `/auth/login` | `backend/src/auth/auth.controller.ts:33` | `login` |
  | POST `/auth/logout` | `backend/src/auth/auth.controller.ts:75` | `logout` |
  | GET `/auth/session` | `backend/src/auth/auth.controller.ts:86` | `authSession` |
  | POST `/transaction/add` | `backend/src/transactions/transactions.controller.ts:23` | `addTransaction` |
  | DELETE `/transaction/{id}` | `backend/src/transactions/transactions.controller.ts:61` | `deleteTransaction` |
  | GET `/summary/coins` | `backend/src/summary/summary.controller.ts:27` | `coinSummaries` |
  | GET `/summary/portfolio` | `backend/src/summary/summary.controller.ts:38` | `portfolioSummary` |
  | GET `/summary/profitLossChart` | `backend/src/summary/summary.controller.ts:57` | `profitLossChart` |
  | GET `/summary/profitLossChart/{timeFrame}` | `backend/src/summary/summary.controller.ts:76` | `profitLossChartByTimeFrame` |
  | GET `/summary/{unit}` | `backend/src/summary/summary.controller.ts:96` | `coinSummariesByUnit` |
  | GET `/stats/{unit}` | `backend/src/stats/stats.controller.ts:15` | `statsByUnit` |
  | GET `/product/{product}` | `backend/src/product/product.controller.ts:15` | `productTransactions` |
  | GET `/exchange-rates/{timeFrame}/{coinName}` | `backend/src/exchange-rates/exchange-rates.controller.ts:12` | `coinPriceHistory` |
  | GET `/exchange-rates/unit/{unit}` | `backend/src/exchange-rates/exchange-rates.controller.ts:28` | `exchangeRatesByUnit` |
  | GET `/price-history/check` | `backend/src/price-history/price-history.controller.ts:16` | `priceHistoryCheck` |
  | POST `/price-history/set` | `backend/src/price-history/price-history.controller.ts:38` | `setPriceHistory` |
  | GET `/time-frame-coins-pl/{timeFrame}` | `backend/src/time-frame-pl/time-frame-coins-pl.controller.ts:28` | `timeFrameCoinsPl` |
  | GET `/time-frame-total-pl/{timeFrame}` | `backend/src/time-frame-pl/time-frame-total-pl.controller.ts:16` | `timeFrameTotalPl` |
  | GET `/token-info/{userId}` | `backend/src/token-info/token-info.controller.ts:23` | `tokenInfoSync` |
  | GET `/token-info/search/{searchTerm}` | `backend/src/token-info/token-info.controller.ts:60` | `tokenInfoSearch` |
  | GET `/metrics` | `backend/src/metrics/metrics.controller.ts:9` | `metrics` |

  Two entries are deliberate, do not "fix" them to look more regular: **`authSession`**
  (not `session`) avoids colliding with `next-auth/react`'s own `useSession`, which
  `LoginClient.tsx` and the nav components still call until Epic 7; **`coinPriceHistory`**
  (not `priceHistory`) avoids colliding with `/price-history/check` in a different
  controller, and matches the existing `useFetchCoinPriceHistory` call site's name.

### B. Delete the phantom `unit` field (D59)

- [x] `backend/src/transactions/dto/transaction-add-request.dto.ts:26-29` - delete the
  `unit` property (`@ApiProperty({ example: 'BTC' }) @IsOptional() @IsString() unit!:
  string;`) entirely. The route derives `unit` server-side from the `token_id` lookup and
  no caller sends it; leaving it on the DTO would put an unfillable optional field on the
  generated request model.

### C. Regenerate the snapshot from A and B

- [x] Run `pnpm --filter @portfolio/backend build && node scripts/generate-api-contract.mjs
  --only=spec` and commit the regenerated `backend/openapi.json`. Confirm by inspection
  that all 22 `operationId`s from section A's table appear in the new snapshot and that
  `TransactionAddRequestDto`'s schema no longer has a `unit` property.
- [x] `pnpm --filter @portfolio/backend typecheck && pnpm --filter @portfolio/backend
  lint` both pass with no new errors.

### D. Dependency swap and the F2 measurement

- [x] Remove `openapi-typescript` from the root `package.json` `devDependencies` and add
  `orval` (pin whatever version resolves at install time). Root `package.json`'s three
  `spec:*` scripts are **not edited** in this story - they still invoke
  `scripts/generate-api-contract.mjs`, whose `--only=types` half still calls
  `openapi-typescript` and will now fail; that failure is expected and left for story
  10.3, per the Context note above. Do not patch around it here.
- [x] Remove `react-query` from `frontend/package.json:64` (the deprecated pre-TanStack
  package; `@tanstack/react-query@^5.62.0` is the one actually imported anywhere under
  `frontend/src` - confirm with `grep -rn "from 'react-query'" frontend/src` returning no
  hits before removing, and paste the empty result in Dev Notes).
- [x] Run `pnpm why supports-color` at the repo root before making the dependency swap
  (record the output - Epic 9 already moved it from `8.1.1` to `10.2.2` via
  `openapi-typescript`) and again after `pnpm install` with the swap applied. State
  plainly in Dev Notes whether removing `openapi-typescript` and adding `orval` resolves
  Epic 9's open advisory F2, makes it worse (a different or additional transitive move),
  or leaves it unchanged. Note anything else in the backend production closure
  (`@nestjs/core`, `@nestjs/swagger`, `bcrypt`, `nest-winston`, `nestjs-cls`) that moved
  version as a side effect of the swap.

### E. Orval configuration

- [x] Create `orval.config.ts` at the repo root:
  ```ts
  import { defineConfig } from 'orval';

  export default defineConfig({
    portfolio: {
      input: { target: './backend/openapi.json' },
      output: {
        mode: 'single',
        target: './frontend/src/api/generated.ts',
        client: 'react-query',
        httpClient: 'fetch',
        prettier: false,
        clean: false,
        tsconfig: './tsconfig.base.json',
        override: {
          mutator: { path: './frontend/src/api/http-client.ts', name: 'httpClient' },
          enumGenerationType: 'union',
        },
      },
    },
  });
  ```
  Every setting here is load-bearing (architecture D49, D52, D53, D57) - do not change
  any of them without re-reading the architecture rationale first:
  - `clean: false` **must stay false**. `output.clean` deletes the target directory
    before writing, and the mutator lives in that same directory - a `clean: true` run
    was verified during the architecture spike to delete `http-client.ts` outright.
  - `tsconfig: './tsconfig.base.json'`, named explicitly, not left to discovery. Orval
    transpiles the mutator through esbuild using whatever tsconfig it finds; discovery
    can land on `frontend/tsconfig.json`, whose `target: es5` downlevels the mutator's
    async functions for reasons that have nothing to do with the API contract.
    `tsconfig.base.json` sets no `target` at all, which is correct here.
  - `prettier: false`. The committed bytes must be reproducible in two Docker images; a
    formatter is a second thing that can drift between the images and fail a build for a
    reason unrelated to the contract.
- [x] Add `frontend/src/api/generated.ts` to the root `.prettierignore` and to
  `frontend/.eslintignore` (both files already exist at the repo root and under
  `frontend/` respectively). Without this, an editor's format-on-save or a `lint --fix`
  silently invalidates story 10.3's byte-compare.

### F. Minimal mutator stub

- [x] Create `frontend/src/api/http-client.ts` exporting a function named `httpClient`
  with whatever signature Orval's `httpClient: 'fetch'` output expects (confirm the exact
  shape by reading the `import { httpClient } from './http-client';` call sites Orval
  emits into `generated.ts` in the next step, rather than guessing it up front). This
  story's implementation is intentionally minimal: perform the request with `fetch`
  against the URL Orval passes in, unchanged (no path rewriting yet), parse and return
  the JSON body, and throw an `Error` on a non-2xx response. **This is a placeholder** -
  story 10.2 replaces the body with the full FR-25 seam (URL rewriting keyed on
  `NEXT_PUBLIC_API_TARGET`) and the error-body-lifting behavior D51 requires. Do not
  build either of those here; this story only needs enough for Orval to generate against
  and for the stub to compile and pass `tsc`.

### G. Generate and commit

- [x] Run Orval directly: `pnpm exec orval --config orval.config.ts`. Confirm
  `frontend/src/api/generated.ts` is written with 22 exported operation functions and 22
  exported `use*` hooks, matching section A's table one-to-one by name.
- [x] Run it a second time with no source change between runs; diff the two outputs and
  confirm byte-identical. Record the file size and the diff result in Dev Notes.
- [x] Commit `frontend/src/api/generated.ts` and `frontend/src/api/http-client.ts`.

### H. Verification, nothing else moved

- [x] `frontend/types/api.d.ts` and `frontend/types/contracts.ts` are unedited and every
  existing consumer of them still compiles unchanged - this story adds a second,
  unconsumed generated file alongside the Epic 9 ones, it does not touch them.
- [x] `pnpm --filter @portfolio/frontend exec tsc --noEmit -p tsconfig.json` - record the
  total error count before and after this story's changes. The two new files
  (`generated.ts`, `http-client.ts`) must contribute zero errors of their own; any
  pre-existing count (currently 15, per story 9.6's Dev Notes) is otherwise unchanged.
- [x] `pnpm install --frozen-lockfile` succeeds from a clean state after the dependency
  swap.

## Technical Notes

- `backend/src/openapi/document.ts` exports `GLOBAL_PREFIX` and
  `createOpenApiDocumentBuilder()`, both already wired into `main.ts` and into
  `scripts/generate-api-contract.mjs`'s `--only=spec` half (story 9.2) - regenerating the
  spec in section C uses this unchanged path, nothing new to wire.
- `scripts/generate-api-contract.mjs`'s `--only=spec` half does not touch
  `openapi-typescript` at all - only `generateTypesDeclaration()` (the `--only=types`
  half) does. Regenerating the spec in section C is unaffected by the section D
  dependency swap; do them in either order, but the AC lists C before D so the committed
  snapshot never briefly contains stale `operationId`s.
- Orval's spike-measured generation time is 0.39 seconds per run on this spec (22
  operations, 20 component schemas), byte-stable across consecutive runs with no source
  change - the same property `backend/openapi.json` generation already has (story 9.2).
- `pnpm-workspace.yaml` lists `frontend`, `backend`, `packages/*` as members - the repo
  root is not itself a workspace member, so root devDependencies (including `orval`, like
  `openapi-typescript` before it) install regardless of any `--filter`.

## Out of Scope

- The FR-25 seam logic (path rewriting, `NEXT_PUBLIC_API_TARGET`) and the D51
  error-body-lifting requirement in the mutator - story 10.2.
- Wiring `--only=client` into `scripts/generate-api-contract.mjs`, updating either
  Dockerfile, or deleting `frontend/types/api.d.ts` - story 10.3.
- Any frontend consumer adopting a generated hook or operation function - stories
  10.4-10.6.
- Fixing the transient `TARGET=prod docker compose build` breakage this story causes -
  expected and resolved by story 10.3, per the Context note.

## Dev Notes

`grep -rn "from 'react-query'" frontend/src` returned no hits before `react-query` was
removed from `frontend/package.json`:

```
$ grep -rn "from 'react-query'" frontend/src
$
```

`pnpm why supports-color` before the swap showed three resolved versions - `7.2.0` (via
`eslint`'s `chalk`), `8.1.1` (via `webpack`'s `jest-worker`), and `10.2.2` (via `debug`,
reached both through pre-existing `eslint`/`@babel` chains and through
`openapi-typescript` -> `@redocly/openapi-core` -> `https-proxy-agent@7.0.6` -> `debug`).
After the swap the same three versions are still present - `7.2.0` and `8.1.1` unchanged,
`10.2.2` still resolved because `debug@4.4.3`'s other consumers (`eslint@9.39.5`,
`@babel/traverse`, etc.) already pulled it in independently of `openapi-typescript`. The
`https-proxy-agent@7.0.6` branch is gone (no more `@redocly/openapi-core`), and a new
`@orval/core@8.26.0` branch appears under the same `debug@4.4.3` node instead. **F2 is
unchanged, not resolved and not worsened**: the version stays `10.2.2` and the node count
under it is the same, only the package responsible for pulling it in moved from
`openapi-typescript` to `orval`. `git diff pnpm-lock.yaml` shows no version change for
`@nestjs/core`, `@nestjs/swagger`, `bcrypt`, `nest-winston`, or `nestjs-cls` - none of them
moved as a side effect of the swap.

`pnpm add -w -D orval` resolved `orval@8.26.0`, pinned exactly (no caret) to match the
`openapi-typescript` entry it replaced. The install also surfaced a new
`esbuild@0.28.2` transitive postinstall (Orval transpiles the mutator through esbuild) that
pnpm ignores by default; `pnpm-workspace.yaml`'s `allowBuilds` already listed `esbuild` with
a placeholder pnpm had written during the `pnpm add`, set to `true` here so the native
binary installs and Orval can actually run.

Orval generation was run twice with no source change between runs: both produced a
65,782-byte `frontend/src/api/generated.ts`, and `diff` between the two outputs reported no
differences (byte-identical). The file exports all 22 operation functions and all 22
`use*` hooks (17 query hooks plus 5 mutation hooks - `useLogin`, `useLogout`,
`useAddTransaction`, `useDeleteTransaction`, `useSetPriceHistory`), matching section A's
table one-to-one by name.

`frontend/src/api/http-client.ts`'s `httpClient<T>(url: string, options?: RequestInit):
Promise<T>` signature matches exactly what Orval's `generated.ts` calls
(`httpClient<...Response>(getXUrl(), { ...options, method, headers?, body? })`), confirmed
by reading the emitted call sites before finalizing the stub.

**Epic fix round addendum**: `backend/openapi.json` (committed by this story) and its
`orval.config.ts` `input.target: './backend/openapi.json'` were both replaced by an
epic-level owner-feedback round - Orval now reads the backend's live Swagger JSON
directly, and the spec file is no longer committed. See the epic's Review Notes for
the full change and its port-conflict deviation.

### Changed Files

+ backend/src/health/health.controller.ts          add `operationId: 'health'`
+ backend/src/auth/auth.controller.ts               add `login`/`logout`/`authSession` operationIds
+ backend/src/transactions/transactions.controller.ts   add `addTransaction`/`deleteTransaction` operationIds
~ backend/src/transactions/dto/transaction-add-request.dto.ts   delete the phantom `unit` property (D59)
~ backend/src/summary/summary.controller.ts         add 4 operationIds (coinSummaries, portfolioSummary, profitLossChart, profitLossChartByTimeFrame, coinSummariesByUnit)
~ backend/src/stats/stats.controller.ts              add `statsByUnit` operationId
~ backend/src/product/product.controller.ts          add `productTransactions` operationId
~ backend/src/exchange-rates/exchange-rates.controller.ts   add `coinPriceHistory`/`exchangeRatesByUnit` operationIds
~ backend/src/price-history/price-history.controller.ts   add `priceHistoryCheck`/`setPriceHistory` operationIds
~ backend/src/time-frame-pl/time-frame-coins-pl.controller.ts   add `timeFrameCoinsPl` operationId
~ backend/src/time-frame-pl/time-frame-total-pl.controller.ts   add `timeFrameTotalPl` operationId
~ backend/src/token-info/token-info.controller.ts    add `tokenInfoSync`/`tokenInfoSearch` operationIds
~ backend/src/metrics/metrics.controller.ts          add `metrics` operationId
~ backend/openapi.json                               regenerated from the operationId and `unit`-deletion fixes
~ package.json                                       swap `openapi-typescript` devDependency for `orval@8.26.0`
~ frontend/package.json                              remove the deprecated `react-query@^3.39.3`
~ pnpm-lock.yaml                                     reflects the dependency swap and removal
~ pnpm-workspace.yaml                                allow `esbuild`'s postinstall so Orval's mutator transpile works
+ orval.config.ts                                    Orval config: single-file output, fetch client, react-query hooks, `./http-client` mutator
~ .prettierignore                                    ignore the generated Orval output
~ frontend/.eslintignore                              ignore the generated Orval output
+ frontend/src/api/generated.ts                      Orval-generated operation functions and TanStack Query hooks (never edited)
+ frontend/src/api/http-client.ts                     minimal fetch-based mutator stub Orval's generated code calls through

### Verification

- `pnpm --filter @portfolio/backend build && node scripts/generate-api-contract.mjs --only=spec`
  - Ran clean, wrote `backend/openapi.json`. Inspected the regenerated file: all 22
    `operationId`s from section A's table are present (verified via a Python script
    listing every `paths.*.*.operationId`), and `components.schemas.TransactionAddRequestDto.properties`
    no longer includes `unit` (now `['token_id', 'side', 'size', 'price', 'fee', 'date',
    'notes']`).
- `pnpm --filter @portfolio/backend typecheck` - passed, no errors.
- `pnpm --filter @portfolio/backend lint` - passed; one pre-existing warning in
  `main.ts` (`@typescript-eslint/no-floating-promises`), unrelated to this story, no new
  errors or warnings.
- `pnpm exec orval --config orval.config.ts` (run twice, no source change between runs) -
  `frontend/src/api/generated.ts` written both times at 65,782 bytes; `diff` between the
  two outputs was empty (byte-identical).
- `pnpm --filter @portfolio/frontend exec tsc --noEmit -p tsconfig.json` - 15 errors,
  matching the pre-existing baseline recorded in story 9.6's Dev Notes. None of the 15
  are in `generated.ts` or `http-client.ts` (confirmed via grep on the error output).
- `pnpm --filter @portfolio/frontend lint` - exit 0, warnings only (all pre-existing,
  none referencing `generated.ts` or `http-client.ts`, confirming the `.eslintignore`
  entry took effect).
- `pnpm install --frozen-lockfile` - succeeded from the post-swap state ("Already up to
  date").
- `git status --porcelain frontend/types/` - empty; `frontend/types/api.d.ts` and
  `frontend/types/contracts.ts` are unedited.
- Not run: `TARGET=prod docker compose build` for the frontend image. Per the story's
  Context note, this is expected to fail until story 10.3 re-points
  `scripts/generate-api-contract.mjs` and the Dockerfile away from `openapi-typescript`;
  chasing that failure here would be out of this story's scope.
