# Epic 9: Generated API types - one enforced response contract

Status: Complete

Stories: 9.1, 9.1a, 9.1b, 9.2, 9.3, 9.4, 9.4a, 9.5, 9.6, 9.7
Depends on: 4
Base commit: 835741b8d6849225ce51d90370ffe2f6b57f4447
## Scope

Make the backend's OpenAPI document the single source of truth for the frontend's
TypeScript view of every response, and make a stale copy fail the build (FR-20 to FR-23,
NFR-6). Runs fifth in execution order - after Epic 4, before Epics 5 and 6, both of which
now depend on it (`prd.md`'s `## Execution graph`). Story 9.4a is the story the epic
exists for: it wires FR-21's staleness check into the two production Docker builds. Story
9.4, which lands first, carries D40's reversal of story 1.6's backend lint enforcement out
of the same Dockerfile so 9.4a's edits land clean. Stories 9.1, 9.1a, and 9.1b reconcile
the contract and fix what the diff found; 9.2-9.3 build the generation pipeline; 9.5-9.7
adopt it and shrink `packages/shared` to FR-22's boundary. Nothing here changes a response
byte or moves the frontend off the Next.js routes - that's Epic 7.

## Gate

<!-- No gate. The Owner Review reads the diff: the reconciliation table and DTO
corrections from 9.1/9.1a/9.1b, the pipeline scripts and Dockerfile changes from
9.2-9.3 and 9.4-9.4a, and the consumer swaps in 9.5-9.7. There is no rendered artifact
this epic produces that the diff itself doesn't already show - unlike Epic 2's Swagger
UI, the generated files (`backend/openapi.json`, `frontend/types/api.d.ts`) are meant to
be read as diffs, not browsed as documents. -->

## Changed Files

40 files across 10 stories. Deduplicated - a file touched by several stories appears once,
with each story's contribution in the blurb.

+ backend/openapi.json                              the committed OpenAPI snapshot, 22 paths and 20 component schemas (9.2); regenerated for the `roi` type fix (9.5) and the `SetPriceHistoryResponseDto.message` example fix (Round 1, F3)
+ backend/src/common/time-frame/time-frames.ts      `TIME_FRAMES` const, the single source for the generated `TimeFrame` enum (9.1b)
+ backend/src/openapi/document.ts                   shared `DocumentBuilder` config and `GLOBAL_PREFIX`, moved verbatim out of `main.ts` so the served docs and the snapshot cannot drift (9.2)
+ frontend/types/api.d.ts                           generated `openapi-typescript` output, never hand-edited (9.3); regenerated for the `roi` type fix (9.5) and the message-example fix (Round 1, F3)
+ frontend/types/contracts.ts                       hand-written alias surface re-exporting DTO types by their backend class name, the only file importing `./api` (9.3)
+ scripts/generate-api-contract.mjs                 the generator: preview-mode boot with no database, `--only=spec|types` split, `--check` byte-compare (9.2, 9.3)
~ backend/Dockerfile                                removed both `RUN ... lint` lines from the `common-build` and `builder` stages (9.4); added the spec-half staleness check to `builder` (9.4a)
~ backend/src/exchange-rates/exchange-rates.controller.ts        `@ApiParam` for `:timeFrame` gets `enum`/`enumName`, example corrected from `'24h'` (9.1b)
~ backend/src/main.ts                               imports the shared document config instead of building `DocumentBuilder` inline (9.2)
~ backend/src/price-history/dto/price-history-check-response.dto.ts   `timeFramesNeeded` switches from `type: [String]` to the named enum plus `isArray` (9.1b)
~ backend/src/price-history/dto/set-price-history-request.dto.ts      `timeFrame` gets `enum`/`enumName`, example corrected (9.1b)
~ backend/src/price-history/dto/set-price-history-response.dto.ts     `message` example corrected from `'... (24h)'` to `'... (d)'`, the eighth site 9.1b's AC didn't name (Round 1 fix, F3)
~ backend/src/product/dto/product-transaction-response.dto.ts    adds the six fields the route actually returns and corrects `size`'s `.toFixed(4)` claim to `.toString()` (9.1a)
~ backend/src/summary/dto/portfolio-summary-response.dto.ts      adds explicit `type: 'number'` to `roi`, which reflected as `Object` and generated `Record<string, never> | null` (9.5)
~ backend/src/summary/summary.controller.ts         both the `@ApiParam` and its `@ApiQuery` twin get `enum`/`enumName` (9.1b)
~ backend/src/time-frame-pl/time-frame-coins-pl.controller.ts    `@ApiParam` enum upgrade, example corrected (9.1b)
~ backend/src/time-frame-pl/time-frame-total-pl.controller.ts    `@ApiParam` enum upgrade, example corrected (9.1b)
~ frontend/Dockerfile                               adds the types-half staleness check to `builder`, before `next build` (9.4a)
~ frontend/package.json                             adds the evidence-only `typecheck` script, wired into nothing (9.3)
~ frontend/src/_hooks/useCoinSummaries.ts           `CoinSummaryResp` -> `CoinSummaryResponseDto` (9.5)
~ frontend/src/_hooks/useFetchCoinPriceHistory.ts   `PriceHistoryResp` -> `PriceHistoryResponseDto` (9.6)
~ frontend/src/_hooks/useFetchCurrentPrice.ts       adds the missing `TimeFrame` import, fixing a pre-existing compile error; still has no call site (9.6)
~ frontend/src/_hooks/useTimeTotalFramePl.ts        `TimeFrame` and `TimeFrameTotalPlResp` -> `types/contracts` (9.6)
~ frontend/src/components/SingleStat.tsx            `CoinSummaryResp` -> `CoinSummaryResponseDto` (9.5)
~ frontend/src/components/StatsTable.tsx            same swap plus all six `ALL_STATS_COLUMNS` use sites (9.5)
~ frontend/src/components/Summary/Breakdown/BreakDown.tsx    `data?.roi` -> `data?.roi ?? 0`, downstream of the `roi: number | null` narrowing (9.5)
~ frontend/src/components/Summary/SummaryContext.tsx         `PortfolioSummary` -> `PortfolioSummaryResponseDto` (9.5)
~ frontend/src/components/Summary/TotalChart/Layout.tsx      `ProfitLossChartResp` -> `ProfitLossChartResponseDto` (9.5)
~ frontend/src/components/product/ProductTable.tsx           `ProductTransaction` -> `ProductTransactionResponseDto` (9.5)
~ frontend/src/components/stats-table/CoinColumn.tsx         `CoinSummaryResp` -> `CoinSummaryResponseDto` (9.5)
~ frontend/src/components/stats-table/CostBasisColumn.tsx    same swap (9.5)
~ frontend/src/components/stats-table/CurrentPrice.tsx       same swap (9.5)
~ frontend/src/components/stats-table/DeltaColumn.tsx        same swap (9.5)
~ frontend/src/components/stats-table/HoldingsColumn.tsx     same swap (9.5)
~ frontend/src/components/stats-table/ProfitLossColumn.tsx   same swap (9.5)
~ frontend/src/context/PriceHistoryProvider.tsx     `PriceHistoryResp` -> `PriceHistoryResponseDto`, three use sites (9.6)
~ frontend/src/context/StatsTableContext.tsx        `TimeFramePlByUnitResp` -> `TimeFrameCoinsPlResponseDto` (9.6)
~ frontend/types/global.d.ts                        trimmed to the seven declarations GR-1-protected server files still import; `TimeFrameTotalPlResp` deleted (9.6)
~ package.json                                      adds `openapi-typescript` and the three `spec:*` scripts (9.2)
~ packages/shared/src/index.ts                      removes `Session`/`SessionUser`; three exports remain (9.7)
~ pnpm-lock.yaml                                    lockfile update for the new root devDependency (9.2)

## Review Notes

### Round 1

Depth: `scripts/generate-api-contract.mjs` · `backend/Dockerfile` · `frontend/Dockerfile` ·
`package.json` · `pnpm-lock.yaml` deep (build gate with live consumers, dependency-graph
change) · `backend/openapi.json`, `frontend/types/api.d.ts` verified by regeneration
rather than read · everything else standard.

Verified directly rather than from Dev Notes:

- `pnpm --filter @portfolio/backend build && node scripts/generate-api-contract.mjs --check`
  exits 0 on the current tree - both committed artifacts are what the source produces.
- Type checking does survive story 9.4's lint removal as a build gate:
  `@nestjs/cli/lib/compiler/compiler.js:45-47` calls `process.exit(1)` when
  `reportAfterCompilationDiagnostic` returns a non-zero count, and with no
  `tsconfig.build.json` present `nest build` resolves to `backend/tsconfig.json`, the same
  config `pnpm typecheck` uses. A type error fails `builder`.
- The staleness gate is not trivially bypassable. In `backend/Dockerfile` the check layer
  sits downstream of `COPY backend/src` -> `RUN ... build` -> `COPY backend/openapi.json`
  -> `COPY scripts`, so a change to source or to the committed snapshot invalidates it;
  `deploy`/`prod` descend from `builder`, so no production path skips it. Same for
  `frontend/Dockerfile`, whose check layer sits downstream of `common-build`'s
  `COPY frontend/types`. `dev` in both files branches off `common-build` above the new
  lines and is genuinely untouched.
- `openapi-typescript` resolves in the frontend image because the repo root is not a
  workspace member (`pnpm-workspace.yaml` lists `frontend`, `backend`, `packages/*`), so
  root devDependencies install regardless of `--filter`.
- The `nullable`-without-`type` reflection defect fixed in 9.5 does not exist anywhere
  else: `nullable` appears on exactly one `@ApiProperty` in the whole backend
  (`portfolio-summary-response.dto.ts:34`), and no schema in `backend/openapi.json` has a
  property that reflects to a bare object - every property carries an explicit `type`,
  `$ref`, `allOf`, or `items`.
- `frontend/types/global.d.ts`'s trim is exact: the seven surviving declarations are
  precisely the seven names still imported, all from `src/server/` or `src/app/api/`.
- `pnpm --filter @portfolio/frontend exec tsc --noEmit -p tsconfig.json` reproduces 15
  errors across 9 files, matching story 9.6's recorded after-state.

Findings:

- **F1** [blocking · conventions] `scripts/generate-api-contract.mjs:44`,
  `scripts/generate-api-contract.mjs:72`, `frontend/types/contracts.ts:15`,
  `frontend/types/global.d.ts:1` - four source comments cite planning-document
  identifiers, which the repo's comment convention forbids outright.
  ```
  scripts/generate-api-contract.mjs:44   // so this needs no database and no env vars - see D35.
  scripts/generate-api-contract.mjs:72   // backend/ import, so this half also runs inside the frontend image (story 9.4a),
  frontend/types/contracts.ts:15         // No component schema of its own - see D43: an arbitrary-key map has nothing to
  frontend/types/global.d.ts:1           // Legacy-only: kept for the GR-1-protected server-side files (src/server, src/app/api)
  ```
  The rule is "Never cite IDs from planning docs (story/epic numbers, tickets, 'FR-3',
  decision codes) anywhere in code, commits, or API-visible text; put the reasoning
  itself in the comment." A reader who does not have `architecture.md` open learns
  nothing from `see D35`. Each of these already states its reasoning next to the
  identifier, so the fix is to drop the identifier, not to rewrite the comment: e.g.
  `- see D35.` -> `.`; `(story 9.4a)` -> `(the frontend image has no backend tree)`;
  `see D43:` -> nothing, the sentence stands alone; `GR-1-protected` -> `server-side`.
  `scripts/generate-api-contract.mjs:5`'s `see architecture "Scripts, and where they
  live"` is the same problem in prose form and should go too - the preceding clause
  already says why the halves are split.
  - Status: Fixed
  - Dropped the identifier from all five sites, keeping each comment's existing
    reasoning: `scripts/generate-api-contract.mjs:5` (removed the trailing architecture
    citation), `scripts/generate-api-contract.mjs:44` (removed `- see D35.`),
    `scripts/generate-api-contract.mjs:72` (removed `(story 9.4a)`, folded the reasoning
    into the sentence that already follows), `frontend/types/contracts.ts:15` (removed
    `see D43:`), `frontend/types/global.d.ts:1` (`GR-1-protected` -> `server-side`).

- **F2** [advisory · dependencies] `package.json:10` - adding `openapi-typescript@7.13.0`
  as a root devDependency re-resolved `debug`'s optional `supports-color` peer from
  `8.1.1` to `10.2.2` across the entire workspace graph, including the backend production
  closure (`@nestjs/core`, `@nestjs/swagger`, `bcrypt`, `nest-winston`, `nestjs-cls`) and
  the frontend. `pnpm-lock.yaml` shows `openapi-typescript@7.13.0` depends on
  `supports-color: 10.2.2`, and every importer entry moved from `(supports-color@8.1.1)`
  to `(supports-color@10.2.2)` - that is most of the lockfile's 387/255-line churn, not
  the "lockfile update for the new root devDependency" the Changed Files blurb implies.
  Impact looks cosmetic: `supports-color` v10 is ESM-only, so `debug`'s
  `require('supports-color')` returns a namespace object whose `.stderr` is undefined and
  `debug` silently falls back to its low-colour palette; nothing throws, and
  `TARGET=prod docker compose build` passed for Dev. Raising it because a devDependency
  quietly moving a transitive in the production closure is the owner's call to accept,
  and because a `pnpm.overrides` pin would keep it out of the runtime graph if they would
  rather it did not.
  - Status: Open

- **F3** [advisory · correctness] `backend/openapi.json` -
  `SetPriceHistoryResponseDto.message`'s example is
  `"Price history updated for BTC (24h)"`, and that DTO's source
  (`backend/src/price-history/dto/set-price-history-response.dto.ts`) says the string is
  interpolated per `coinName`/`timeFrame`. Now that `TimeFrame` is an eight-member enum
  containing no `24h`, the example documents a message the route can never produce. Story
  9.1b's acceptance criteria enumerated seven sites and this is an eighth it did not
  name, so this is scope the story did not claim rather than a missed criterion - flagging
  it because the epic's whole point is making `TIME_FRAMES` the single source for that
  value. `'d'` would make it consistent.
  - Status: Fixed
  - `set-price-history-response.dto.ts:5` example changed to
    `'Price history updated for BTC (d)'`; regenerated `backend/openapi.json` and
    `frontend/types/api.d.ts` via `pnpm spec:generate`.

### Round 2

Depth: re-review only - adjudicated F1/F3 and re-read the four source files the fixes
touched (`scripts/generate-api-contract.mjs`, `frontend/types/contracts.ts`,
`frontend/types/global.d.ts`,
`backend/src/price-history/dto/set-price-history-response.dto.ts`) at standard depth; the
two regenerated artifacts verified by regeneration rather than read. Nothing else in the
diff changed since Round 1.

Verified directly:

- `pnpm --filter @portfolio/backend build && node scripts/generate-api-contract.mjs --check`
  exits 0. Both `backend/openapi.json` and `frontend/types/api.d.ts` are byte-identical to
  what the current source produces, so the F3 example fix was regenerated correctly and no
  hand-edit crept into either file.
- No planning-document identifier survives anywhere in the diff. Grepping every added line
  outside the two generated artifacts and the lockfile for `D<n>`, `FR-<n>`, `NFR-<n>`,
  `GR-<n>`, `story <n>`, `epic <n>`, and `AC <X>` returns nothing.
- `pnpm --filter @portfolio/backend typecheck` exits 0 and `lint` reports 0 errors. Its one
  warning (`backend/src/main.ts:31`, `no-floating-promises` on `bootstrap();`) is
  pre-existing - the line is byte-identical at the base commit and outside the diff.
- `pnpm --filter @portfolio/frontend exec tsc --noEmit -p tsconfig.json` still reproduces
  exactly 15 errors, unchanged from Round 1, so the fix round introduced no frontend
  regression.

Findings:

- **F1** [blocking · conventions] `scripts/generate-api-contract.mjs:44`,
  `scripts/generate-api-contract.mjs:72`, `frontend/types/contracts.ts:15`,
  `frontend/types/global.d.ts:1` - planning-document identifiers in source comments.
  - Status: Resolved
  - All five sites verified. Each dropped the identifier and kept its reasoning, and the
    prose reads as intended English rather than a comment with a hole in it - e.g.
    `generate-api-contract.mjs:71-73` now carries the reason the identifier stood in for
    ("no backend/ import, so this half also runs inside the frontend image, which has no
    backend tree at all"), and `contracts.ts:15` stands alone without the `see D43:` stem.

- **F2** [advisory · dependencies] `package.json:10` - `openapi-typescript@7.13.0` as a
  root devDependency moved `debug`'s optional `supports-color` peer from `8.1.1` to
  `10.2.2` across the whole workspace graph, including the backend production closure.
  - Status: Open
  - Deliberately not addressed this round: the lockfile is untouched pending the owner's
    ruling on whether to accept the transitive bump or pin it out of the runtime graph via
    `pnpm.overrides`. Advisory, so it does not hold the epic. No re-review needed unless
    the owner chooses the pin, in which case the lockfile change comes back through Dev.

- **F3** [advisory · correctness] `backend/openapi.json` -
  `SetPriceHistoryResponseDto.message` documented a `24h` message the route can no longer
  produce.
  - Status: Resolved
  - `set-price-history-response.dto.ts:5` now reads `'Price history updated for BTC (d)'`,
    a member of `TIME_FRAMES`, and the `--check` run above confirms the snapshot and the
    generated declaration were regenerated from it rather than edited by hand.

Nothing new introduced by the fix round.

Not a finding, carried for the owner: stories 9.5 (AC C, first bullet) and 9.6 (AC D,
first bullet) both remain unchecked. Dev could not load `/`, `/product?unit=...`, or the
stats page in a browser because the routes are auth-gated and it has no credentials for
this environment; both stories flagged it explicitly. Everything else about those two
stories verifies clean, and the diff is type-declaration-only in every file involved - no
route, request, or response-shape change - so the residual risk is a rendering regression
only. Those two bullets need the owner's eyes on a logged-in stack; nothing in this loop
can close them.

## Owner Feedback
