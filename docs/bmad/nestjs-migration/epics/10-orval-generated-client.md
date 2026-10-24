# Epic 10: Orval - generate the API client, not just the types

Status: Complete

Stories: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6
Depends on: 4, 9
Base commit: 920940c3d4d8de73ff8c9ea1f5c6cf80cc3d0777

## Scope

Replace Epic 9's type-only generator with Orval, so both the frontend's models *and*
its TanStack Query hooks come out of `backend/openapi.json`, and delete every
hand-written HTTP call to a spec'd endpoint except the one mutator the generated client
calls through (FR-24, FR-25, GR-6, GR-7). Ends with `frontend/types/contracts.ts`,
`frontend/types/api.d.ts`, and the root `openapi-typescript` devDependency all gone, and
`react-query@^3.39.3` removed as a dead dependency. Runs sixth in execution order -
between Epic 9 and Epic 5, both of which now depend on it (`prd.md`'s
`## Execution graph`). No response byte or route target changes anywhere in this
epic - the generated client's seam defaults to the Next.js routes for the whole epic, so
every page renders identically to before it. The data-target flip to NestJS is Epic 7's
job, not this one's.

## Gate

Artifact: the running stack (`docker compose up -d --build`), logged in with real
credentials, viewing `/` (stats table + single-stat panel), `/product?unit=...&name=...`
(product table, price chart, time-frame P/L), and the stats page's time-frame P/L
column.

Bring it up with: `docker compose up -d --build`, then log in through the normal login
flow.

Passes when: all three views render identically to how they rendered before this epic -
same data, same layout, no console errors, no network errors. This is the browser
verification stories 9.5 and 9.6 each left unchecked because Dev has no credentials for
this environment; stories 10.4 and 10.5 rewrite the same consumer set Epic 9 adopted, so
this gate absorbs both outstanding bullets rather than carrying them forward a second
time. Reading the diff does not substitute for this - every story in this epic reports
type-only or route-preserving changes on paper, and the one thing no agent in the loop
could exercise is a logged-in render.

## Changed Files

6 stories plus five owner-feedback fix rounds, 56 files.

+ CLAUDE.md                                         round-4 fix: note for future agents that `frontend/src/api/generated.ts` is generated and must be regenerated/committed with any backend DTO/controller signature change, since nothing else catches it; round-5 fix: same rule, command updated to the in-container form; round-6 fix: dropped the `docker compose up -d &&` prefix, stack assumed already running
~ README.md                                         round-4 fix: added a short type-generation section (source URL, output path, the `spec:generate` command); fixed the pre-existing `migrationn` typo in the Prisma section; round-5 fix: command updated to run codegen inside `next-app` (`docker compose up -d` then `docker exec next-app pnpm --filter @portfolio/frontend spec:generate`), same length; round-6 fix: dropped the `docker compose up -d` line, command is now the single `docker exec` line
~ backend/src/openapi/document.ts                   round-4 fix: removed all ten redundant `.addTag(...)` builder calls - each duplicated an `@ApiTags` decorator that already creates and groups the tag
+ frontend/src/api/generated.ts                    Orval-generated operation functions and TanStack Query hooks (never edited by hand); round-2 fix: regenerated from `frontend/orval.config.ts` running in the frontend workspace, which now correctly detects the frontend's declared `@tanstack/react-query` range (`^5.62.0`) and emits its v5.62+ shape (`DataTag` query keys, a `queryClient` param on every hook) - the root-level generator never saw this dependency and silently emitted an older, undetected-version shape. No consuming file needed a change; frontend typecheck is unaffected (still exactly the 15 pre-existing errors). Round-3 fix: regenerated again with `formatter: 'prettier'` on - Prettier-formatted output, byte-identical across two consecutive runs, no operation/type/URL/method changed (whitespace only).
+ frontend/src/api/http-client.ts                  the mutator: strips `/backend` unless NEXT_PUBLIC_API_TARGET=nest, resolves bare JSON bodies (undefined on 204), lifts the response body's `error` field into the thrown Error
+ frontend/orval.config.ts                         round-2 fix: moved from the repo root (`orval.config.ts` -> `frontend/orval.config.ts`); paths rebased to run from `frontend/`: target `./src/api/generated.ts`, mutator `./src/api/http-client.ts`, tsconfig `../tsconfig.base.json`; dropped the dead `prettier: false` key (not a valid `OutputOptions` field in orval 8.26 - silently ignored at the old root location, but now type-checked under `frontend/tsconfig.json`'s `**/*.ts` include and fails `tsc` as an unknown property). Round-3 fix: `tsconfig` repointed at `./tsconfig.json` now that its `target` no longer breaks the mutator transpile; added `formatter: 'prettier'`. Round-5 fix: `input.target` repointed from a host-loopback URL (`http://localhost:3002/backend/docs-json`) to the Compose-network URL (`http://nest-api:3001/backend/docs-json`), since codegen now runs inside `next-app`; dropped the now-obsolete port-choice comment.
~ frontend/tsconfig.json                           round-3 fix: `target` bumped `es5` -> `es2017` so Orval's esbuild transpile of the mutator (async/const) succeeds under the frontend's own tsconfig; `noEmit`-only, no runtime effect (Next 14 compiles with SWC)
~ .gitignore                                       fix round: removed the now-dead scratch-dir ignore (`frontend/src/.api-check/`) - the staleness check that created it is gone
~ .prettierignore                                  ignores the generated Orval output; round-3 fix: removed the `frontend/src/api/generated.ts` entry now that the formatter runs on it
- backend/openapi.json                             fix round: deleted - no longer committed; Orval reads the live Swagger JSON instead
~ backend/src/auth/auth.controller.ts              add login/logout/authSession operationIds
~ backend/src/exchange-rates/exchange-rates.controller.ts  add coinPriceHistory/exchangeRatesByUnit operationIds
~ backend/src/health/health.controller.ts          add `health` operationId
~ backend/src/metrics/metrics.controller.ts        add `metrics` operationId
~ backend/src/price-history/price-history.controller.ts    add priceHistoryCheck/setPriceHistory operationIds
~ backend/src/product/product.controller.ts        add productTransactions operationId
~ backend/src/stats/stats.controller.ts            add statsByUnit operationId
~ backend/src/summary/summary.controller.ts        add 4 operationIds (coinSummaries, portfolioSummary, profitLossChart, profitLossChartByTimeFrame, coinSummariesByUnit)
~ backend/src/time-frame-pl/time-frame-coins-pl.controller.ts   add timeFrameCoinsPl operationId
~ backend/src/time-frame-pl/time-frame-total-pl.controller.ts   add timeFrameTotalPl operationId
~ backend/src/token-info/token-info.controller.ts  add tokenInfoSync/tokenInfoSearch operationIds
~ backend/src/transactions/dto/transaction-add-request.dto.ts   delete the phantom `unit` property the route derives server-side
~ backend/src/transactions/transactions.controller.ts   add addTransaction/deleteTransaction operationIds
~ backend/Dockerfile                               fix round: dropped the builder-stage `COPY backend/openapi.json`/`COPY scripts`/staleness-check RUN - no staleness check in any build
~ docker-compose.yml                               next-app build arg NEXT_PUBLIC_API_TARGET, mirroring the existing TARGET pattern; fix round: nest-api gains `ports: - 3002:3001` (host 3001 is Grafana's) so Orval on the host can reach `/backend/docs-json`; round-2 fix: rebound to loopback only (`127.0.0.1:3002:3001`), resolving F2 - unqualified `3002:3001` published the API, Swagger UI, and `/backend/api/metrics` on all interfaces; round-5 fix: codegen moved into the `next-app` container - mounted `./frontend/orval.config.ts`, `./frontend/tsconfig.json`, and (found necessary during verification, not just the two the feedback named) `./prettier.config.mjs` into `next-app` read-only, so none goes stale against the host and no image rebuild is ever needed when they change; nest-api's port comment reworded to say it's for browsing Swagger UI from the host, not codegen (mapping itself unchanged)
~ frontend/.eslintignore                           ignores the generated Orval output
~ frontend/Dockerfile                              common-build gains ARG/ENV NEXT_PUBLIC_API_TARGET=legacy; fix round: dropped `COPY orval.config.ts` and the builder-stage staleness-check RUN (no staleness check in any build)
~ frontend/package.json                            remove the deprecated dead react-query@^3.39.3; round-2 fix: gains the `orval` devDependency and the `spec:generate` script moved from the root - codegen now runs from this workspace
~ frontend/src/_hooks/useFetchCoinPriceHistory.ts  thin wrapper over generated useCoinPriceHistory, keeping its lowercased queryKey, staleTime and refetchOnWindowFocus; round-3 fix: `TimeFrame` import re-pointed from `TimeFrameSelect` to `../api/generated`
~ frontend/src/_hooks/useFetchCurrentPrice.ts      fetch -> generated exchangeRatesByUnit(); TimeFrame import moved off the deleted contracts.ts; round-2 fix (F3): re-pointed that `TimeFrame` import from the hand-declared union in `TimeFrameSelect.tsx` to `../api/generated`, keeping this spec'd type on the generated client like `useStorePriceHistory.ts` already does
~ frontend/src/_hooks/useGetTokenList.ts           fetch -> generated tokenInfoSearch()
~ frontend/src/_hooks/useStorePriceHistory.ts      two backend fetches -> generated priceHistoryCheck()/setPriceHistory(); the crypto.com fetch is untouched
~ frontend/src/app/product/page.tsx                fetch DELETE -> generated deleteTransaction() (aliased to avoid a local name collision)
~ frontend/src/components/AddTransaction.tsx       fetch -> generated addTransaction(); status check moves into .catch
~ frontend/src/components/SingleStat.tsx           inline useQuery -> useCoinSummariesByUnit(unit); single-row validation moves from a queryFn throw to a call-site isError/error derivation
~ frontend/src/components/StatsTable.tsx           imports useCoinSummaries and CoinSummaryResponseDto from api/generated
~ frontend/src/components/Summary/SummaryContext.tsx    inline useQuery -> usePortfolioSummary(); wrapper hook -> useTimeFrameTotalPl(); round-3 fix: `TimeFrame` import re-pointed from `TimeFrameSelect` to `../api/generated`
~ frontend/src/components/Summary/TotalChart/Layout.tsx inline useQuery -> useProfitLossChart({ timeFrame })
~ frontend/src/components/product/ProductTable.tsx  inline useQuery -> useProductTransactions(unit)
~ frontend/src/components/stats-table/CoinColumn.tsx        CoinSummaryResponseDto import moved to api/generated
~ frontend/src/components/stats-table/CostBasisColumn.tsx   same import swap
~ frontend/src/components/stats-table/CurrentPrice.tsx      same import swap
~ frontend/src/components/stats-table/DeltaColumn.tsx       same import swap
~ frontend/src/components/stats-table/HoldingsColumn.tsx    same import swap
~ frontend/src/components/stats-table/ProfitLossColumn.tsx  same import swap
~ frontend/src/context/PriceHistoryProvider.tsx    PriceHistoryResponseDto import now from api/generated; round-3 fix: `TimeFrame` import also re-pointed from `TimeFrameSelect` to `../api/generated` (merged into the same import line)
~ frontend/src/context/StatsTableContext.tsx       inline useQuery/fetch -> generated useTimeFrameCoinsPl; response typed TimeFrameCoinsPl200 (no component schema exists); round-3 fix: `TimeFrame` import re-pointed from `TimeFrameSelect` to `../api/generated`, and F4's dead `queryKey: getTimeFrameCoinsPlQueryKey(...)` override plus its now-unused import dropped, leaving `staleTime` as the only override
~ frontend/types/global.d.ts                       header comment repointed at src/api/generated.ts
~ package.json                                     swap the openapi-typescript devDependency for orval@8.26.0; fix round: the three `spec:*` scripts collapsed to one, `"spec:generate": "orval --config orval.config.ts"`; round-2 fix: both the `orval` devDependency and `spec:generate` moved to `frontend/package.json` - the root manifest now carries only `packageManager`
~ packages/shared/src/index.ts                     round-2 fix (F5): reworded a comment that named the now-deleted `frontend/types/contracts.ts` to name `frontend/src/api/generated.ts` instead
~ pnpm-lock.yaml                                   reflects the dependency swap and removal; round-2 fix: reflects the `orval` devDependency moving from the root to `frontend/package.json`
~ pnpm-workspace.yaml                              allow esbuild's postinstall so Orval's mutator transpile works
- scripts/generate-api-contract.mjs                fix round: deleted along with the committed spec and both Dockerfiles' staleness checks - Orval now reads the backend's live Swagger JSON directly
- frontend/src/_hooks/useCoinSummaries.ts          superseded by the generated useCoinSummaries()
- frontend/src/_hooks/useTimeTotalFramePl.ts       superseded by the generated useTimeFrameTotalPl()
- frontend/types/api.d.ts                          retired openapi-typescript output
- frontend/types/contracts.ts                      retired hand-written contract types, no remaining consumers

### Owner Feedback - round 2

Move `orval.config.ts` into `frontend/`. It sits at the repo root only because the
now-deleted `scripts/generate-api-contract.mjs` imported it. Its input is a URL and both
its outputs (`generated.ts`, and the `http-client.ts` mutator it references) are under
`frontend/src/api/`, so nothing at root has a claim on it.

- `orval.config.ts` -> `frontend/orval.config.ts`, with its paths rebased: target
  `./src/api/generated.ts`, mutator `./src/api/http-client.ts`, tsconfig
  `../tsconfig.base.json`.
- Move the `orval` devDependency from the root `package.json` to `frontend/package.json`.
- Move the generate script to `frontend/package.json` and drop the root `spec:generate`.
  Codegen is run from the frontend workspace.
- Bind the nest-api host port to loopback (`127.0.0.1:3002:3001`). It exists only so
  local codegen can fetch the spec; on all interfaces it also publishes the API, the
  Swagger UI and `/backend/api/metrics` over plain HTTP, bypassing nginx and TLS. This
  resolves reviewer finding F2.

Also apply reviewer findings F3, F4 and F5 in the same round.

### Owner Feedback - round 3

Point Orval at the frontend's own tsconfig, format the generated output, and finish the
`TimeFrame` import sweep.

- `frontend/tsconfig.json` line 4 sets `"target": "es5"`, which is why the Orval config
  points at `tsconfig.base.json` instead. Orval transpiles the mutator through esbuild,
  and esbuild cannot downlevel `async`/`const` to es5 - pointing at the frontend tsconfig
  as-is fails with five `Transforming ... to the configured target environment ("es5") is
  not supported yet` errors. Verified by probe, both directions: changing the target to
  `es2017` makes the same run succeed.
- Bump `frontend/tsconfig.json`'s `target` to `es2017`. It is a dead setting for output -
  Next 14 compiles with SWC and never reads it - so this only affects typechecking.
  Confirm the frontend's 15 pre-existing `tsc` errors do not change, and report it if
  they do rather than adapting to them.
- Then set the Orval config's `tsconfig` to `./tsconfig.json`.
- Add `formatter: 'prettier'` to the output options. `SupportedFormatter` in
  `@orval/core@8.26.0` is `'prettier' | 'biome' | 'oxfmt'`; the `prettier: false` key
  removed in round 2 was never a valid option name.
- Remove `frontend/src/api/generated.ts` from `.prettierignore` - it was added in story
  10.1 on the assumption the file would never be formatted, and it will now suppress the
  formatter.
- `frontend/src/_hooks/useFetchCoinPriceHistory.ts:3` still imports `TimeFrame` from
  `../components/product/TimeFrameSelect`. Reviewer finding F3 fixed the same import in
  `useFetchCurrentPrice.ts`; apply it here too and sweep for any other instance.
- Also apply reviewer finding F4: the `queryKey` override at
  `frontend/src/context/StatsTableContext.tsx:63` and its `getTimeFrameCoinsPlQueryKey`
  import are dead. The regenerated client wraps the option in `Partial<>`, so the TS2741
  that blocked this in round 2 no longer applies - the reviewer re-tested it.

### Owner Feedback - round 4

Document the generation workflow, and delete the redundant tag declarations.

**1. `backend/src/openapi/document.ts` - remove all ten `.addTag(...)` calls.**
Every one is the bare, description-less form, and every one duplicates an `@ApiTags`
decorator that already creates the tag and groups its operations.
`SwaggerModule.createDocument()` collects tags from decorators regardless of the builder.
Verified against the live spec: `Health` carries `@ApiTags('Health')` with no matching
`.addTag('Health')` and groups correctly anyway. Removing them changes tag order from the
builder's array to order-of-first-occurrence, which differs only by `Health` moving to
the front - no other reordering, and nothing else is affected. Orval names all 22
operations from explicit `operationId`s under `mode: 'single'`, so tags do not reach the
generated client at all. Keep the rest of the builder chain (title, description, version,
cookie auth, bearer auth) exactly as it is.

**2. Root `README.md` - add a short section on the type-generation workflow.**
Brief and human-readable. As few words as will do the job; no background, no rationale,
no alternatives. It should answer: what generates the frontend's API types and hooks,
where they land, and the one command to run after changing a backend DTO. The essentials:
the backend serves its OpenAPI document at `/backend/docs-json` and republishes it
automatically on save (`nest start --watch`); Orval reads that URL and writes
`frontend/src/api/generated.ts`, which is committed; regeneration is manual, via
`pnpm --filter @portfolio/frontend spec:generate`, and it needs the stack running
(`docker compose up -d nest-api`). Nothing checks staleness, so regenerating and
committing after a DTO change is the developer's job. Leave the existing Prisma section
in place; fix its `migrationn` typo while you are there.

**3. Root `CLAUDE.md` - add a short note for future agents.**
Same facts, framed as a working rule rather than a tutorial: `frontend/src/api/generated.ts`
is generated and must never be hand-edited; any change to a backend DTO or controller
signature requires regenerating and committing it in the same change; the command; and
that no build or check will catch it if they forget. Match the file's existing tone and
brevity - it is a rules file, not a guide.

Do not add a watch script. Orval's `--watch` fires before Nest finishes restarting and
regenerates from the stale spec while reporting success - tested against the live stack.

### Owner Feedback - round 5

Codegen should run inside the `next-app` container, not on the host, so no local Node or
pnpm is needed and the toolchain matches the runtime.

Verified prerequisites and blockers:
- `orval` 8.26.0 IS installed in the running `next-app` dev container.
- `nest-api:3001` is reachable from `next-app` over the Compose network (200 on
  `http://nest-api:3001/backend/docs-json`). `localhost:3002` is NOT reachable from
  inside a container - it is the host's loopback.
- `./frontend/src` is bind-mounted, so a write to `/app/frontend/src/api/generated.ts`
  inside the container lands on the host. Confirmed.
- BLOCKER: `frontend/orval.config.ts` is absent from the container entirely - round 2
  removed its `COPY` from `frontend/Dockerfile`.
- BLOCKER: the container's `frontend/tsconfig.json` still has `"target": "es5"`, baked at
  image build before round 3's bump. An in-container run fails with the same esbuild
  error round 3 fixed.
- The container is named `next-app`. Not `portfolio-next-app`.
- `docker compose up -d nest-api` does not start `next-app` (nest-api's `depends_on` is
  only portfolio-db and redis), so the documented command must bring up the whole stack.

Changes:
1. Mount `./frontend/orval.config.ts` and `./frontend/tsconfig.json` into `next-app` in
   `docker-compose.yml`, read-only, so neither goes stale against the host and no image
   rebuild is needed when they change.
2. Change `frontend/orval.config.ts`'s input target to
   `http://nest-api:3001/backend/docs-json`.
3. Update `README.md` and `CLAUDE.md` to the in-container command:
   `docker compose up -d` then
   `docker exec next-app pnpm --filter @portfolio/frontend spec:generate`.
   Keep both files as short as they are now.
4. Keep the `127.0.0.1:3002:3001` mapping on `nest-api`. Codegen no longer needs it, but
   it is what makes Swagger UI reachable from a host browser at
   `http://127.0.0.1:3002/backend/docs`. Note in the compose comment that it is now for
   browsing only, not for codegen.

Verify by running the documented command exactly as written, from a state where the image
has NOT been rebuilt, and confirming the regenerated `frontend/src/api/generated.ts` on
the host is byte-identical to the committed one.

### Owner Feedback - round 6

Drop `docker compose up -d` from the documented command in both `README.md` and
`CLAUDE.md`. The local dev stack is assumed to already be running, so the instruction is
just:

    docker exec next-app pnpm --filter @portfolio/frontend spec:generate

Do not replace it with a note about needing the stack up, a precondition line, or a
troubleshooting hint. If the stack is down the command fails loudly on its own. Both
files are short by explicit owner instruction - this round should make them shorter, not
longer.

## Review Notes

Applied the owner feedback round below. Summary of what changed:

- `orval.config.ts`'s `input.target` now points at the live Swagger JSON
  (`http://localhost:3002/backend/docs-json` - see port note below), replacing
  `./backend/openapi.json`.
- Deleted `scripts/generate-api-contract.mjs` and `backend/openapi.json`. Neither
  `backend/Dockerfile` nor `frontend/Dockerfile` copies or checks the spec anymore -
  both builder stages now go straight from `common-build` to their own `pnpm build`,
  with no staleness-check `RUN` step. `frontend/Dockerfile` also drops its
  `COPY orval.config.ts` line, since nothing in either image invokes Orval anymore.
- Root `package.json`'s three `spec:*` scripts collapsed to one:
  `"spec:generate": "orval --config orval.config.ts"`. `spec:check` and `spec:watch`
  are gone, per the feedback (watching a URL would race the backend's hot-reload).
- `frontend/src/api/http-client.ts` and `frontend/src/api/generated.ts` are unchanged
  in content and purpose - still the only committed API-layer artifacts.
- **Port deviation from the feedback's literal text**: the feedback says
  `ports: - 3001:3001`, but host port 3001 is already bound by the `grafana` service's
  existing `3001:3000` mapping in this same file - adding a second `3001:` binding
  would fail `docker compose up` outright. Architecture D27 anticipated exactly this
  collision and named 3002 as the reserved fallback for direct `nest-api` access
  ("Host 3001 is Grafana's ... If direct debugging access is wanted later, 3002 is
  free"). Used `ports: - 3002:3001` instead, and pointed `orval.config.ts` at
  `http://localhost:3002/backend/docs-json` accordingly. Flagging this rather than
  silently applying the literal instruction, since it changes a documented
  architecture decision (no host port on `nest-api`) rather than merely adding one.

Verification performed against the running stack (`docker compose up -d nest-api` to
pick up the new port mapping):
- `curl -s -o /dev/null -w '%{http_code}' http://localhost:3002/backend/docs-json` ->
  `200` from the host, confirming the new port mapping reaches Swagger.
- `pnpm spec:generate` against the live spec, diffed byte-for-byte against the
  previously committed `frontend/src/api/generated.ts` -> identical, confirming the
  live-URL generation matches what the deleted `backend/openapi.json` produced.
- `TARGET=prod docker compose build` (no service filter) -> `next-app`, `nest-api`,
  and `nginx` all build successfully with no staleness-check step in either
  Dockerfile.
- `docker build -f backend/Dockerfile --target dev .` and
  `docker build -f frontend/Dockerfile --target dev .` -> both succeed.
- `pnpm --filter @portfolio/backend typecheck` -> 0 errors. `pnpm --filter
  @portfolio/backend lint` -> 0 errors, one pre-existing `main.ts` warning
  (unrelated).
- `pnpm --filter @portfolio/frontend typecheck` -> 15 pre-existing errors, matching
  story 10.6's recorded baseline exactly (none in `generated.ts`/`http-client.ts`).
  `pnpm --filter @portfolio/frontend lint` -> exit 0, only pre-existing warnings.

### Round 1

Depth: `frontend/src/api/http-client.ts` deep (the transport for every authenticated
call - a trust boundary) · `docker-compose.yml` deep (a newly published host port) ·
`backend/src/transactions/dto/transaction-add-request.dto.ts` deep (a changed request
contract) · `frontend/src/api/generated.ts`, `pnpm-lock.yaml`, and the deleted
`frontend/types/api.d.ts` / `contracts.ts` skim (machine-generated or pure deletion,
checked only for "is it what it claims") · everything else standard.

This round follows the owner-feedback fix round, so the reshaped plumbing itself
(live-URL input, no staleness check, one `spec:*` script, the published port) is not
reported as a finding - only defects in it. No blocking findings. The five advisories
below are recorded once and left for the owner.

Verified rather than taken on trust, since the epic's browser gate cannot be exercised
by any agent:

- **Path equivalence across the seam.** Extracted all 23 URL templates from
  `generated.ts` and matched each stripped path against the `frontend/src/app/api` route
  tree. All 17 data routes the frontend actually calls exist at the stripped path with
  the same params; the four that do not (`auth/login`, `auth/logout`, `auth/session`,
  `health`) have no adopted call site in this epic. `mapUrl`'s `startsWith('/backend')`
  strip is also correct for the one URL that carries a query string
  (`summary/profitLossChart?timeFrame=...`).
- **Status-code handling against the legacy routes.** `transaction/[id]` returns
  `new NextResponse(null, { status: 204 })` and `deleteTransaction` is typed
  `Promise<void>`, so the mutator's 204 branch is exercised and correct;
  `transaction/add` returns `NextResponse.json('Transaction added')`, so `addTransaction`'s
  `Promise<string>` body parse is safe. No other adopted route returns an empty 2xx body.
- **Case-sensitivity of the un-lowercased path params.** `useFetchCoinPriceHistory` now
  passes `timeFrame`/`coinName` into the URL verbatim where the hand-written `fetch`
  lowercased both. Not a defect: `TimeFrameSelect`'s `TimeFrame` union is already
  lowercase, and `get-exchange-rates.ts:119` builds its cache key as
  `` `time-frame-pl-${timeFrame.toLowerCase()}-coinName-${coinName.toLowerCase()}` ``, so
  the route lowercases server-side.
- **`SingleStat`'s reworked error derivation** is behaviourally equivalent to the
  queryFn throw it replaced (`isError` set, `coinSummary` undefined, same rendered
  branch), and drops React Query's three retries on a response that will never differ.
- **Leftovers from the superseded design.** Grepped the whole tree for `openapi.json`,
  `generate-api-contract`, `spec:check`, `spec:watch`, `.api-check`, `openapi-typescript`,
  `types/contracts`, and `types/api.d.ts`. Source, config, and Dockerfiles are clean
  (`.gitignore` is a net no-op against the base commit). The only hits are F1 and F5
  below. Stories 10.1 and 10.3 both carry an `Epic fix round addendum` recording what was
  superseded, so neither story file misrepresents what shipped.

- **F1** [advisory · conventions] `docs/bmad/nestjs-migration/architecture.md` and
  `prd.md` still document the committed-spec pipeline this epic deleted.
  The doc set is now the only place the superseded design survives, and it is what
  Epics 5 and 7 will read next. Concretely:
  - `architecture.md:1099-1117` prints the Orval config with
    `input: { target: './backend/openapi.json' }` (missing the shipped
    `fetch: { includeHttpResponseReturnType: false }`) and asserts "The input is the
    committed file on disk and never a URL, which NFR-6 states outright." The shipped
    `orval.config.ts:7` is a URL.
  - `architecture.md:191-193` lists `orval.config.ts` as reading `backend/openapi.json`
    and `scripts/` as holding "generate-api-contract.mjs, the only generation path".
    That script is deleted.
  - D47, D55, D56 (`architecture.md:2232`, `:2240`, `:2241`), plus the amendment
    callouts at `:933`, `:1084`, and `:1783`, all describe the `--only=client` staleness
    check, the `frontend/src/.api-check/` equal-depth scratch directory, and the
    byte-compare. None of it exists.
  - `architecture.md:805` still lists `backend/openapi.json` as "Unchanged"; `:2212`
    (D27) and `:1996-1997` still state `nest-api` has "no host port published".
  - `prd.md:291` (FR-21, "The spec is committed, and staleness fails the build"),
    `prd.md:465-466` (NFR-6), and `prd.md:868` ("never a URL - NFR-6") are each directly
    contradicted by shipped behaviour. GR-6 (`prd.md`, Ground rules) also pins its
    definition of "a spec'd endpoint" to the deleted `backend/openapi.json` path.
  - Nothing in the repo records the one workflow consequence of the ruling: `pnpm
    spec:generate` now requires the stack to be up (`docker compose up -d nest-api`)
    before it can resolve `http://localhost:3002/backend/docs-json`.

  Raised as advisory, not blocking, because this is not `bmad-dev`'s artifact to fix -
  every story in this initiative reads `architecture.md` and none edits it, and amending
  a numbered FR/NFR is a PM decision. The owner needs to route this to `bmad-sm`, and it
  should not hold up the code.
  - Status: Open

- **F2** [advisory · security] `docker-compose.yml:96-97` - the new port mapping publishes
  the backend on all interfaces, not just loopback.
  ```yaml
      ports:
        - 3002:3001
  ```
  Docker's short syntax binds `0.0.0.0`, so on the deployment host this makes the whole
  NestJS API reachable over plain HTTP on 3002, bypassing nginx and its TLS - including
  Swagger UI at `/backend/docs` (`defaults.env:14` sets `SWAGGER_ENABLED=true`, and
  `main.ts:24` gates on it, so it is on in prod) and `/backend/api/metrics`. The stated
  purpose is host-local codegen, which `127.0.0.1:3002:3001` satisfies exactly. Not
  blocking, and not a challenge to the owner's instruction to publish the port: D27
  already named 3002 as the sanctioned fallback, and `portfolio-db` (3306) and `redis`
  (6379) are already published `0.0.0.0` in the same file, so the host evidently relies
  on a firewall. The binding scope is the part the feedback did not specify.
  - Status: Fixed - owner feedback round 2 rebound the mapping to
    `127.0.0.1:3002:3001` (`docker-compose.yml:96`), matching this finding's stated
    fix exactly.

- **F3** [advisory · reuse] `frontend/src/_hooks/useFetchCurrentPrice.ts:5` sources
  `TimeFrame` from the hand-written duplicate rather than the generated union.
  ```ts
  import { type TimeFrame } from '../components/product/TimeFrameSelect';
  ```
  This import previously read `from '../../types/contracts'`, which aliased
  `components['schemas']['TimeFrame']` - i.e. it was spec-derived. Repointing it at
  `TimeFrameSelect.tsx:8`'s hand-declared `'h' | 'd' | ... | 'all'` moves a spec'd
  contract type off the generated client, which is what D52 and FR-20 exist to prevent,
  and it is inconsistent with `useStorePriceHistory.ts:4`, which took `TimeFrame` from
  `../api/generated` in this same epic. Identical unions today, so nothing breaks; the
  cost is that a backend enum change stops being a compile error here. One-line fix:
  import it from `../api/generated`. (The pre-existing `TimeFrameSelect` declaration and
  its other consumers are out of scope - only this reassigned import is this diff's.)
  - Status: Fixed - `frontend/src/_hooks/useFetchCurrentPrice.ts:5` now imports
    `TimeFrame` from `../api/generated` alongside `exchangeRatesByUnit`, and the
    `TimeFrameSelect` import is gone.

- **F4** [advisory · simplification] `frontend/src/context/StatsTableContext.tsx:63` -
  the `queryKey` override is exactly the generated default.
  ```ts
  queryKey: getTimeFrameCoinsPlQueryKey(selectedTimeFrame),
  ```
  `generated.ts:1604` already does `queryOptions?.queryKey ?? getTimeFrameCoinsPlQueryKey(timeFrame)`,
  so this line and the `getTimeFrameCoinsPlQueryKey` import on line 6 are both dead.
  Contrast `useFetchCoinPriceHistory.ts:9`, where the override is load-bearing because it
  lowercases. Dropping both leaves only the `staleTime` override, which is the one thing
  that actually differs from the default.
  - Status: Disputed - dropping the `queryKey` override does not typecheck. The `query`
    field's declared type is
    `UseQueryOptions<Awaited<ReturnType<typeof timeFrameCoinsPl>>, TError, TData>`
    (`generated.ts:1623`) with no `Partial<>` wrapper, and that interface's `queryKey`
    is required, not optional - confirmed by actually removing the override and
    the import: `tsc` fails with `error TS2741: Property 'queryKey' is missing in
    type '{ staleTime: number; }' but required in type 'UseQueryOptions<...>'`. The
    runtime merge the finding cites (`queryOptions?.queryKey ?? getKey(...)`) is real,
    but it only reaches values that already satisfied the static type at the call
    site - it doesn't relax what TypeScript accepts there. Reverted the change;
    `getTimeFrameCoinsPlQueryKey`'s import and the `queryKey:` line in
    `StatsTableContext.tsx:59-63` are unchanged from the pre-round-2 diff.
  - Status: Contested in round 2 - the dispute is right about the file it was tested
    against, but that file no longer ships. See round 2 below.

- **F5** [advisory · hallucinated reference] `packages/shared/src/index.ts:5` now points
  at a file this diff deleted.
  ```ts
  // from, so they can't move to frontend/types/contracts.ts the way the old
  ```
  `frontend/types/contracts.ts` is deleted by this epic, so the comment explaining why
  these types live in `packages/shared` now references a path that does not exist. The
  file is outside the diff, but the dangling reference is caused by it. Reword to name
  `frontend/src/api/generated.ts` instead, or drop the clause.
  - Status: Fixed - `packages/shared/src/index.ts:5` now reads "...so they can't move
    to frontend/src/api/generated.ts the way the old...".

### Round 2 fixes

Applied the owner feedback round above (config move, dependency/script move, loopback
binding) plus reviewer findings F3-F5. F1 is explicitly out of scope for `bmad-dev`
(routed to `bmad-sm` separately) and untouched.

- **Config move.** `orval.config.ts` moved to `frontend/orval.config.ts`. Paths rebased
  to run from `frontend/`: `output.target: './src/api/generated.ts'`,
  `override.mutator.path: './src/api/http-client.ts'`, `output.tsconfig:
  '../tsconfig.base.json'`. The port-note comment moved with the file since it still
  explains a non-obvious value (why 3002, not 3001). Also dropped `prettier: false`
  from `output` - seeing this file inside `frontend/tsconfig.json`'s type-checked
  `**/*.ts` include (which the root tsconfig never did) surfaced that `prettier` isn't
  a field of orval 8.26's `OutputOptions` at all; it was a silently-ignored no-op at the
  old location, not a formatting toggle that did anything.
- **Dependency and script move.** The `orval` devDependency and the `spec:generate`
  script both moved from the root `package.json` to `frontend/package.json`. The root
  manifest now holds only `packageManager`. `pnpm install` re-resolved the lockfile
  accordingly (`pnpm-lock.yaml` diff: `orval` moves from the root importer's
  devDependencies to `frontend`'s).
- **Loopback binding (resolves F2).** `docker-compose.yml`'s `nest-api` port mapping is
  now `127.0.0.1:3002:3001`, exactly the fix F2 asked for. Verified with `docker compose
  ps` showing `127.0.0.1:3002->3001/tcp` (not `0.0.0.0:...`) and a successful `curl` to
  `http://127.0.0.1:3002/backend/docs-json` from the host.
- **F3, F4, F5** - see the disposition recorded under each finding above (F3 fixed, F4
  disputed, F5 fixed).
- **Unplanned but load-bearing: `frontend/src/api/generated.ts` regenerated with a
  materially different (but compatible) shape.** Running `pnpm --filter
  @portfolio/frontend spec:generate` against the live spec did not reproduce the
  previously-committed bytes. Orval's `@orval/query` package decides which
  `@tanstack/react-query` API surface to emit (pre- vs post-5.62 `DataTag` query keys, a
  `queryClient` parameter on every hook) by reading the **nearest package.json's**
  declared `@tanstack/react-query` range, not the resolved `node_modules` version. At
  the old root location, the nearest `package.json` was the root manifest, which never
  declared `@tanstack/react-query` at all - so Orval silently generated the older,
  undetected-version shape. Now that the config runs from `frontend/`, it reads
  `frontend/package.json`'s real `"@tanstack/react-query": "^5.62.0"` and correctly
  emits the newer shape. Verified this is not path-rebase noise: (1) the mutator import
  specifier is unchanged; (2) two consecutive `spec:generate` runs are byte-identical to
  each other, so the new output is deterministic, not random; (3) `pnpm --filter
  @portfolio/frontend typecheck` reports the exact same 15 pre-existing errors before
  and after regenerating, with none in `generated.ts` or any of its consumers - every
  adopted hook call site is compatible with the new signatures with no source change.
  Committed the freshly regenerated file as the new baseline, since it is what
  `spec:generate` now produces from this epic's own shipped config and reflects the
  frontend's actual, declared dependency more accurately than the version the old
  root-level generator could see.

Verification performed against the running stack:
- `docker compose up -d nest-api` (recreated for the new port mapping), then `docker
  compose ps nest-api` -> `127.0.0.1:3002->3001/tcp`.
- `curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3002/backend/docs-json` ->
  `200`.
- `pnpm install` from the repo root -> lockfile updated cleanly, `orval` moved to
  `frontend`'s devDependencies, no other dependency drift.
- `pnpm --filter @portfolio/frontend run spec:generate`, run twice back to back with no
  source change -> byte-identical output both times (deterministic); diffed against the
  pre-round-2 committed `generated.ts` -> materially different for the reason above, not
  byte-identical (see above).
- `pnpm --filter @portfolio/backend typecheck` -> 0 errors. `pnpm --filter
  @portfolio/backend lint` -> 0 errors, the same pre-existing `main.ts` warning.
- `pnpm --filter @portfolio/frontend typecheck` -> 15 pre-existing errors, matching
  story 10.6's recorded baseline exactly (none in `generated.ts`, `http-client.ts`,
  `orval.config.ts`, or any file this round touched). `pnpm --filter @portfolio/frontend
  lint` -> exit 0, only pre-existing warnings.
- `TARGET=prod docker compose build` (no service filter) -> `next-app`, `nginx`, and
  `nest-api` all build successfully.
- `docker build -f backend/Dockerfile --target dev .` and `docker build -f
  frontend/Dockerfile --target dev .` -> both succeed.
- `docker compose up -d --build` (full stack, default dev target) -> all eight services
  report `Up`, including `next-app`, `nest-api`, and `nginx` rebuilt against this
  round's changes.
- Grepped the tree for `orval.config.ts` outside `frontend/` and for root-level
  `spec:generate`/`spec:check`/`spec:watch` references in source, config, and Dockerfiles
  - no hits outside the docs `bmad-sm` will handle under F1.

### Round 2

Depth: `frontend/src/api/generated.ts` deep (a machine-generated shape change across all
22 hooks, with live consumers) · `frontend/orval.config.ts`, `frontend/package.json`,
`package.json`, `pnpm-lock.yaml` standard (the moved codegen toolchain) ·
`docker-compose.yml` standard (F2's one-line rebinding, already reasoned about at depth
in round 1) · `packages/shared/src/index.ts` and
`frontend/src/_hooks/useFetchCurrentPrice.ts` skim (one-line F5/F3 fixes) · the staged
backend and consumer changes not re-reviewed - unchanged since round 1.

This round follows owner feedback, so the config/dependency/script move and the loopback
rebinding are not themselves findings. No blocking findings. F2, F3 and F5 verified
resolved. F4 is contested on new evidence and remains advisory, so it does not hold the
epic; the epic goes to Owner Review with F1 and F4 outstanding, both advisory.

Verified rather than taken on trust:

- **The regenerated `generated.ts` is genuinely the shipped config's output, and the
  shape change is confined to the react-query surface.** Ran the checked-in config
  directly (`frontend/node_modules/.bin/orval --config orval.config.ts`) against the live
  spec: it overwrote a deliberately tampered `generated.ts` and reproduced the committed
  bytes exactly. Filtering the round-2 diff of that file for any line touching a URL
  builder, a `httpClient(...)` call, a model `interface`/`type`, a `method:`, or a
  `queryKey =` default returns nothing - every changed line is react-query option/overload
  typing plus the trailing `queryClient` parameter, which no call site passes, so
  `useQuery(queryOptions, undefined)` and `useMutation(opts, undefined)` are the same
  calls as before.
- **The new shape is correct for the installed version, not just for the declared range.**
  `@orval/query`'s `isQueryV5WithDataTagError` compares the declared
  `@tanstack/react-query` range against `5.62.0`; `frontend/package.json` declares
  `^5.62.0` and the lockfile resolves `@tanstack/react-query@5.101.4`, so the emitted
  `DataTag`/`queryClient` surface matches what is actually installed. Dev's account of
  *why* the output changed is accurate: the mechanism reads a package.json's declared
  dependency, and the root manifest never declared this one.
- **The output does not depend on where codegen is run from.** Ran the same config from
  the repo root (`./frontend/node_modules/.bin/orval --config frontend/orval.config.ts`)
  as well as from `frontend/` - byte-identical both ways, and both wrote to
  `frontend/src/api/generated.ts`. Orval resolves `output.target`, `override.mutator.path`
  and the package.json it version-detects from relative to the config file, not the cwd,
  so the rebased paths are right and the shape cannot silently flip back.
- **Every adopted call site still works with the new shape.** All eight generated-hook
  call sites (`StatsTableContext`, `StatsTable`, `SingleStat`, `ProductTable`,
  `Layout`, `SummaryContext` ×2, `useFetchCoinPriceHistory`) pass at most
  `(params..., { query: {...} })`; none passes a second positional argument that the new
  trailing `queryClient` parameter could capture. `data` stays optional on the
  non-`initialData` overload, which is what `StatsTableContext`'s `timeFrameCoinsPl?` and
  the `data = EMPTY_STATS_DATA` defaults rely on. `pnpm --filter @portfolio/frontend
  typecheck` reproduces exactly the 15 pre-existing errors, none in `generated.ts`,
  `orval.config.ts`, or any consumer.
- **`prettier: false` was correctly dropped.** `@orval/core@8.26.0`'s `OutputOptions`
  (`dist/index.d.mts:312`) has no `prettier` field - formatting is `formatter?:
  SupportedFormatter`, which is opt-in and off here. Dev's reading is right, and it is
  consistent with the output being unformatted and `.prettierignore`d.
- **F2's rebinding is live.** `docker compose ps` reports
  `nest-api  127.0.0.1:3002->3001/tcp`, and the spec URL still answers 200 from the host.
- **Nothing stale left behind by the move.** Grepped all config, manifests, Dockerfiles
  and source for `orval` and for `spec:generate`/`spec:check`/`spec:watch`: the only hits
  are `frontend/orval.config.ts`, its two `frontend/package.json` entries, and the
  `docker-compose.yml` comment that correctly names the new path. Neither Dockerfile
  copies or invokes the config. The mutator import in the generated file is still
  `from './http-client'`.
- **The lockfile diff is minimal and expected**: `orval` moves from the root importer to
  `frontend`'s devDependencies, plus one line of unrelated registry metadata
  (`deprecated: prom-client has been replaced by @prometheus-io/client`) with no version
  change.

One consequence of the dependency move, verified and noted rather than filed as a
finding, since the owner asked for the move and the cost is contained: because
`frontend/Dockerfile`'s deps stage runs `pnpm install --filter @portfolio/frontend...`,
`orval` and its esbuild tree (~24 MB) now install into the frontend *build* stage, where
they did not when it was a root devDependency the filter skipped. Confirmed by inspecting
the built `deps` image. The production stage copies only `.next/standalone`, so nothing
reaches the runtime image; the cost is build-time only.

- **F4** [advisory · simplification] Re-raised against the shipped `generated.ts`. The
  dispute is sound against the file it was tested on, but that file was replaced later in
  the same round. The regenerated client wraps the `query` option in `Partial<>`:
  ```ts
  export const getTimeFrameCoinsPlQueryOptions = <...>(timeFrame: TimeFrame, options?: { query?:Partial<UseQueryOptions<...>>, ... }
  ```
  (`frontend/src/api/generated.ts:1890`, and the same `Partial<>` on all four
  `useTimeFrameCoinsPl` overloads at `:1911-1941`). That is exactly the wrapper the
  dispute said was absent, so TS2741 no longer applies. Verified by making the change,
  not by reading: removed the `queryKey:` line and the `getTimeFrameCoinsPlQueryKey`
  import from `frontend/src/context/StatsTableContext.tsx:6-8,64` and ran `pnpm --filter
  @portfolio/frontend typecheck` - exactly the same 15 pre-existing errors, none in
  `StatsTableContext.tsx`. Reverted the experiment; the file is back as Dev left it. The
  runtime default is still `queryOptions?.queryKey ?? getTimeFrameCoinsPlQueryKey(timeFrame)`
  (`:1895`), identical to what the override passes, so dropping both lines leaves
  `staleTime` as the only override and changes no behaviour. Advisory - it does not block
  the epic, and the owner may reasonably leave it.
  - Status: Contested
  - Status: Fixed (round 3) - owner feedback round 3 explicitly asked for this finding to
    be applied. `frontend/src/context/StatsTableContext.tsx` now imports only
    `useTimeFrameCoinsPl` and `TimeFrameCoinsPl200` from `../api/generated` (the
    `getTimeFrameCoinsPlQueryKey` import is gone), and the `useTimeFrameCoinsPl` call's
    `query` option carries only `staleTime` - the `queryKey:` override line is deleted.
    `pnpm --filter @portfolio/frontend typecheck` still reports exactly the 15
    pre-existing errors, none in this file.
  - Status: Resolved (round 3 review) - verified against the diff, not the claim. See
    round 3 below.

### Round 3 fixes

Applied the owner feedback round above (tsconfig target, orval tsconfig pointer,
prettier formatter, `.prettierignore` entry, `TimeFrame` sweep) plus reviewer finding F4.

- **`frontend/tsconfig.json`'s `target`** bumped from `es5` to `es2017`
  (`frontend/tsconfig.json:4`). Verified both directions per the feedback's probe: with
  `es5` orval's esbuild transpile of the mutator fails with five
  `Transforming ... to the configured target environment ("es5") is not supported yet`
  errors; with `es2017` the identical `spec:generate` run succeeds. This setting is
  `noEmit`-only (Next 14 compiles with SWC), so the bump has no runtime effect - confirmed
  by `pnpm --filter @portfolio/frontend typecheck` reporting the same 15 pre-existing
  errors before and after.
- **`frontend/orval.config.ts`'s `tsconfig`** repointed from `../tsconfig.base.json` to
  `./tsconfig.json` (`frontend/orval.config.ts:14`), now that the frontend's own tsconfig
  target no longer breaks the mutator transpile. Landed after the target bump, per the
  feedback's ordering note.
- **`formatter: 'prettier'`** added to `orval.config.ts`'s `output` block
  (`frontend/orval.config.ts:15`). Regenerated `frontend/src/api/generated.ts` under the
  new config; `pnpm exec prettier --check src/api/generated.ts` (run from `frontend/`)
  confirms the committed file matches what the formatter produces.
- **`.prettierignore`** no longer lists `frontend/src/api/generated.ts` - the formatter
  now runs on it, so the ignore entry would suppress that.
- **`TimeFrame` import sweep.** `useFetchCoinPriceHistory.ts:3` repointed from
  `../components/product/TimeFrameSelect` to `../api/generated` (merged into the existing
  `useCoinPriceHistory` import), matching F3's fix on `useFetchCurrentPrice.ts`. Swept the
  rest of the tree for the same pattern - a hand-declared `TimeFrame` import feeding a
  value into a generated hook or wrapper of one - and found three more:
  `frontend/src/context/StatsTableContext.tsx` (feeds `useTimeFrameCoinsPl` directly),
  `frontend/src/components/Summary/SummaryContext.tsx` (feeds `useTimeFrameTotalPl`
  directly), and `frontend/src/context/PriceHistoryProvider.tsx` (feeds
  `useFetchCoinPriceHistory`, itself a thin wrapper over the generated
  `useCoinPriceHistory`). All three now source `TimeFrame` from `../api/generated`
  instead. Left `components/product/LineChart.tsx` and
  `Summary/TotalChart/TimeFrameDelta.tsx` alone - neither passes `TimeFrame` to a
  generated call; they use it (or, in `TimeFrameDelta.tsx`'s case, don't even reference
  it - a pre-existing unused import outside this round's scope) purely for local
  chart/display config, so repointing them serves no purpose F3's rule was written for.
  All four changes are import-source swaps only, not restructures (GR-7): the union type
  is unchanged and no call site's shape moved.
- **F4 fixed.** See the finding's entry above for the change and verification.

Regeneration verification, since the formatter reshapes the whole file:
- Two consecutive `pnpm --filter @portfolio/frontend run spec:generate` runs (against the
  same live spec, no source change) produced byte-identical `generated.ts` output,
  confirming the formatter is deterministic.
- Diffed the regenerated file against the pre-round-3 committed version: every exported
  `const` (operation function or hook) and every exported `type`/`interface` name is
  identical between the two (`grep -oE 'export (const|type|interface) [A-Za-z0-9_]+'`,
  sorted and diffed - no hits). Every URL template literal (`` `/backend...` ``) and every
  `method: '...'` literal is identical. The mutator import (`import { httpClient } from
  './http-client'`) is unchanged. The only differences are whitespace/formatting -
  Prettier reformatting what was previously unformatted esbuild output.
- `pnpm --filter @portfolio/frontend typecheck` -> exactly the same 15 pre-existing
  errors as story 10.6's recorded baseline, none in `generated.ts`, `http-client.ts`,
  `orval.config.ts`, or any file this round touched.

Verification performed against the running stack:
- `docker compose ps nest-api` -> already up from a prior round,
  `127.0.0.1:3002->3001/tcp`; `curl -s -o /dev/null -w '%{http_code}'
  http://127.0.0.1:3002/backend/docs-json` -> `200`.
- `pnpm --filter @portfolio/frontend run spec:generate`, twice back to back -> byte-identical.
- `pnpm exec prettier --check src/api/generated.ts` (from `frontend/`) -> passes.
- `pnpm --filter @portfolio/backend typecheck` -> 0 errors. `pnpm --filter
  @portfolio/backend lint` -> 0 errors, the same pre-existing `main.ts` warning.
- `pnpm --filter @portfolio/frontend typecheck` -> 15 pre-existing errors, matching story
  10.6's recorded baseline exactly. `pnpm --filter @portfolio/frontend lint` -> exit 0,
  only pre-existing warnings (plus the `PriceHistoryProvider.tsx: 'useQuery' is defined
  but never used` warning, pre-existing and untouched by this round's import edit).
- `TARGET=prod docker compose build` (no service filter) -> `next-app`, `nest-api`, and
  `nginx` all build successfully.

### Round 3

Depth: `frontend/tsconfig.json` deep (a compiler setting that changes what is accepted in
every frontend file - existing behavior with live consumers) · `frontend/src/api/generated.ts`
deep (regenerated machine output feeding eight adopted call sites) · the four `TimeFrame`
import swaps and `StatsTableContext.tsx`'s F4 fix standard · `frontend/orval.config.ts`
and `.prettierignore` standard · everything staged and unchanged since round 2 not
re-reviewed.

This round follows owner feedback, so the target bump, the tsconfig repoint, the
formatter, and the import sweep are not themselves findings - only defects in them. **No
new findings, blocking or advisory.** F4 is verified resolved. F1 remains open and
advisory, already routed to `bmad-sm`. The epic goes to Owner Review.

Verified rather than taken on trust:

- **The `es5` -> `es2017` bump changes nothing but the Orval transpile.** Ran the
  frontend's own typecheck at both targets against the current tree
  (`pnpm exec tsc --noEmit -p tsconfig.json` and the same with `--target es5`): 15 errors
  each, and the two sorted error lists are byte-identical - same files, same lines, same
  codes. Dev's claim holds independently. Nothing else can move either: `lib` is set
  explicitly to `["dom","dom.iterable","esnext"]`, so `target` does not select the lib
  set; `downlevelIteration` is unset at both targets and no file trips the `es5`
  iteration errors it would relax; `useDefineForClassFields` defaults `false` at both
  `es5` and `es2017` (it only flips at `es2022`+), so no class-field semantics shift; and
  the direction of travel only ever loosens what `tsc` rejects, so the bump cannot
  introduce an error. There is no emit path at all - `noEmit: true`, `frontend`'s only
  `tsc` invocation is `typecheck` (`--noEmit`), `next build` compiles with SWC,
  `scrapeCoins` runs `node` directly, and no other tsconfig in the repo extends or
  references `frontend/tsconfig.json`. So the setting is genuinely typecheck-only and the
  runtime bundle is unaffected.
- **The regenerated `generated.ts` is exactly a Prettier pass over the round-2 file, with
  no semantic change.** Stronger than a spot-check of names and URLs: copied the staged
  (round-2) file aside, ran `prettier --write` on it with the repo's own config
  (`prettier.config.mjs`, resolved from `frontend/`), and compared to the shipped file -
  byte-identical. Since Prettier reprints from the parsed AST, an input that formats to
  the shipped bytes is the same program; there is nowhere for an operation, URL, method,
  model type, query-key default, or the `./http-client` mutator import to have changed.
  Probe file removed.
- **Two consecutive Orval runs are byte-identical with the formatter in the pipeline, and
  the committed file is what they produce.** Backed up `generated.ts`, ran
  `pnpm --filter @portfolio/frontend run spec:generate` twice back to back against the
  live spec (`127.0.0.1:3002/backend/docs-json` -> 200), and compared: run 1 == run 2, and
  both == the committed file. Restored the backup; the working tree is as Dev left it. The
  formatter is deterministic and does not drift the baseline.
- **The two `TimeFrame` declarations are interchangeable, so leaving `LineChart.tsx` and
  `TimeFrameDelta.tsx` on the hand-written one is safe.** `generated.ts:101` and
  `TimeFrameSelect.tsx:8` both declare `'h' | 'd' | 'w' | 'm' | '3m' | '6m' | 'y' | 'all'`
  - the same eight members in the same order. TypeScript compares string-literal unions
  structurally, so either is assignable to the other at every call path, and the two
  files Dev left alone do not in fact pass a `TimeFrame` into any generated call
  (`TimeFrameDelta.tsx` takes `selectedTimeFrame` off `useStatsTableContext()`, and
  `LineChart.tsx` names the type only in its import). The residual cost is the one F3
  already described - a backend enum change stops being a compile error in those two
  files - and both imports are pre-existing and untouched by this diff, so they are not
  this epic's to fix.
- **F4 is genuinely applied.** `frontend/src/context/StatsTableContext.tsx:5` now imports
  only `useTimeFrameCoinsPl`, `TimeFrameCoinsPl200` and `TimeFrame` from `../api/generated`
  - `getTimeFrameCoinsPlQueryKey` is gone - and the `useTimeFrameCoinsPl` call's `query`
  block carries `staleTime` alone. Typecheck and lint both clean on this file.
- **Nothing else in the round leaks.** The four import swaps are source-only: every added
  `TimeFrame` specifier carries a `type` modifier, and no import statement changed from
  type-elided to value-emitting, so no new runtime import appears in any bundle. Re-ran
  `pnpm --filter @portfolio/frontend lint` -> exit 0, warnings only, and every warning in
  a round-3 file is pre-existing at the base commit (`PriceHistoryProvider.tsx`'s unused
  `useQuery` import is present unchanged at `920940c`). `.prettierignore` is now a net
  no-op against the base commit - the epic added the generated-file entry and this round
  removed it - which is the correct end state, and matches how `.gitignore` already nets
  out.

### Round 4 fixes

Applied the owner feedback round above (drop the redundant `.addTag()` calls, document the
generation workflow in `README.md`, add a working rule to `CLAUDE.md`).

- **`backend/src/openapi/document.ts`** - deleted all ten `.addTag('...')` calls, keeping
  the rest of the builder chain (title, description, version, cookie auth, bearer auth)
  unchanged. Every removed tag duplicated an existing `@ApiTags` decorator.
- **`README.md`** - added a "API client generation" section stating the source
  (`/backend/docs-json`, live-reloaded by `nest start --watch`), the output
  (`frontend/src/api/generated.ts`, committed), and the one command to run after a DTO
  change (`docker compose up -d nest-api` then `pnpm --filter @portfolio/frontend
  spec:generate`). Also fixed the pre-existing `migrationn` typo in the Prisma section.
- **`CLAUDE.md`** - added an "API client" rule: `generated.ts` is generated and must
  never be hand-edited; a DTO or controller signature change requires regenerating and
  committing it in the same change; no build or check catches a stale client.
- **No watch script added**, per the feedback's explicit instruction.

**Finding, not disputed but worth recording**: the feedback's stated fact that removal
"changes tag order from the builder's array to order-of-first-occurrence, which differs
only by `Health` moving to the front" is not what the live spec shows. `document.tags`
(the OpenAPI document's top-level tag-metadata array) is populated exclusively by
`DocumentBuilder.addTag()` - confirmed by reading `document-builder.js`, where `addTag`
is the only method in the file that assigns to `this.document.tags`, and nothing in
`swagger-scanner.js` backfills it from `@ApiTags` decorators. With all ten calls removed,
`http://127.0.0.1:3002/backend/docs-json`'s top-level `"tags"` array is `[]`, not the
11-item reordered list. This does not affect grouping: every operation still carries its
`@ApiTags`-derived per-operation `tags` array (verified: zero operations without tags,
all 11 tag names present across operations, `Health` still first by order of appearance
in `paths`), which is what Swagger UI actually groups on. The only loss is the top-level
array's ordering/description metadata, which none of these ten calls supplied anyway
(all were the bare, description-less form the feedback itself noted). Not blocking, since
"every operation is still grouped" - the epic's actual functional requirement - holds.

Verification performed against the running stack (`docker compose up -d --build
nest-api`):
- `pnpm --filter @portfolio/backend typecheck` -> 0 errors. `pnpm --filter
  @portfolio/backend lint` -> 0 errors, the same pre-existing `main.ts` warning.
- `curl -s http://127.0.0.1:3002/backend/docs-json` -> `200`; parsed the JSON and
  confirmed every operation across all paths still has a non-empty `tags` array (11
  distinct tag names, `Health` through `Metrics`, zero operations missing a tag), and
  that the top-level `"tags"` field is `[]` (see finding above).
- `pnpm --filter @portfolio/frontend run spec:generate` against the live spec, diffed
  against the pre-round-4 committed `frontend/src/api/generated.ts` -> byte-identical,
  confirming tags never reached the generated client.
- `pnpm --filter @portfolio/frontend typecheck` -> 15 pre-existing errors, matching the
  recorded baseline exactly. `pnpm --filter @portfolio/frontend lint` -> exit 0, only
  pre-existing warnings.
- `TARGET=prod docker compose build` (no service filter) -> `nest-api`, `next-app`, and
  `nginx` all build successfully.

### Round 4

Depth: `backend/src/openapi/document.ts` deep (a change to the served API contract
document, with a live consumer in the codegen pipeline) · `README.md` and `CLAUDE.md`
skim (documentation) · everything else unchanged since round 3 and not re-reviewed.

This round follows owner feedback, so the tag removal and the two doc additions are not
themselves findings - only defects in them. **No new findings, blocking or advisory.**
F1 remains open and advisory, already routed to `bmad-sm`. The epic goes to Owner Review.

Verified rather than taken on trust, against the live spec
(`curl http://127.0.0.1:3002/backend/docs-json` -> 200, served by a `nest-api` rebuilt
on this round's change):

- **Nothing depends on the top-level `tags` array being non-empty.** Grouping in Swagger
  UI is driven by each operation's own `tags`, not by the document-level array, and all
  22 operations still carry theirs: zero operations with an empty or missing `tags`, all
  11 names present (`Health` 1, `Auth` 3, `Transactions` 2, `Summary` 5, `Stats` 1,
  `Product` 1, `Exchange Rates` 2, `Price History` 2, `Time-Frame P&L` 2, `Token Info` 2,
  `Metrics` 1), matching the 11 `@ApiTags` decorators across the 11 controllers one for
  one. `SwaggerModule.setup('backend/docs', app, document)` (`backend/src/main.ts:26`)
  passes no options, so no `tagsSorter`, `operationsSorter` or tag-based UI config exists
  to read the array. `frontend/orval.config.ts` uses `mode: 'single'` with no tag filter
  or tag-based split, so tags reach neither file layout nor symbol names. No other tool,
  script, Dockerfile or nginx config reads `docs-json`.
- **Removal had no effect beyond the tags array.** The served document still carries
  `info.title` `Portfolio API`, the full description, `version` `1.0`, and both security
  schemes (`cookie` -> `apiKey`/`cookie`/`portfolio_session`, `metrics-secret` ->
  `http`/`bearer`). The diff of `document.ts` is exactly the ten deleted lines plus the
  semicolon moving up onto the `addBearerAuth` call; nothing else in the builder chain
  changed.
- **`frontend/src/api/generated.ts` is genuinely unaffected.** The file is staged and has
  no working-tree modification, so Dev's regeneration did in fact produce identical
  bytes. Independently: the file contains no occurrence of any of the 11 tag strings and
  no `tags` reference at all, which is what `mode: 'single'` + explicit `operationId`s
  predicts.
- **The two doc files are accurate and short.** `README.md`'s new section is 11 lines and
  `CLAUDE.md`'s rule is 4; neither adds background or rationale. Every claim checks out:
  the document is served at `/backend/docs-json` (`SwaggerModule.setup('backend/docs')`
  plus Nest's `-json` suffix); the dev container's CMD is
  `pnpm --filter @portfolio/backend start:dev` -> `nest start --watch`
  (`backend/Dockerfile:51`, `backend/package.json:12`), so the spec really does
  republish on save; `spec:generate` exists in `frontend/package.json:16` and runs
  `orval --config orval.config.ts`, whose input is `http://localhost:3002/backend/docs-json`,
  which is exactly what `docker compose up -d nest-api` publishes; and nothing in the
  repo checks staleness. The `migrationn` -> `migration` typo fix is the only other
  README change.

Considered and deliberately not filed: on a cold start, `docker compose up -d nest-api`
returns before Nest has finished compiling, so running `spec:generate` immediately after
can hit a connection refusal. The failure is loud and self-explanatory, and a caveat
would cost more words than the owner asked these two files to spend.

### Round 5 fixes

Applied the owner feedback round above (move codegen into the `next-app` container).

- **`docker-compose.yml`** - mounted `./frontend/orval.config.ts` and
  `./frontend/tsconfig.json` into `next-app`, read-only, at the same in-container paths
  the frontend workspace already expects (`/app/frontend/orval.config.ts`,
  `/app/frontend/tsconfig.json`). Reworded `nest-api`'s port comment to say the mapping
  is now for browsing Swagger UI from the host, not codegen; the mapping itself
  (`127.0.0.1:3002:3001`) is unchanged, per the feedback's explicit instruction to keep
  it.
- **`frontend/orval.config.ts`** - `input.target` repointed to
  `http://nest-api:3001/backend/docs-json`, the Compose-network address, since Orval now
  runs from inside `next-app`. Dropped the comment explaining the old host-loopback port
  choice; it no longer applies.
- **`README.md` and `CLAUDE.md`** - both commands updated to `docker compose up -d` then
  `docker exec next-app pnpm --filter @portfolio/frontend spec:generate`. No other text
  changed; both files are the same length as before (README's section is still 11
  lines, CLAUDE.md's rule is still 4).
- **No watch script added**, per the feedback's explicit instruction.

**Unplanned but necessary: a third file needed mounting.** The feedback named two
config files (`orval.config.ts`, `tsconfig.json`). Running the documented command
against an unrebuilt image with only those two mounted produced a `generated.ts` that
was not byte-identical to the committed file - double quotes and 80-column wrapping
instead of the repo's single quotes and 100-column width. Cause: Orval's
`formatter: 'prettier'` resolves Prettier's own config by walking up from the file
being formatted, and the repo's `prettier.config.mjs` lives at the repo root
(`/app/prettier.config.mjs` inside the container), which is neither copied into the
image nor mounted - so Prettier fell back to its own defaults instead of the repo's
`singleQuote: true, printWidth: 100`. Fixed by mounting `./prettier.config.mjs` into
`next-app` read-only as well (`docker-compose.yml`). Verified this was the actual cause
and the actual fix, not assumed: after adding the mount, with no image rebuild, the
in-container run reproduced the committed bytes exactly (`git diff` empty). Not filed
as a separate finding since it is a direct instance of the round's own stated rule -
"mount config files read-only so no rebuild is ever needed" - applied to a config file
the initial instruction didn't happen to name.

Verification performed against the running stack, specifically reproducing the
round's stated failure condition (image not rebuilt after the config-only change):

- Built the `next-app` dev image once as the round's baseline (`docker compose build
  next-app`), then made no further image changes for the rest of this round - only
  `docker-compose.yml` and `frontend/orval.config.ts` changed after that point, both
  config, neither copied into the image.
- `docker compose up -d` (recreates `next-app` for the new mounts; does not rebuild) -
  confirmed via `docker inspect next-app --format '{{.Image}}'` unchanged across the
  whole verification, and `docker images portfolio-next-app` showing the same image ID
  and age throughout.
- `docker exec next-app cat /app/frontend/orval.config.ts` and
  `docker exec next-app grep target /app/frontend/tsconfig.json` - both show the current
  host content (Compose-network URL; `es2017`), confirming the mounts are live.
- `docker exec next-app pnpm --filter @portfolio/frontend spec:generate` (the exact
  documented command) - exit 0, `orval` reports success reaching
  `http://nest-api:3001/backend/docs-json`.
- `git diff frontend/src/api/generated.ts` after that run - empty. Byte-identical to
  the committed file, with the `next-app` image never rebuilt since before this round's
  changes.
- Host-side `pnpm --filter @portfolio/frontend spec:generate` (the old command) -
  fails with `getaddrinfo ENOTFOUND nest-api`, as expected: `nest-api` only resolves
  inside the Compose network. Confirmed this is the only fallout: grepped the repo for
  `docker compose up -d nest-api` and for `localhost:3002`/`127.0.0.1:3002` outside
  `docker-compose.yml`'s own port mapping and comment - no other hits, so nothing else
  still tells someone to run codegen from the host.
- `curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3002/backend/docs` -> `200`,
  confirming Swagger UI is still reachable from the host through the retained port
  mapping.
- `pnpm --filter @portfolio/backend typecheck` -> 0 errors. `pnpm --filter
  @portfolio/backend lint` -> 0 errors, the same pre-existing `main.ts` warning.
- `pnpm --filter @portfolio/frontend typecheck` -> 15 pre-existing errors, matching the
  recorded baseline exactly. `pnpm --filter @portfolio/frontend lint` -> exit 0, only
  pre-existing warnings.
- `TARGET=prod docker compose build` (no service filter) -> `next-app`, `nest-api`, and
  `nginx` all build successfully.
- Restored the stack to the default dev-target images afterward (`docker compose build`
  with no `TARGET`, then `docker compose up -d`) so the running environment is left in
  its normal state, not the prod images built for the check above.

### Round 6 fixes

Applied the owner feedback round above: dropped `docker compose up -d` from the
documented command in both files, no replacement text added.

- **`README.md`** - the fenced code block under "API client type generation with
  Orval" is now the single line `docker exec next-app pnpm --filter @portfolio/frontend
  spec:generate`.
- **`CLAUDE.md`** - the inline command in the "API client" rule dropped its
  `docker compose up -d && ` prefix, leaving `docker exec next-app pnpm --filter
  @portfolio/frontend spec:generate`.
- No precondition note, troubleshooting hint, or anything else added in its place, per
  the feedback's explicit instruction that this round makes both files shorter, not
  longer.

Verification performed against the already-running stack (no `docker compose up -d`
run for this round):

- `docker compose ps` before making any change confirmed `next-app` and `nest-api`
  already `Up`.
- `docker exec next-app pnpm --filter @portfolio/frontend spec:generate` (the exact
  documented command, run verbatim) -> exit 0.
- Diffed the resulting `frontend/src/api/generated.ts` against the copy saved before
  the run -> byte-identical.
- No source files changed this round, so no typecheck/lint/build re-run was needed.

### Round 5-6

Depth: `docker-compose.yml` deep (a container's mount set and a published port - existing
runtime behaviour with live consumers, `next dev` among them) · `frontend/orval.config.ts`
standard (the codegen input target) · `README.md` and `CLAUDE.md` skim (documentation) ·
everything else unchanged since round 4 and not re-reviewed.

Both rounds follow owner feedback, so moving codegen into the container, the
Compose-network input URL, the retained loopback port, and the shorter documented command
are not themselves findings - only defects in them. **No blocking findings.** Two
advisories, F6 and F7. F1 remains open and advisory, already routed to `bmad-sm`; round 5
widened it (see below). The epic goes to Owner Review.

Verified rather than taken on trust, against the running stack:

- **The documented command works verbatim, end to end, on the image as it stands.** Ran
  `docker exec next-app pnpm --filter @portfolio/frontend spec:generate` exactly as
  `README.md:18` prints it: exit 0, orval reported success, and the resulting host file
  was byte-identical to the committed `frontend/src/api/generated.ts` (saved a copy first,
  `diff` clean, `git status` still shows the file staged with no working-tree
  modification). So the `frontend/package.json:16` script is correct as the thing
  `docker exec` invokes: `orval` is on `/app/frontend/node_modules/.bin`, pnpm resolves
  the filter, and the config's relative paths resolve from `/app/frontend`.
- **The mount set is complete for everything the output depends on and can change without
  an image rebuild.** Enumerated the inputs and checked each inside the container:
  - Prettier config - resolved by walking up from the *formatted file*. Confirmed from
    orval's own source (`orval/dist/config-*.mjs:1673-1690`, `createPrettierFileTransform`
    calls `prettier.resolveConfig(filePath)` then `prettier.format`), so the walk starts at
    `/app/frontend/src/api/generated.ts` and stops at the mounted `/app/prettier.config.mjs`.
    Dev's diagnosis of the round-5 formatting divergence is exactly right.
  - The `prettier-plugin-tailwindcss` plugin that config declares - present at
    `/app/frontend/node_modules/prettier-plugin-tailwindcss` (a frontend devDependency, so
    the Dockerfile's filtered install pulls it in). It does resolve:
    `prettier --check src/api/generated.ts` run inside the container from `/app/frontend`
    passes, and the full codegen run above produced repo-formatted bytes, which it could
    not if plugin loading had thrown.
  - `frontend/tsconfig.json`'s `extends` target - `/app/tsconfig.base.json` exists in the
    image (`frontend/Dockerfile:44` copies it) and is byte-identical to the host's. It is
    baked rather than mounted, but it declares only `strict`/`esModuleInterop`/
    `skipLibCheck` - nothing esbuild's transpile reads - so it cannot move the output.
  - `.prettierignore` - absent from the container, and irrelevant either way: orval formats
    through the Prettier *API*, which never consults ignore files. Its absence cannot cause
    divergence, in this or any future state.
  - `frontend/package.json`, which is what `@orval/query` reads to pick the react-query
    emission shape - baked, and currently byte-identical to the host's (diffed). Not filed
    as a finding: a change to a declared dependency range requires a reinstall, and in this
    setup that means an image rebuild anyway, after which the baked copy is current. It is
    the one output-affecting input a mount could not fix, since a mounted `package.json`
    over unmounted `node_modules` is worse than a stale one.
  - The mutator itself, `frontend/src/api/http-client.ts` - under the pre-existing
    `./frontend/src` directory mount, so always live.
- **Mounting `frontend/tsconfig.json` read-only does not break `next dev`.** The running
  `next-app` was created with all three mounts in place (`docker inspect` confirms
  `rw=false` on each) and `next dev` reports `Ready`, compiles `/api/metrics/route`, and
  compiles `/page` on request with no EROFS/EACCES and no tsconfig complaint. Next 14
  rewrites `tsconfig.json` only when a default it requires is missing, and the committed
  file already carries every one (`plugins: [{name: "next"}]`, `incremental`,
  `.next/types/**/*.ts` in `include`, `jsx: preserve`, `moduleResolution: bundler`), so
  there is nothing for it to write. Worth knowing that this is what makes the read-only
  mount safe: a future edit that *removes* one of those defaults turns a silent self-heal
  into a hard start-up failure.
- **`nest-api:3001` is right and the retained host mapping still does what its comment
  claims.** The successful in-container run proves the Compose-network URL resolves;
  `curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3002/backend/docs` -> `200`
  from the host, so `docker-compose.yml:96-101`'s "for browsing Swagger UI" is accurate,
  and `docker compose ps` shows `127.0.0.1:3002->3001/tcp`, still loopback-only per F2.
- **Nothing in the repo still tells anyone to run codegen from the host.** Grepped the
  whole tree (excluding `node_modules`/`.git`) for `spec:generate`, `3002` and
  `docs-json`. Outside `docs/bmad/`, the only hits are `README.md:18`, `CLAUDE.md:7-8`,
  `frontend/package.json:16`, and `docker-compose.yml`'s own mapping and comment - all
  four correct. Every stale instruction is inside `docs/bmad/architecture.md` and
  `prd.md`, which is F1's territory: round 5 widened F1 rather than creating a new
  finding, since `architecture.md:182` and `prd.md:394,523,1012` now also misstate *where*
  codegen runs and which URL it reads, on top of the committed-spec drift F1 already
  records. Still not `bmad-dev`'s artifact to fix.

- **F6** [advisory · correctness] `docker-compose.yml:58-60` - the three new mounts are
  single-*file* bind mounts, which do not survive a host-side rename-replace, and the
  `prettier.config.mjs` one fails silently when they do not.
  ```yaml
      - ./frontend/orval.config.ts:/app/frontend/orval.config.ts:ro
      - ./frontend/tsconfig.json:/app/frontend/tsconfig.json:ro
      - ./prettier.config.mjs:/app/prettier.config.mjs:ro
  ```
  Verified on this host rather than assumed: created a throwaway container with a single
  file bind-mounted the same way, edited the source in place (container sees the new
  content, as expected), then replaced it via `mv` of a temp file - the in-container path
  became `No such file or directory` and stayed that way for the container's life.
  Rename-replace is what `git checkout <branch>`, `git stash`/`stash pop`, `git rebase`
  and several editors do to a tracked file, so any of those touching one of these three
  paths silently detaches the mount until `docker compose up -d next-app` recreates the
  container. Two of the three fail loudly after that (orval exits non-zero with no config;
  a missing tsconfig is a visible error), but the third does not: with
  `/app/prettier.config.mjs` gone, `prettier.resolveConfig` returns `null` and orval's
  transform catches nothing to warn about, so codegen exits 0, prints its success banner,
  and writes double-quoted 80-column output - the exact signature Dev recorded in the
  round-5 notes when the mount was simply absent. Nothing downstream catches it either:
  `generated.ts` is in `frontend/.eslintignore`, so `pnpm --filter @portfolio/frontend
  lint` never formats-checks it. The damage is confined to formatting of a generated file,
  which is why this is advisory and not blocking. Two ways out, both the owner's call:
  accept it and recreate the container after any branch operation, or drop the mounts and
  bake all three files into the image, paying a rebuild when they change - the rest of the
  frontend image already works that way, and it removes the failure class rather than
  narrowing it.
  - Status: Open

- **F7** [advisory · conventions] `README.md:9,13` - two defects in the new section's
  prose.
  ```markdown
  # API client type generation with Orval [https://orval.dev/docs]
  ...
  `frontend/src/api/generated.ts`. The generated types and hooks in this file should be commited.
  ```
  Line 13 spells "commited"; it is "committed". Line 9's bracketed URL is not Markdown link
  syntax - `[text]` with no following `(url)` renders as literal square brackets around the
  raw URL, not a link. Either `[Orval docs](https://orval.dev/docs)` or a bare
  `https://orval.dev/docs` renders; the current form does neither. Both are one-word edits
  and neither affects a command.
  - Status: Open

### Round 7 fixes - F6 and F7

Applied directly by the driver at the owner's request, rather than a full Dev round.

- `frontend/Dockerfile` - `common-build` now copies `frontend/orval.config.ts` and
  `prettier.config.mjs` into the image. `frontend/tsconfig.json` was already copied.
- `docker-compose.yml` - the three read-only single-file mounts on `next-app` are removed.
  Config now travels in the image, so a rename-replace on the host (git checkout, stash,
  rebase) can no longer sever it. The trade is that changing any of the three requires an
  image rebuild; they change rarely, branch switches do not.
- `README.md` - `commited` -> `committed`, and the bare-bracketed URL is now a Markdown
  link.

Verified: rebuilt `next-app`, confirmed the three configs are present in the image and
absent from `docker inspect`'s mount list, and confirmed the container's tsconfig target
is `es2017`. Ran the documented command verbatim - output byte-identical to the committed
client. Reproduced F6's exact trigger by rename-replacing `prettier.config.mjs` on the
host and regenerating - still byte-identical, where the mounted version would have
silently emitted double-quoted 80-column output. `next dev` serves `/login` 200, and
`TARGET=prod docker compose build next-app` succeeds.

## Owner Feedback

Replace the committed-spec + staleness-check design with the standard NestJS/Orval
setup: Orval reads the backend's live Swagger JSON, and the generated client is the
only committed artifact.

- Orval's `input.target` becomes `http://localhost:3001/backend/docs-json`, the URL
  `SwaggerModule.setup('backend/docs', ...)` already serves. Verified: 200 from inside
  the nest-api container, 22 paths, 22 operationIds, semantically identical to the
  committed `backend/openapi.json`.
- Delete `scripts/generate-api-contract.mjs` entirely, and `backend/openapi.json` with it.
- Replace the three `spec:*` package scripts with one that runs Orval directly.
- Remove the `COPY backend/openapi.json` line and the staleness-check `RUN` from both
  `backend/Dockerfile` and `frontend/Dockerfile`. No staleness check anywhere in any
  build. The owner has ruled that keeping generated output current is the developer's
  responsibility at commit time.
- Add a `ports: - 3001:3001` mapping to `nest-api` in `docker-compose.yml` so codegen on
  the host can reach the spec URL.
- Drop `spec:watch`. Watching a URL races the backend's own hot-reload, and Orval's
  `--watch` watches files, not URLs.
- Keep `frontend/src/api/http-client.ts` and the generated `frontend/src/api/generated.ts`
  committed and unchanged in purpose.
