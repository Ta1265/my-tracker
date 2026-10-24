# Story 2.3: Swagger bootstrap and DTO conventions

Status: Done

## Context

This story wires `@nestjs/swagger` into the app built in 1.4, and settles every
convention stories 2.4-2.8 then apply without re-deciding: where DTOs live, how
pre-formatted string fields are documented, how auth posture is shown, what a stub
handler's body looks like, and request validation. **Everything decided here is a
pattern, not a one-off** - 2.4-2.8 cite this story by number rather than re-explaining
any of it, so getting it right now is worth the care.

FR-19 requires Swagger UI reachable through nginx over local HTTPS - architecture
already wires nginx's `/backend/` block (story 1.5) and this story serves the UI at
`/backend/docs` (architecture "Swagger exposure", D23), gated by `SWAGGER_ENABLED`
(default on, per D23 - not a hardcoded `NODE_ENV` check). Access restriction is
nginx's job (already covered by the existing LAN/WireGuard `allow`/`deny` rules in
`setup_local_https.sh`), not this story's.

Architecture D19 and D20 are the two decisions this story implements literally: a
composed `@FormattedValue` decorator for pre-formatted string fields (not repeated
`@ApiProperty({ type: String, example, description })` boilerplate on ~20 fields), and
hand-written DTOs (not derived from entities or from Zod), because GR-2 makes the DTO
itself the artifact under review - hand-writing forces a look at every field.

## Acceptance Criteria

### A. Swagger bootstrap

- [x] `backend/src/main.ts` builds a `DocumentBuilder` with title, description, and
      version, calls `.addCookieAuth('portfolio_session', { type: 'apiKey', in:
      'cookie', name: 'portfolio_session' })` (the cookie name 4.5/D7 will actually
      issue - registering it now means 2.4-2.8's `@ApiCookieAuth()` decorators resolve
      to a real scheme even though nothing signs a cookie yet), and defines one tag per
      domain module: `Auth`, `Transactions`, `Summary`, `Stats`, `Product`, `Exchange
      Rates`, `Price History`, `Time-Frame P&L`, `Token Info`, `Metrics` - matching
      2.2's module list exactly, one tag per module, in that order.
- [x] `SwaggerModule.setup('backend/docs', app, document)` is called after
      `app.setGlobalPrefix('backend/api')` (already set in 1.4's `main.ts`), gated by a
      new `AppConfigService.swaggerEnabled` getter reading `SWAGGER_ENABLED`, defaulting
      to `true` when unset (D23 - flag, not `NODE_ENV`). Add `SWAGGER_ENABLED=true` to
      `defaults.env`.
- [x] Swagger's JSON document is reachable at `backend/docs-json` (Nest's default
      alongside `SwaggerModule.setup`) for scriptable verification.

### B. Global validation pipe (architecture D21)

- [x] `backend/src/main.ts` registers a global `ValidationPipe` with
      `{ whitelist: true, forbidNonWhitelisted: false, transform: true }` - permissive
      by design (D21): it must never reject a request today's Next.js routes accept.
      No custom business-rule validators are added anywhere in this story.

### C. `@FormattedValue` decorator (architecture D19)

- [x] `backend/src/common/swagger/formatted-value.decorator.ts` exports a composed
      decorator `FormattedValue(example: string, description?: string)` built with
      `applyDecorators(ApiProperty({ type: String, example, description: description ??
      'Server-formatted display string (matches the legacy route's output exactly per
      FR-3) - do not parse as a number.' }))`. Every pre-formatted string field flagged
      in 2.1's inventory (or, until that document exists, the fields already named in
      2.1's Technical Notes - `formatUSD`/`formatUsdPrecise` output, `.toFixed(1) + '%'`,
      `.toFixed(4)`, the bare-string `exchange-rates/unit/:unit` response) uses this
      decorator instead of a bare `@ApiProperty`.

### D. DTO conventions and file layout

- [x] Per-module DTOs live at `backend/src/<module>/dto/<name>.dto.ts` (matching
      architecture's `backend/src/<module>/` layout). Request DTOs are suffixed
      `RequestDto`, response DTOs `ResponseDto` (e.g. `LoginRequestDto`,
      `SessionResponseDto`). One DTO class per distinct response or request shape - do
      not reuse one class across two endpoints whose shapes only partially overlap.
- [x] DTOs are hand-written classes (D20), each field decorated with `@ApiProperty`
      (or `@FormattedValue` per section C) carrying a realistic `example` - not a
      placeholder like `example: 'string'`. Request DTO fields additionally carry the
      matching `class-validator` decorator for their real-world constraint as recorded
      in 2.1 (e.g. `@IsString()`, `@IsIn(['BUY', 'SELL'])` case-insensitive per 2.1's
      note on `transaction/add`'s `side` field, `@IsOptional()` for `notes`).
- [x] Every field's Swagger `type` matches its **runtime JS type**, not its logical
      meaning - a pre-formatted numeric string is `type: String` via `@FormattedValue`,
      never `type: Number`. This is the single most important rule this story
      establishes, restated here because it is the whole point of FR-3 and 2.1's
      per-field runtime-type discipline.

### E. Auth posture convention

- [x] Endpoints 2.1 records as `authenticated` carry `@ApiCookieAuth()` (resolving to
      the scheme registered in section A). Endpoints recorded as `deliberately public`
      carry no `@ApiCookieAuth()` and instead an `@ApiOperation({ description: '...
      Deliberately public - <2.1's one-line reason>.' })`, so the posture is visible in
      the rendered doc either way without the reader needing to know Swagger's auth-badge
      convention. **No functioning guard exists yet** (that's story 4.7) - these
      decorators are documentation only in Epic 2.

### F. Stub-handler convention

- [x] Every scaffold endpoint's handler body is exactly:
      ```ts
      // <one-line description of what this endpoint will do, e.g.
      //  "Look up the coin's current price history and return a formatted PriceHistoryResp.">
      async someHandler(...): Promise<SomeResponseDto> {
        throw new NotImplementedException();
      }
      ```
      `NotImplementedException` (Nest built-in, HTTP 501) is thrown unconditionally.
      Swagger's `@ApiOkResponse`/`@ApiResponse` decorators document the **finished**
      contract (the 200/204 shape and the real error responses from 2.1), independent of
      the stub's actual runtime behavior - the Swagger doc under GR-2's gate describes
      the finished backend, not today's placeholder.
- [x] Non-200 status codes and non-JSON bodies recorded in 2.1 (bare strings, plain
      text, `204` empty body) are documented with `@ApiResponse({ status, description,
      schema: { type: 'string' } })` or equivalent - not silently upgraded to a JSON
      envelope. Two examples worth getting right here since 2.4-2.8 mirror them:
      `exchange-rates/unit/:unit` documents a bare-string 200 and a bare-string 404;
      `transaction/add` documents a bare-string 200 (`"Transaction added"`).

### G. Worked example - two endpoints, fully scaffolded

- [x] `POST /transaction/add` (`transactions` module) and `GET /stats/:unit` (`stats`
      module) are scaffolded **completely** in this story, per every convention above -
      controller, module, request/response DTOs, `@FormattedValue` on `stats/:unit`'s
      formatted fields, auth decorator (both are `authenticated` per FR-1's table),
      stub body, full Swagger annotations. These two are picked because between them
      they exercise every convention this story defines: a request DTO with validation,
      a bare-string success response, and heavy `@FormattedValue` use.
      **Story 2.5 does not re-scaffold `transaction/add`; story 2.6 does not
      re-scaffold `stats/:unit`** - both cite this story's implementation as done and
      build only the remaining endpoints in their module.

### H. Verification

- [x] `pnpm --filter @portfolio/backend build` succeeds.
- [x] App boots (`pnpm --filter @portfolio/backend start:dev`); `curl -s
      localhost:3001/backend/docs-json | jq '.paths | keys'` lists both
      `/backend/api/transaction/add` and `/backend/api/stats/{unit}`.
- [x] `curl -s localhost:3001/backend/docs-json | jq '.paths["/backend/api/stats/{unit}"].get.responses."200"'`
      shows a non-empty schema with `formatUSD`/`.toFixed`-style example values on the
      formatted fields.
- [x] `curl -s -X POST localhost:3001/backend/api/transaction/add -H 'content-type:
      application/json' -d '{}'` returns `501` (the `NotImplementedException` stub) -
      confirms the route is wired and reachable, not that it does anything yet.
- [x] With `SWAGGER_ENABLED=false` set, the app boots but `curl -s
      localhost:3001/backend/docs` returns `404` - confirms the flag actually gates
      the UI.

## Technical Notes

### Current state

`backend/src/main.ts` (from 1.4) sets the global prefix and listens on 3001; no
Swagger, no validation pipe, no domain modules exist yet. `AppConfigService` (1.4) has
getters for `databaseUrl`, `metricsSecret`, `priceProvider` - this story adds
`swaggerEnabled` following the same pattern (typed getter, no scattered
`process.env` reads, per NFR-1).

### `transaction/add` request/response shape (from 2.1's Technical Notes - reproduce
exactly)

Request body: `{ token_id: number, side: string ('BUY'|'SELL', case-insensitive),
unit: string, size: string, price: string, fee: string, date: string, notes?: string
}`. Response: `200` returns the bare string `"Transaction added"` (not a JSON object -
`@ApiResponse({ status: 200, schema: { type: 'string', example: 'Transaction added' }
})`); `400` returns `{ error: string }` for missing fields, invalid `side`, or unknown
`token_id`.

### `stats/:unit` response shape (from 2.1's Technical Notes)

Single object (not an array): `avgPurchasePrice`, `avgSellPrice`, `valueOfHoldings`,
`profitLossAtCurrentPrice`, `currentPrice`, `breakEvenPrice` - all `@FormattedValue`
(via `formatUSD`, e.g. example `"$1,235"`); `holdings` - `@FormattedValue` via
`.toFixed(4)`, e.g. example `"12.3400"`; `percentPL` - `@FormattedValue` via
`.toFixed(1) + '%'`, e.g. example `"4.2%"`.

## Out of Scope

- Any other endpoint besides the two worked examples in section G - stories 2.4-2.8.
- The auth guard that would actually enforce `@ApiCookieAuth()` - story 4.7.
- Any real handler logic, database access, or Redis access - Epic 3 onward.
- `packages/shared` - deferred to Epic 4; nothing here needs the session claim type.

## Dev Notes

One AC-internal tension resolved with a judgment call, recorded here since it affects
every future scaffolded endpoint: section D's prose example shows `@IsIn(['BUY',
'SELL'])` and other required-field validators without `@IsOptional()`, but section H's
verification explicitly requires `POST /transaction/add` with body `{}` to return `501`
(reach the stub), not `400` (rejected by the pipe). class-validator's type/shape
decorators reject an absent field by default unless paired with `@IsOptional()`. Since
D21 says the pipe must never reject a request today's route accepts, and the real
"missing required field" check is business logic that does not exist until the real
handler lands in Epic 3, every field on `TransactionAddRequestDto` (not just `notes`)
carries `@IsOptional()` alongside its type/shape decorator. `@ApiProperty` still marks
the field required (no `required: false`) so the rendered Swagger doc shows the
finished contract's real requiredness, per section F's "documents the finished
contract, independent of the stub's actual runtime behavior." This convention carries
forward to 2.4-2.8's request DTOs.

Installed `@nestjs/swagger`, `class-validator`, `class-transformer` as backend
dependencies. `@nestjs/swagger` pulls in `swagger-ui-dist`, which has an optional
`@scarf/scarf` postinstall telemetry script; denied it via
`pnpm-workspace.yaml`'s `allowBuilds` (`'@scarf/scarf': false`) rather than approving
an analytics script to run in the install.

Also loosened `backend/eslint.config.mjs`'s `@typescript-eslint/no-unused-vars` (to
`{ args: 'none' }`) and turned off `@typescript-eslint/require-await`, both scoped to
the whole backend package. The Epic 2 stub-handler convention (section F) is `async
handler(...): Promise<Dto> { throw new NotImplementedException(); }` on every scaffold
endpoint - the parameters are real and documented via Swagger but genuinely unused
until Epic 3's real implementation, and the throw is synchronous. Without the config
change, every one of the ~20 endpoints scaffolded across 2.4-2.8 would need a per-method
`eslint-disable` comment for both rules.

### Changed Files

+ backend/src/common/swagger/formatted-value.decorator.ts   composed `@FormattedValue` decorator (D19)
+ backend/src/transactions/dto/transaction-add-request.dto.ts   hand-written request DTO for `POST /transaction/add`
+ backend/src/transactions/transactions.controller.ts   `POST /transaction/add` stub, fully annotated
+ backend/src/transactions/transactions.module.ts   registers `TransactionsController`
+ backend/src/stats/dto/stats-response.dto.ts   hand-written response DTO for `GET /stats/:unit`, `@FormattedValue` on every pre-formatted field
+ backend/src/stats/stats.controller.ts   `GET /stats/:unit` stub, fully annotated
+ backend/src/stats/stats.module.ts   registers `StatsController`
~ backend/src/main.ts   Swagger `DocumentBuilder`/`SwaggerModule.setup` gated by `swaggerEnabled`, global `ValidationPipe` (D21)
~ backend/src/app.module.ts   imports `TransactionsModule`, `StatsModule`
~ backend/src/config/app-config.service.ts   adds `swaggerEnabled` getter (`SWAGGER_ENABLED`, default true per D23)
~ backend/eslint.config.mjs   `no-unused-vars` ignores unused args, `require-await` off - fits the stub-handler convention this story sets
~ backend/package.json   adds `@nestjs/swagger`, `class-validator`, `class-transformer`
~ defaults.env   adds `SWAGGER_ENABLED=true`
~ pnpm-lock.yaml   lockfile update for the three new dependencies
~ pnpm-workspace.yaml   `allowBuilds['@scarf/scarf'] = false` (swagger-ui-dist's telemetry postinstall)

### Verification

- `pnpm --filter @portfolio/backend lint` - pass (one pre-existing `no-floating-promises`
  warning on `bootstrap()` in `main.ts`, unrelated to this story).
- `pnpm --filter @portfolio/backend typecheck` - pass, no errors.
- `pnpm --filter @portfolio/backend build` - pass (`nest build`, no errors).
- Booted with `node --env-file-if-exists=../defaults.env dist/main.js`:
  - `curl -s localhost:3001/backend/docs-json | jq '.paths | keys'` ->
    `["/backend/api/health", "/backend/api/stats/{unit}", "/backend/api/transaction/add"]`.
  - `curl -s localhost:3001/backend/docs-json | jq '.components.schemas.StatsResponseDto'`
    shows all 9 fields with realistic examples (`avgPurchasePrice: "$1,235"`,
    `holdings: "12.3400"`, `percentPL: "4.2%"`, etc).
  - `curl -s -X POST localhost:3001/backend/api/transaction/add -H 'content-type:
    application/json' -d '{}'` -> `501`.
  - `curl -s -o /dev/null -w '%{http_code}' localhost:3001/backend/docs` -> `200`.
  - Booted again with `SWAGGER_ENABLED=false node --env-file-if-exists=../defaults.env
    dist/main.js`: `curl -s -o /dev/null -w '%{http_code}' localhost:3001/backend/docs`
    -> `404`; `curl .../backend/api/health` still `200`, confirming the flag gates only
    the docs UI.
