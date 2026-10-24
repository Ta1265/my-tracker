# Story 4.3: Global error handling and response shaping

Status: Done

## Context

**Blocks Epic 5** (architecture: "must exist before *any* domain endpoint returns an
error"). The first consumer is the `401` + `{ error: 'Unauthorized' }` shape story 4.5's
login and 4.7's guard produce; the point is that every Epic 5 domain module inherits this
filter rather than hand-rolling its own error responses (FR-5).

Architecture D22 records two carve-outs this filter must not break, even though neither
has a real endpoint yet: `GET /metrics`'s plain-text `403 Forbidden` (story 5.9) and
`GET /exchange-rates/unit/:unit`'s bare-JSON-string `200`/`404` (story 5.2/5.6). Both
work by the handler writing its own response directly rather than throwing - a Nest
exception filter only ever runs for a *thrown* exception, so a handler that calls
`@Res({ passthrough: false })` and `res.send(...)` itself never reaches this filter at
all. This story does not implement either carve-out (there's no real handler yet); it
exists so the filter's design doesn't need revisiting when Epic 5 gets there.

## Acceptance Criteria

### A. Global exception filter (architecture D22)

- [x] `backend/src/common/filters/all-exceptions.filter.ts` exports
      `@Catch() class AllExceptionsFilter implements ExceptionFilter`. For a caught
      `HttpException`, it takes `exception.getStatus()` and reshapes
      `exception.getResponse()` into `{ error: <message> }` - collapsing Nest's default
      `{ statusCode, message, error }` down to the single `error` key FR-5 pins for the
      `401` case (`{ error: 'Unauthorized' }`, which is `UnauthorizedException()`'s
      default message with no args - confirm this in verification rather than assuming
      it). For anything that is not an `HttpException` (an unexpected thrown error), it
      responds `500` with `{ error: 'Internal Server Error' }` and logs the original
      error via the bound logger (4.1) at `error` level - never leaks the original
      message or stack to the client.
- [x] `backend/src/main.ts` registers it globally: `app.useGlobalFilters(new
      AllExceptionsFilter())`.
- [x] The filter does **not** attempt to special-case the metrics/exchange-rates carve-outs
      described in Context - there is nothing to special-case yet, and D22's actual
      mechanism (a handler bypassing the exception path entirely) means the filter needs
      no carve-out logic at all. Record this reasoning in Dev Notes so Epic 5 doesn't
      re-derive it.

### B. Demonstration, then removed

- [x] Add a temporary diagnostic route (same convention as 4.1/4.2) that throws `new
      UnauthorizedException()` unconditionally. Confirm the response is `401` with body
      exactly `{ "error": "Unauthorized" }` - the literal FR-5 shape, not `{ statusCode,
      message }`. Also throw a plain `new Error('boom')` from a second temporary route and
      confirm `500` with body `{ "error": "Internal Server Error" }`, with the real
      message/stack absent from the response but present in the container's logs (4.1).
      Paste both request/response pairs into Dev Notes.
- [x] Delete both temporary routes before finishing this story - confirmed absent from
      `git status`/`git diff`.

### C. Regression

- [x] `pnpm --filter @portfolio/backend build`, `typecheck`, `lint` all pass.
- [x] `docker compose up -d --build` brings up the full stack; `GET /backend/api/health`
      still returns `200` unaffected by the new global filter.
- [x] Every existing Epic 2 stub endpoint still returns `501` with Nest's default
      `NotImplementedException` body reshaped to `{ error: 'Not Implemented' }` by this
      filter (a visible, expected side effect of adding the filter - confirm it, don't
      just assume it) - spot-check two or three stub endpoints via `curl`.

## Technical Notes

### Current state

No exception filter exists; Nest's default handler returns `{ statusCode, message,
[error] }` for every thrown `HttpException` today (visible in Epic 2's stub `501`
responses). This story is the first thing to change that shape.

### Validation errors are not specially handled here

The global `ValidationPipe` (story 2.3, D21, permissive) throws `BadRequestException`
with a `message` array (one string per failing field) when it does reject something. This
filter reshapes that the same as any other `HttpException` - `{ error: [...] }`, an array
under the `error` key rather than a single string. FR-5 does not pin a shape for `400`, so
this is an acceptable default, not a gap; record it as a deliberate non-decision rather
than silently picking a shape nobody asked for.

## Out of Scope

- The metrics `403 Forbidden` plain-text response and the `exchange-rates/unit/:unit`
  bare-string responses themselves - stories 5.9 and 5.2/5.6, which implement them by
  writing the response directly rather than throwing, bypassing this filter by
  construction.
- The auth guard that actually produces real `401`s in normal operation - story 4.7. This
  story only proves the filter's shaping is correct for whatever exception reaches it.
- Structured logging (4.1, already landed) and the injectable clock (4.2, already landed).

## Dev Notes

### Why no carve-out logic lives in the filter (AC A, third bullet)

D22's carve-outs (`GET /metrics`'s plain-text `403`, `GET /exchange-rates/unit/:unit`'s
bare-JSON-string responses) work by their handlers writing the response directly - Epic
5's guard/controller code will call `res.status(...).send(...)` (or equivalent) itself,
via `@Res({ passthrough: false })`, rather than throwing. A Nest exception filter's
`catch()` only ever runs for a *thrown* exception, so those handlers never reach
`AllExceptionsFilter` at all - there is no code path through this filter for either
carve-out to intercept. The filter is therefore correct as written today, with nothing
to special-case, and nothing here needs revisiting when Epic 5 builds those two
handlers.

### Response shape actually produced by Nest's default exceptions (AC A, first bullet)

Reading `@nestjs/common`'s `HttpException`/`UnauthorizedException`/
`NotImplementedException` source (not assumed): `new UnauthorizedException()` with no
arguments resolves to `getResponse()` returning `{ message: 'Unauthorized', statusCode:
401 }` - no `error` key, contrary to the story text's `{ statusCode, message, error }`
description (that three-key shape only appears when a *string* `objectOrError` is passed
explicitly, which supplies the `error` key as a short description separate from
`message`). The filter reshapes by reading `.message` off the response body when it's an
object with a string/array `message` key, otherwise using the raw body (covers a bare
string `HttpException` response). This produces `{ error: 'Unauthorized' }` for the
default `UnauthorizedException`, `{ error: 'Not Implemented' }` for the default
`NotImplementedException`, and `{ error: [...] }` for `ValidationPipe`'s
`BadRequestException`, whose `message` is an array of per-field strings - confirmed live
against a real container, not assumed from reading the source alone (see verification
below).

### Validation errors (Technical Notes)

Confirmed by design, not incidentally: `ValidationPipe`'s `BadRequestException` carries
`message` as a string array, and this filter reshapes it the same as any other
`HttpException` - `{ error: [...] }`. FR-5 pins no shape for `400`, so this is a
deliberate default, not a gap to close later.

### Section B - diagnostic evidence

Temporary `DiagTempController` (`backend/src/diag-temp.controller.ts`, registered
transiently in `AppModule.controllers`) exposed two routes: `GET
/backend/api/diag-temp/unauthorized` (`throw new UnauthorizedException()`) and `GET
/backend/api/diag-temp/boom` (`throw new Error('boom')`).

After `docker compose up -d --build`, via `curl -sk
https://www.tubesock.xyz/backend/api/diag-temp/unauthorized --resolve
www.tubesock.xyz:443:127.0.0.1`:

```
HTTP 401
{"error":"Unauthorized"}
```

Via `curl -sk https://www.tubesock.xyz/backend/api/diag-temp/boom --resolve
www.tubesock.xyz:443:127.0.0.1`:

```
HTTP 500
{"error":"Internal Server Error"}
```

`docker compose logs nest-api --since 30s` for the same `boom` request:

```
{"context":"AllExceptionsFilter","environment":"development","level":"error","message":"boom","requestId":"2i7ruujl","service":"portfolio","stack":["Error: boom\n    at DiagTempController.throwBoom (/app/backend/dist/diag-temp.controller.js:19:15)\n    ..."],"timestamp":"2026-08-21T02:35:57.426Z"}
```

The real message (`"boom"`) and full stack are present in the container's structured
log but absent from the client response, which only ever saw the generic `{ "error":
"Internal Server Error" }` body. `DiagTempController` and its `AppModule` registration
were then deleted - confirmed absent from `git status`/`git diff` (the module's
add-then-remove of the import/registration nets to zero diff on `app.module.ts`; only
`backend/src/main.ts` and the new `backend/src/common/filters/` directory show as
changed).

### Changed Files

+ backend/src/common/filters/all-exceptions.filter.ts   `AllExceptionsFilter`: reshapes `HttpException` responses to `{ error: <message> }`, catches non-`HttpException` throws as `500 { error: 'Internal Server Error' }` and logs the original error/stack
~ backend/src/main.ts                                    registers `AllExceptionsFilter` via `app.useGlobalFilters(...)`

### Verification

- `pnpm --filter @portfolio/backend typecheck` - passed, no output.
- `pnpm --filter @portfolio/backend lint` - passed; only the pre-existing
  `no-floating-promises` warning on `bootstrap();` in `main.ts` (present before this
  story's changes, per stories 4.1/4.2's Dev Notes).
- `pnpm --filter @portfolio/backend build` - passed (`nest build`, no output/errors).
- `docker compose up -d --build` (with the temporary `DiagTempController` present) -
  full stack came up; `curl -sk https://www.tubesock.xyz/backend/api/health --resolve
  www.tubesock.xyz:443:127.0.0.1` returned `200` `{"status":"ok"}`.
- Diagnostic routes exercised as pasted above in Section B: `401` `{"error":
  "Unauthorized"}` and `500` `{"error":"Internal Server Error"}`, with the real
  `"boom"` message and stack visible only in `docker compose logs nest-api`.
- Spot-checked three existing Epic 2 stub endpoints via `curl` after removing the
  diagnostic controller and rebuilding: `GET /backend/api/token-info/1`, `GET
  /backend/api/token-info/search/foo`, and `GET /backend/api/summary/coins` each
  returned `501` `{"error":"Not Implemented"}` - Nest's default `NotImplementedException`
  body reshaped by the filter, as expected.
- `docker compose up -d --build` again after deleting `DiagTempController` - full stack
  came up; `GET /backend/api/health` still `200` `{"status":"ok"}`, and `GET
  /backend/api/diag-temp/unauthorized` now `404` `{"error":"Cannot GET
  /backend/api/diag-temp/unauthorized"}` (also correctly reshaped by the same filter,
  for Nest's own `NotFoundException` on an unmatched route) - confirms the diagnostic
  route is gone from the running container, not just the source tree.
- `git status --porcelain` (final) - only `backend/src/main.ts` (modified) and
  `backend/src/common/filters/` (new) show as changed; no trace of
  `diag-temp.controller.ts` or its `AppModule` registration.
