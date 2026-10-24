# Story 5.1: Transactions - POST /transaction/add, DELETE /transaction/:id

Status: Done

## Context

First domain story in Epic 5 (PRD: "First data domain end to end, so it is also where
the Epic 3 EntityManager pattern and the Epic 4 guard, clock, and error shaping get
exercised together for the first time"). **This story establishes the pattern every
later Epic 5 story follows** - name it once here, cite it by name in 5.2-5.9:

- A per-domain service `backend/src/<domain>/<domain>.service.ts`, `@Injectable()`,
  constructor-injecting `EntityManager` from `@mikro-orm/core` - the same import path
  `backend/src/auth/credential-verifier.service.ts` already uses (Epic 4's precedent).
- The controller stays thin: it destructures `@CurrentUser() user: SessionClaims` and
  passes `user.sub` (the userId - `SessionClaims.sub: number`,
  `packages/shared/src/index.ts:8`) to the service as an explicit parameter. No service
  method ever reads the request or the session ambiently (NFR-1, D29).
- Raw-vs-ORM split per architecture D16 and story 3.4 section C: `em.getRepository(Entity)`
  / `em.find()` / `em.findOne()` for simple single-table operations (this story is 100%
  this category - no aggregate query here); `em.getConnection().execute(sql, params)` is
  reserved for the aggregate/rollup queries later stories port.
- Standard errors are thrown as Nest `HttpException` subclasses and reshaped by
  `AllExceptionsFilter` (4.3) into `{ error: <message> }` - no story needs its own
  try/catch-to-JSON boilerplate for the common case. Only the two literal carve-outs
  named in architecture D22 (exchange-rates/unit's bare-string 404, metrics' plain-text
  403 - stories 5.2 and 5.9) bypass the filter via `@Res({ passthrough: false })`.
- NFR-4 parity: hit the old Next.js route and the new NestJS route with the same
  authenticated user and the same inputs, diff the responses, and paste the comparison
  into Dev Notes. Getting a Nest session cookie means a real `POST
  /backend/api/auth/login` (4.5); getting a NextAuth cookie means a real browser or
  `next-auth` credentials login. This story is the first place that comparison happens
  for a real read/write, not just a shape check.
- DTO/client regen: after the controller's real behavior lands, run `docker compose up
  -d --build nest-api` then `pnpm --filter @portfolio/frontend spec:generate` from the
  host, and check `git status --porcelain frontend/src/api/generated.ts`. Commit it if
  it changed; if it did not, say so in Dev Notes rather than skipping the step - nothing
  else catches a stale client (FR-26).

`frontend/src/server/db/storeTransactions.ts` (FR-15 names it as in-scope for
decomposition) is dead code - `grep -rn 'setTransactionNames\|storeTransactions'
frontend/src` finds it defined and never imported anywhere. It is not ported: there is
nothing calling it for any of the 19 FR-1 endpoints, so there is no live behavior to
decompose. Recorded here so the omission reads as a checked fact, not an oversight.

## Acceptance Criteria

### A. `TransactionsService`

- [x] `backend/src/transactions/transactions.service.ts` - `@Injectable()`, injects
      `EntityManager` (`@mikro-orm/core`).
- [x] `addTransaction(userId: number, body: TransactionAddRequestDto): Promise<void>`:
      - Validate `token_id`, `size`, `price`, `fee`, `date` are all truthy; throw
        `BadRequestException('Missing required fields')` if not (reproduces
        `frontend/src/app/api/transaction/add/route.ts:23-25`).
      - Validate `side.toUpperCase()` is `'BUY'` or `'SELL'`; throw
        `BadRequestException('Invalid side')` otherwise (route.ts:26-28).
      - `em.getRepository(TokenInfo).findOne({ token_id })`; throw
        `BadRequestException('Invalid token_id')` if none found (route.ts:30-31).
      - Compute `total`: `size * price`, then for `BUY`, `(total + fee) * -1`; for
        `SELL`, `Math.abs(total - fee)` (route.ts:33-38) - reproduce exactly, including
        the sign convention (buys are negative, sells are positive).
      - `em.create(Transaction, {...})` and `em.persistAndFlush(...)` with:
        `product: \`${tokenInfo.symbol.toUpperCase()}-USD\``, `date: new Date(date)` (the
        body field arrives as a string; the entity's `date` column is typed `Date &
        Opt`, so convert explicitly - do not assume MikroORM coerces a bare string,
        confirm the inserted row's actual timestamp against the submitted value in the
        AC C evidence rather than trusting the type checker alone), `coinName:
        tokenInfo.slug.charAt(0).toUpperCase() + tokenInfo.slug.slice(1)`, `side:
        side.toUpperCase()`, `size: parseFloat(size)`, `unit: tokenInfo.symbol`, `price:
        parseFloat(price)`, `fee: parseFloat(fee)`, `total`, `notes: notes ?? ''`,
        `userId`, `token_info_id: +token_id` (route.ts:40-55, exact field mapping).
- [x] `deleteTransaction(id: number): Promise<void>`: `em.nativeDelete(Transaction, {
      id })` (or `getRepository(Transaction).findOneOrFail` + `removeAndFlush` if
      preferred, provided a miss surfaces as the 500 below, not a silent no-op). No
      ownership check against `userId` - today's route deletes by bare `id` with no
      ownership scoping (`transaction/[id]/route.ts:13`), and FR-3 forbids "fixing" this
      as an improvement. Throw `InternalServerErrorException('An error occurred while
      deleting the transaction')` if the delete fails (matches the `catch` at
      `route.ts:15-16`) - do not add an existence check first, since that would turn a
      today's-500 into a today's-different-status-code, which is the same class of
      unrequested improvement.

### B. Controller wiring

- [x] `backend/src/transactions/transactions.controller.ts`'s `add` method calls
      `transactionsService.addTransaction(user.sub, body)` and returns the bare string
      `'Transaction added'` (Nest's default reply JSON-serializes a returned string to
      `"Transaction added"` with no `@Res()` needed - confirm this against a real
      response rather than assuming it). **The assumption was wrong** - see Dev Notes.
- [x] `delete` calls `transactionsService.deleteTransaction(parseInt(id, 10))` and
      returns nothing (`@HttpCode(204)` is already on the stub).
- [x] `TransactionsModule`'s `providers` array registers `TransactionsService`.

### C. Parity and regression

- [x] NFR-4 comparison: add a transaction through both `POST /api/transaction/add` and
      `POST /backend/api/transaction/add` with identical bodies (same `token_id`,
      `side`, `size`, `price`, `fee`, `date`) for the same user; confirm both write rows
      that agree on every field once read back, and both return their respective success
      bodies. Delete both rows through their respective `DELETE .../transaction/:id` and
      confirm both `204`. Paste the request/response pairs into Dev Notes.
- [x] Error-path spot checks: missing `size` -> `400 { error: "Missing required
      fields" }` on both old and new; `side: "HOLD"` -> `400 { error: "Invalid side" }`;
      unknown `token_id` -> `400 { error: "Invalid token_id" }`; no session ->
      `401 { error: "Unauthorized" }`.
- [x] `pnpm --filter @portfolio/backend typecheck`, `lint`, `build` pass.
- [x] `docker compose up -d --build` brings up the full stack; `GET
      /backend/api/health` still `200`.

## Technical Notes

### Entities already in place (Epic 3)

`backend/src/db/entities/transaction.entity.ts` - `Transaction` class, all scalar
columns (`userId & Opt` defaulted to 1, `date & Opt` DB-defaulted, `token_info_id`
nullable FK kept as a plain column, no relation modeled - do not add a `@ManyToOne`).
`backend/src/db/entities/token-info.entity.ts` - `TokenInfo` class, `token_id` is the
(non-auto-increment) primary key.

### Existing stub to replace

`backend/src/transactions/transactions.controller.ts` already has both routes fully
Swagger-annotated (2.3/2.5) with `@UseGuards(SessionGuard)`, `@ApiCookieAuth()`, and the
correct DTOs (`TransactionAddRequestDto` at
`backend/src/transactions/dto/transaction-add-request.dto.ts`) - no DTO or Swagger
change is expected in this story. `TransactionAddRequestDto`'s fields are all
`@IsOptional()` today (Epic 2's stub-handler convention, story 2.3 Dev Notes) - this
story's own `BadRequestException` checks are what actually enforce "missing required
fields" now that a real handler exists; leave the DTO's validators as they are; do not
add `@IsNotEmpty()` there; the AC-A required-field check is business logic, not pipe
validation, matching FR-2's decision recorded in the inventory.

### Source of truth for shapes

`docs/bmad/nestjs-migration/inventory-endpoint-contracts.md`'s `transaction/add` and
`transaction/[id]` sections are the exact request/response/status-code contract; read
those instead of re-deriving from the live route file. The live route files are at
`frontend/src/app/api/transaction/add/route.ts` and
`frontend/src/app/api/transaction/[id]/route.ts` if a byte-level check is needed.

### Verification

```
pnpm --filter @portfolio/backend typecheck
pnpm --filter @portfolio/backend lint
pnpm --filter @portfolio/backend build
docker compose up -d --build nest-api
curl -sk https://www.tubesock.xyz/backend/api/health --resolve www.tubesock.xyz:443:127.0.0.1
# functional + parity checks per AC C, pasted into Dev Notes
docker compose up -d --build nest-api && pnpm --filter @portfolio/frontend spec:generate
git status --porcelain frontend/src/api/generated.ts   # commit if non-empty, note if empty
```

## Out of Scope

- `frontend/src/server/db/storeTransactions.ts` - dead code, not ported (see Context).
- Any other domain's service or controller - stories 5.2-5.9.
- Fixing the missing ownership check on delete - today's behavior, preserved per FR-3.
- The full-surface parity sweep across all 19 endpoints - story 5.10.

## Dev Notes

### Deviations from the Technical Notes, with evidence

Two places where testing the story's stated assumptions against a real response showed
them wrong, both fixed as part of "implement the real handler," not as scope creep:

**1. `TransactionAddRequestDto.side`'s `@IsIn(['BUY', 'SELL'])` pre-empted AC-A's own
check.** With the global `ValidationPipe` (`whitelist: true, transform: true`), a body
with `side: "HOLD"` never reached the controller - `@IsIn` rejected it first, producing
`{"error":["side must be one of the following values: BUY, SELL"]}` (class-validator's
array-of-messages shape wrapped by `AllExceptionsFilter`), not the required
`{"error":"Invalid side"}`. Confirmed by running `plainToInstance` + `validate()`
directly against the DTO with `side: "HOLD"` before touching any code - the `IsIn`
constraint fired every time. Removed `@IsIn`, added `@IsString()` in its place (matching
every other string field's validator, so `side` isn't left with zero content validators)
- `backend/src/transactions/dto/transaction-add-request.dto.ts:19-26`. The
`AC-A`/`route.ts`-derived business check in the service is now the only thing that can
produce `Invalid side`, matching AC C's exact-body requirement. This is narrower than
"leave the DTO's validators as they are": that instruction was written to stop
`@IsNotEmpty()` from pre-empting the *missing-fields* check (which it doesn't - none of
the other fields have a format validator that could fire on a present-but-wrong value);
`@IsIn` uniquely could and did pre-empt a check with its own required literal message.

**2. Nest's default string reply is not JSON.** The AC's own text flagged this as an
assumption to confirm, and confirming it disproved it: returning a bare string from a
Nest handler goes through Express's `res.send()`, which sends `Content-Type: text/html`
and no quoting - not `res.json()`. A raw `curl -i` against the built endpoint returned
`201` (Nest's default POST status), `content-type: text/html; charset=utf-8`, body
`Transaction added` (no quotes) - not the required `200` /
`application/json` / `"Transaction added"`. Fixed with `@HttpCode(200)` and
`@Header('Content-Type', 'application/json')` on `add`, returning
`JSON.stringify('Transaction added')` as the body -
`backend/src/transactions/transactions.controller.ts:14-19,54`. Re-tested: `200`,
`application/json; charset=utf-8`, body `"Transaction added"`, byte-identical to the old
route's body. The error paths on the same method (400/401, thrown before the handler
sets the header) are unaffected - `@Header` only applies once the handler returns
normally; the `AllExceptionsFilter`'s own `response.json({ error })` runs first for
those and produced correctly-shaped errors in testing (see parity evidence below).

### `em.create()` persists automatically; `persistAndFlush` doesn't exist in this MikroORM version

AC-A names `em.create(Transaction, {...})` and `em.persistAndFlush(...)`, but
`@mikro-orm/core@7.1.12`'s `EntityManager` has no `persistAndFlush` method (confirmed via
`tsc`: `Property 'persistAndFlush' does not exist on type 'EntityManager<...>'`). Per
this version's `create()` doc comment, "the newly created entity will be automatically
marked for persistence via `em.persist` unless you disable this behavior" - so
`em.create(...)` followed by `await em.flush()` is the equivalent call in this version
and is what's implemented (`transactions.service.ts:32-48`).

### Verification evidence (AC C)

A temporary user was inserted directly into `portfolio-db`'s `User` table for the
duration of the check and deleted immediately after (same approach as story 4.5's
`diagtemp45`). `token_id: 1` = `TokenInfo` row `{symbol: 'BTC', slug: 'bitcoin'}`.

Getting a NextAuth cookie for the old route required the real credentials flow: `GET
/api/auth/csrf` for a CSRF token, then `POST /api/auth/callback/credentials` with that
token plus `username`/`password`/`redirect=false` form-encoded - this sets
`__Secure-next-auth.session-token`. Getting the Nest cookie was the documented `POST
/backend/api/auth/login`. Both sessions verified via `GET /api/auth/session` and `GET
/backend/api/auth/session` to resolve to the same `User.id`.

**Add - same body on both routes**
(`{"token_id":1,"side":"buy","size":"0.5","price":"42000.00","fee":"5.00","date":"2025-01-15T00:00:00.000Z","notes":"parity check"}`):

- Old: `200`, `content-type: application/json`, body `"Transaction added"`.
- New: `200`, `content-type: application/json; charset=utf-8`, body `"Transaction
  added"`.
- Rows read back from `Transaction` (old id 1996, new id 1997) agree on every column:
  `coinName: Bitcoin`, `product: BTC-USD`, `date: 2025-01-15 00:00:00.000`, `side: BUY`,
  `size: 0.5`, `unit: BTC`, `price: 42000`, `fee: 5`, `total: -21005`, `notes: parity
  check`, `token_info_id: 1`. `total` confirms the sign convention:
  `(0.5*42000 + 5) * -1 = -21005`. A separate `side: "sell"` smoke test on the new route
  alone (`size:1, price:50000, fee:2`) wrote `total: 49998 = abs(50000 - 2)`, confirming
  the `SELL` branch too.
- `date` stored as `2025-01-15 00:00:00.000` on both - confirms `new Date(date)`
  converts the incoming ISO string correctly rather than relying on implicit coercion.

**Delete - same ids, respective routes**

- Old `DELETE /api/transaction/1996` -> `204`, empty body.
- New `DELETE /backend/api/transaction/1997` -> `204`, empty body.
- Both rows confirmed gone from `Transaction` afterward.

**Error paths (old / new), same body except the field under test**

- Missing `size`: both `400 {"error":"Missing required fields"}`.
- `side: "HOLD"`: both `400 {"error":"Invalid side"}`.
- `token_id: 999999` (no such `TokenInfo` row): both `400 {"error":"Invalid token_id"}`.
- No session cookie: both `401 {"error":"Unauthorized"}`.
- Delete of a nonexistent id (`9999999`): both `500 {"error":"An error occurred while
  deleting the transaction"}` - confirms the no-existence-check-first behavior is
  preserved (a miss folds into the same 500 as any other delete failure).

All temporary `User` rows (`story51temp`, `story51temp2`) and their `Transaction` test
rows were deleted from `portfolio-db` after the checks; `git status` shows no trace of
temporary diagnostic code.

**Epic review round 1 correction:** the controller's `delete` handler lost its in-code
marker for the missing ownership check when the stub comment was removed during wiring.
Added a one-line comment directly above the `deleteTransaction` call
(`transactions.controller.ts`) noting the missing `userId` scoping is intentional, so a
later reader doesn't "fix" it. No behavior change.

### Changed Files

+ backend/src/transactions/transactions.service.ts        `TransactionsService` - `addTransaction`/`deleteTransaction`, `EntityManager`-injected, reproduces `transaction/add` and `transaction/[id]` route.ts logic exactly (validation, sign convention, field mapping, no-ownership-check delete folding a miss into the same 500)
~ backend/src/transactions/transactions.controller.ts      wires `TransactionsService` into `add`/`delete`; `add` gets `@HttpCode(200)` + `@Header('Content-Type','application/json')` and returns `JSON.stringify(...)` so the reply matches the old route's JSON-string body and status instead of Nest's default `text/html`/`201` for a returned string
~ backend/src/transactions/transactions.module.ts          registers `TransactionsService` in `providers`
~ backend/src/transactions/dto/transaction-add-request.dto.ts   drops `side`'s `@IsIn(['BUY','SELL'])` (was pre-empting the service's own `Invalid side` check with class-validator's own message/shape), adds `@IsString()` in its place to match the other string fields

### Verification

- `pnpm --filter @portfolio/backend typecheck` - passed, no output.
- `pnpm --filter @portfolio/backend lint` - passed; only the pre-existing
  `no-floating-promises` warning on `bootstrap();` in `main.ts` (present since story
  4.1, untouched by this story).
- `pnpm --filter @portfolio/backend build` - passed (`nest build`, no output/errors).
- `docker compose up -d --build nest-api`, then `docker compose up -d --build` (full
  stack) - both built and came up cleanly; `curl -sk
  https://www.tubesock.xyz/backend/api/health --resolve www.tubesock.xyz:443:127.0.0.1`
  returned `200 {"status":"ok"}` after each rebuild.
- Live functional and NFR-4 parity checks against the running stack - see "Verification
  evidence (AC C)" above for the full request/response pairs, the DB row diff, and the
  error-path spot checks.
- `docker compose up -d --build nest-api && pnpm --filter @portfolio/frontend
  spec:generate` (run via `docker exec next-app pnpm --filter @portfolio/frontend
  spec:generate` against the rebuilt `nest-api`) - `git status --porcelain
  frontend/src/api/generated.ts` printed nothing: the generated client is unchanged.
  Expected - this story changed runtime behavior and one internal DTO validator, not any
  public request/response shape or status code beyond what Epic 2's stub annotations
  already documented.
