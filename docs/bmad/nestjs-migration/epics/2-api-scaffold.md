# Epic 2: API scaffold and Swagger sign-off gate

Status: Complete

Stories: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8
Depends on: 1
Base commit: 523681d

## Scope

The complete planned API surface as annotated stubs, whose generated Swagger doc is a
faithful, reviewable picture of the finished backend. Nothing here talks to a database.
GR-2's hard gate closes this epic, and Epics 3 onward do not start until it passes.

## Gate

**Artifact:** the generated Swagger UI at `https://localhost/backend/docs`, browsed as a
document.

**Bring it up with:** `docker compose up -d` , then open that URL. Swagger is served
behind the `SWAGGER_ENABLED` flag (architecture, "Swagger exposure (FR-19)") and is
restricted at nginx rather than by the app's auth guard, so it should load without a
login.

**Passes when**, checked against the story 2.1 inventory and the 2.2 module map:

- All 18 of FR-1's ported endpoints are present (`auth/[...nextauth]` is out of
  contract-inventory scope per 2.1 - it is not a route to port, and is superseded by
  the 3 new endpoints below), plus the 3 new auth endpoints (login, logout, session)
  story 2.4 scaffolds per Epic 4's design. 21 endpoints in total.
- Each has its request shape documented - path params, query params, and for POST/PUT
  the body fields - with realistic examples rather than placeholder types.
- Each has its response shape documented with realistic examples, and pre-formatted
  string fields are visibly typed `string` with an example showing the real formatted
  value, per the 2.3 convention.
- Status codes and error bodies appear, not just the 200 path.
- Tags are coherent per domain, and each endpoint's auth posture is visible from the
  document.

**Reading the controller source instead does not count.** GR-2 is explicit that the
deliverable under review is the generated document, because a scaffold that compiles but
generates thin or inaccurate Swagger output is exactly the failure this gate exists to
catch - and that failure is invisible in a diff, which is why the changed-files summary
is the wrong thing to lead with here.

This is the strictest gate in the initiative. Every DTO in Epics 3 through 5 is written
against what is signed off here, so a gap accepted at this gate propagates into every
later epic.

## Changed Files

  + backend/src/auth/auth.controller.ts                       login/logout/session stubs, all throw NotImplementedException
  + backend/src/auth/auth.module.ts                            registers AuthController
  + backend/src/auth/dto/login-request.dto.ts                  username/password/rememberMe request DTO
  + backend/src/auth/dto/login-response.dto.ts                 FR-9 whitelisted shape (isAuthenticated + AuthUserDto)
  + backend/src/auth/dto/session-response.dto.ts                re-exports LoginResponseDto as SessionResponseDto
  + backend/src/common/swagger/formatted-value.decorator.ts    composed @FormattedValue decorator (D19)
  + backend/src/exchange-rates/dto/price-history-response.dto.ts  PriceHistoryResponseDto, shared with price-history/set
  + backend/src/exchange-rates/exchange-rates.controller.ts    GET :timeFrame/:coinName and GET unit/:unit (both public, bare-string responses)
  + backend/src/exchange-rates/exchange-rates.module.ts        registers ExchangeRatesController
  + backend/src/metrics/metrics.controller.ts                  GET /metrics stub, plain-text 200/403, metrics-secret bearer scheme
  + backend/src/metrics/metrics.module.ts                      registers MetricsController
  + backend/src/price-history/dto/price-history-check-response.dto.ts  PriceHistoryCheckResponseDto
  + backend/src/price-history/dto/set-price-history-request.dto.ts     SetPriceHistoryRequestDto
  + backend/src/price-history/dto/set-price-history-response.dto.ts    SetPriceHistoryResponseDto
  + backend/src/price-history/price-history.controller.ts      GET check (cookie-auth, tightened FR-2) and POST set (public) stubs
  + backend/src/price-history/price-history.module.ts          registers PriceHistoryController
  + backend/src/product/dto/product-transaction-response.dto.ts  ProductTransactionResponseDto, local formatUSD examples per F2/D18
  + backend/src/product/product.controller.ts                  GET :product stub
  + backend/src/product/product.module.ts                      new Product module
  + backend/src/stats/dto/stats-response.dto.ts                 response DTO for GET /stats/:unit, @FormattedValue on every pre-formatted field
  + backend/src/stats/stats.controller.ts                       GET /stats/:unit stub, fully annotated
  + backend/src/stats/stats.module.ts                            registers StatsController
  + backend/src/summary/dto/coin-summary-response.dto.ts        CoinSummaryResponseDto (summary/coins, summary/:unit)
  + backend/src/summary/dto/portfolio-summary-response.dto.ts   PortfolioSummaryResponseDto
  + backend/src/summary/dto/profit-loss-chart-response.dto.ts   ProfitLossChartResponseDto (both variants)
  + backend/src/summary/summary.controller.ts                   all four summary/* routes, :unit declared last per the routing gotcha
  + backend/src/summary/summary.module.ts                       registers SummaryController
  + backend/src/time-frame-pl/dto/time-frame-coins-pl-response.dto.ts  TimeFrameCoinsPlEntryDto + keyed-by-product-name Record type
  + backend/src/time-frame-pl/dto/time-frame-total-pl-response.dto.ts  TimeFrameTotalPlResponseDto
  + backend/src/time-frame-pl/time-frame-coins-pl.controller.ts  GET :timeFrame, raw schema with additionalProperties $ref
  + backend/src/time-frame-pl/time-frame-pl.module.ts            registers both time-frame-pl controllers
  + backend/src/time-frame-pl/time-frame-total-pl.controller.ts  GET :timeFrame, plain DTO response
  + backend/src/token-info/dto/token-info-response.dto.ts        raw TokenInfo row shape
  + backend/src/token-info/dto/token-info-sync-response.dto.ts   { success, userId } response shape
  + backend/src/token-info/token-info.controller.ts              GET :userId (sync stub, cookie-auth) and GET search/:searchTerm (public)
  + backend/src/token-info/token-info.module.ts                  registers TokenInfoController
  + backend/src/transactions/dto/transaction-add-request.dto.ts  request DTO for POST /transaction/add
  + backend/src/transactions/transactions.controller.ts          POST /transaction/add and DELETE :id stubs
  + backend/src/transactions/transactions.module.ts               registers TransactionsController
  ~ backend/eslint.config.mjs                          relaxes no-unused-vars/require-await to fit the stub-handler pattern
  ~ backend/package.json                               adds @nestjs/swagger, class-validator, class-transformer
  ~ backend/src/app.module.ts                          registers all 8 new modules
  ~ backend/src/config/app-config.service.ts            adds swaggerEnabled getter (SWAGGER_ENABLED, default true)
  ~ backend/src/main.ts                                 Swagger DocumentBuilder/setup gated by swaggerEnabled, global ValidationPipe, metrics-secret bearer scheme
  ~ defaults.env                                        adds SWAGGER_ENABLED=true
  ~ pnpm-lock.yaml                                      lockfile update for the three new dependencies
  ~ pnpm-workspace.yaml                                 denies @scarf/scarf telemetry postinstall

  Docs-only (untracked per branch convention, not committed):
  docs/bmad/nestjs-migration/inventory-endpoint-contracts.md   19-route endpoint/contract inventory (2.1)
  docs/bmad/nestjs-migration/inventory-module-map.md           domain module map for all 10 modules (2.2)

  git diff 523681d..HEAD -- <path>          to read any one file
  git log -p --reverse 523681d..HEAD        to read it story by story

## Review Notes

### Round 1

Depth: all of `backend/src/**` (auth posture, validation-pipe boundary, every DTO Epics
3-5 will be written against) deep · `defaults.env`/`pnpm-workspace.yaml`/`package.json`
skim · `docs/bmad/nestjs-migration/inventory-*.md` standard (read-back against the 19/10
section counts and per-route facts).

Reviewed the full diff (`git diff 523681d`, all uncommitted) against the epic's Gate
section, both inventory documents, and all 8 story files' Acceptance Criteria. Also
booted the built app (`pnpm --filter @portfolio/backend build` then
`node dist/main.js`) and pulled the live `/backend/docs-json` rather than trusting Dev
Notes' transcripts, per the Gate's explicit instruction that the generated document is
the artifact, not the source.

**Endpoint count and route wiring.** Live `docs-json` lists 22 paths - the 21 required
(18 ported + 3 new auth) plus the pre-existing `/backend/api/health`, matching the
epic's own arithmetic. `summary`'s literal-path routes (`coins`, `portfolio`,
`profitLossChart`, `profitLossChart/:timeFrame`) are declared before `:unit` in
`backend/src/summary/summary.controller.ts`, avoiding the routing-gotcha 2.6 calls out.

**Judgment call 1 (2.3, `@IsOptional()` on every `TransactionAddRequestDto` field).**
Verified live: `docs-json`'s `TransactionAddRequestDto` schema still lists all 7 base
fields under `required`, so the rendered contract shows the finished shape; a live
`POST /backend/api/transaction/add` with body `{}` returns `501`
(`{"message":"Not Implemented","statusCode":501}`), confirming the permissive pipe
never intercepts it. This resolves the section D / section H tension correctly and
matches `SetPriceHistoryRequestDto`'s identical treatment in 2.7. Agree with the call.

**Judgment call 2 (2.8, `token-info/:userId` tightened to cookie-auth).** Verified
against `inventory-endpoint-contracts.md`'s own FR-2 table, which records this route as
"authenticated, scoped to caller" - not `deliberately public` - because it triggers an
unscoped side-effect write today. Live `docs-json` shows
`security: [{"cookie": []}]` on this path and no `security` block on
`token-info/search/:searchTerm` (the actually-public sibling), matching the story's Dev
Notes exactly. Agree with the call: the inventory's per-route conclusion, not the one
ambiguous story sentence, is the authoritative source 2.8 was told to follow.

**Spot-checked against the live document, not just controller source:**
- `exchange-rates/unit/{unit}` - both `200` and `404` are bare-string schemas with
  quoted examples (`"$1,235"`, `"Exchange rate not found"`), not JSON envelopes.
- `metrics` - `security: [{"metrics-secret": []}]` (not the cookie scheme),
  `content: {"text/plain": ...}` on both `200` and `403`, matching FR-16's carve-out
  from the future JSON error filter.
- Tag order in `docs-json` (`Auth, Transactions, Summary, Stats, Product, Exchange
  Rates, Price History, Time-Frame P&L, Token Info, Metrics`) matches 2.2's module
  order exactly.
- `stats/:unit` and `product/:product`'s pre-formatted fields all render `type: string`
  with realistic formatted examples via `@FormattedValue`, and the two `formatUSD`
  divergence is preserved correctly (`"$1,235"` for `stats`, `"$1,234.56"` for
  `product`) per architecture D18/F2 - confirmed the two DTOs were not swapped.

**Changed Files vs actual diff.** `git status --porcelain` (backend/src/**,
`backend/package.json`, `backend/eslint.config.mjs`, `defaults.env`,
`pnpm-workspace.yaml`, `pnpm-lock.yaml`) matches the epic's Changed Files list exactly,
file for file. No file outside that list, and nothing under `frontend/` (GR-1), was
touched.

**Build/verification reproduced independently:** `pnpm --filter @portfolio/backend
build` succeeds clean.

No blocking or advisory findings. Every AC across all 8 stories checked against the
live generated Swagger document, not the diff summary, per the Gate's own instruction.
The epic is ready for Owner Review.

## Owner Feedback
