# Story 2.2: Domain module map

Status: Done

## Context

Epic 2 builds every controller, DTO, and Swagger annotation the finished backend will
have. Story 2.1 (drafted, not yet run) produces the endpoint-and-contract inventory;
this story is the second step - it assigns each of those endpoints to a Nest module,
so 2.3 (Swagger/DTO conventions) and 2.4-2.8 (the scaffolds) have one settled answer
for "which module does this endpoint live in" rather than each scaffold story
re-deciding it.

Architecture's "Backend module map" section already names the module set this story
must land on - **that list is authoritative, not a proposal to re-derive**:
`auth/`, `transactions/`, `summary/`, `stats/`, `product/`, `exchange-rates/`,
`price-history/`, `time-frame-pl/`, `token-info/`, `metrics/`. Two further modules
appear in architecture's map - `redis/` and `entities/` - but neither serves an HTTP
endpoint; they are infrastructure introduced later (`redis/` in story 5.2, `entities/`
in Epic 3) and are out of scope here.

FR-15 requires `dbService.ts` (436 lines) and `src/server/helpers/` to be decomposed
into per-domain services rather than lifted wholesale into one provider. This story
records, per module, which functions from those files it will eventually absorb - the
factual basis 2.4-2.8's stub comments and Epic 5's real implementations both draw on.

**No code is written in this story.** GR-1 applies passively - read-only inspection of
`frontend/src/server/db/dbService.ts` and `frontend/src/server/helpers/`.

## Acceptance Criteria

- [x] A single document exists at
      `docs/bmad/nestjs-migration/inventory-module-map.md`, with one section per
      module, in this order: `auth`, `transactions`, `summary`, `stats`, `product`,
      `exchange-rates`, `price-history`, `time-frame-pl`, `token-info`, `metrics`.
- [x] Each module's section lists:
  - Every endpoint assigned to it, as method + path, cross-referenced to its numbered
    row in 2.1's inventory (`docs/bmad/nestjs-migration/inventory-endpoint-contracts.md`).
  - Which `dbService.ts` function(s) it will eventually absorb (e.g. `getCoinSummaries`,
    `getPortfolioSummary`), or "none" if the module's logic lives entirely in
    `src/server/helpers/`.
  - Which `src/server/helpers/*.ts` file(s) it will eventually absorb (e.g.
    `get-exchange-rates.ts`, `update-price-history.ts`, `format-usd.ts`), or "none".
- [x] The `auth` module's section states explicitly that its three endpoints - login,
      logout, session - are **new** (per 2.1's decision that `auth/[...nextauth]` is
      out of contract-inventory scope) rather than a port of an existing route, and
      that it will absorb `frontend/src/server/auth.ts`'s `authOptions`/credential
      logic conceptually, not its NextAuth-specific plumbing.
- [x] The `time-frame-pl` module's section notes it covers two endpoints with no shared
      path prefix (`time-frame-coins-pl/:timeFrame`, `time-frame-total-pl/:timeFrame`),
      so it will need two controllers rather than one.
- [x] The document states plainly, once, that `redis/` and `entities/` from
      architecture's module map are infrastructure modules with no endpoints of their
      own and are out of scope for this story and for Epic 2 generally (`redis/` lands
      in 5.2, `entities/` in Epic 3).
- [x] `frontend/src/server/helpers/format-usd.ts`'s `formatUSD` and the separate local
      copy in `frontend/src/app/api/product/[product]/route.ts:7` are both recorded
      against the modules that use them (`stats` and `exchange-rates` for the shared
      helper via `get-exchange-rates.ts`; `product` for the local copy) - not merged
      into one module note, since architecture D18/F2 keeps them as two distinct
      formatters.
- [x] No file outside `docs/bmad/nestjs-migration/` is created, moved, or modified.

## Technical Notes

### Module list and the endpoints each one owns (from architecture's module map)

| Module | Endpoints (from FR-1 / 2.1's inventory) |
| --- | --- |
| `auth` | login, logout, session (new - see AC above) |
| `transactions` | `POST /transaction/add`, `DELETE /transaction/:id` |
| `summary` | `GET /summary/coins`, `/portfolio`, `/:unit`, `/profitLossChart` (query), `/profitLossChart/:timeFrame` |
| `stats` | `GET /stats/:unit` |
| `product` | `GET /product/:product` |
| `exchange-rates` | `GET /exchange-rates/:timeFrame/:coinName`, `/unit/:unit` |
| `price-history` | `GET /price-history/check`, `POST /price-history/set` |
| `time-frame-pl` | `GET /time-frame-coins-pl/:timeFrame`, `/time-frame-total-pl/:timeFrame` |
| `token-info` | `GET /token-info/:userId`, `/token-info/search/:searchTerm` |
| `metrics` | `GET /metrics` |

That is all 18 ported endpoints (19 FR-1 rows minus `auth/[...nextauth]`, which 2.1
excludes) plus the 3 new auth endpoints - 21 endpoints across 10 modules.

### `dbService.ts` functions, for reference (do not re-derive from scratch)

`getCoinSummaries`, `getPortfolioSummary` -> `summary`. `getBuySellTotalFiFo` -> feeds
`summary`'s FIFO cost-basis logic (FR-5.5's future scope). `getNetCashFlowHistory`
(the `dbService.ts` copy, distinct from the `update-price-history.ts` one used by
`profitLossChart` - see 2.1's landmine) -> not called by any of today's 19 routes per
2.1's investigation; record it as unused-but-present in `dbService.ts` rather than
assigning it to a module. `getPriceHistoryMap` -> `price-history`. `getTokensForUserId`
-> `token-info`.

### `src/server/helpers/` files, for reference

`get-exchange-rates.ts` (`getExchangeRates`, `getPriceHistoryForTimeFrame`) ->
`exchange-rates` (and `stats`/`exchange-rates` for `formatUSD` via this file's import).
`update-price-history.ts` (`getNetCashFlowHistory`, `syncPriceHistoryToDbForUserId`,
`updateNetCashFlowTableData`) -> `summary` (the `profitLossChart` endpoints) and
`token-info` (`token-info/:userId`'s sync trigger, per 2.1's landmine that this route
doesn't return token info). `format-usd.ts` -> `stats`. `unitToNameMap.ts` -> wherever
unit-to-coin-name translation is used (`exchange-rates`, `summary`) - record both.

### Verification

This story writes no code. `Done` requires:

```
test -f docs/bmad/nestjs-migration/inventory-module-map.md
grep -c '^## ' docs/bmad/nestjs-migration/inventory-module-map.md   # expect 10
```

plus a read-back confirming each of the 10 sections lists its endpoints (cross-referenced
to 2.1's row numbers), its `dbService.ts` absorptions, and its `src/server/helpers/`
absorptions.

## Out of Scope

- Writing any DTO, controller, or module file - that is stories 2.3-2.8.
- Deciding Swagger tag strings or the `@FormattedValue` convention - that is story 2.3.
- The `redis/` and `entities/` infrastructure modules - stories 5.2 and Epic 3
  respectively.
- Any MikroORM or database work - Epic 3.

## Dev Notes

Read-only inspection went beyond the Technical Notes' named functions to cover every
export in `dbService.ts` (`getTimeFramePriceChange`, `getTransactionsForUserOrdered`,
`getUsersCoins`, `insertIntoTokenPriceHistory`, `insertIntoNetCashFlow` - none named in
Technical Notes) and confirmed one correction to Technical Notes' assumption:
`frontend/src/server/helpers/unitToNameMap.ts` has no importers anywhere in
`frontend/src/` (repo-wide grep confirmed) - `storeTransactions.ts`'s unit-to-name
lookup imports the unrelated `frontend/src/data/coinsUnitToNameMap.ts` instead. The
module map records `unitToNameMap.ts` as unused-but-present rather than assigning it
to `exchange-rates`/`summary` as Technical Notes suggested, per GR-1's read-only
inspection requirement to record what the code actually does.

### Changed Files

+ docs/bmad/nestjs-migration/inventory-module-map.md   domain module map for all 10 Epic 2 modules (docs-only, untracked in git)

### Verification

```
$ test -f docs/bmad/nestjs-migration/inventory-module-map.md && echo "file exists"
file exists

$ grep -c '^## ' docs/bmad/nestjs-migration/inventory-module-map.md
10
```

Read-back confirmed each of the 10 `## ` sections (`auth`, `transactions`, `summary`,
`stats`, `product`, `exchange-rates`, `price-history`, `time-frame-pl`, `token-info`,
`metrics`) lists its endpoints (cross-referenced to 2.1's row numbers 1-19), its
`dbService.ts` absorptions, and its `src/server/helpers/` absorptions, per the
Acceptance Criteria above.

`git status --porcelain` confirmed no file outside `docs/bmad/nestjs-migration/` was
created, moved, or modified by this story.
