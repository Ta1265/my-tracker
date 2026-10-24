# Story 4.2: Injectable clock abstraction

Status: Done

## Context

**Blocks Epic 5** (PRD, architecture Migration section: "4.2 ... must be genuinely
finished, not stubbed" before any Epic 5 story starts). NFR-1 forbids any domain service
from calling `Date.now()`/`new Date()`/`dayjs()` directly - the clock has to be a
constructor-injected collaborator from day one, or every later story that reads "now"
(story 4.5's `rememberMe` expiry, and every Epic 5 time-frame boundary calculation
duplicated today at `dbService.ts:250-271` and `dbService.ts:372-392`) would need
unpicking afterward. This story lands the abstraction itself; its first real consumer is
story 4.5's session expiry calculation, not this story.

## Acceptance Criteria

### A. `Clock` interface and `SystemClock`

- [x] `backend/src/common/clock/clock.ts` exports `interface Clock { now(): Date }` and
      `export const CLOCK = Symbol('CLOCK')` as the DI token (a `Symbol`, not a bare
      string, to avoid an accidental collision with any other token named `'CLOCK'`).
- [x] `backend/src/common/clock/system-clock.ts` exports `class SystemClock implements
      Clock { now(): Date { return new Date(); } }` - the **only** place in
      `backend/src` a bare `new Date()` is permitted to appear, and it is inside the one
      class whose entire job is to wrap it.
- [x] `backend/src/common/clock/clock.module.ts` exports `@Global() class ClockModule`
      providing `{ provide: CLOCK, useClass: SystemClock }` and exporting `CLOCK` -
      `@Global()` matches `AppConfigModule`'s existing precedent (story 1.4), so every
      future module injects `@Inject(CLOCK) private readonly clock: Clock` without
      importing `ClockModule` itself.
- [x] `AppModule` imports `ClockModule`.

### B. Demonstration, then removed

- [x] Add a temporary diagnostic route (same convention as 3.4/4.1: added, exercised,
      evidence pasted into Dev Notes, then deleted) that constructor-injects `@Inject(CLOCK)
      clock: Clock` and returns `clock.now().toISOString()`. Confirm it resolves to a real,
      current timestamp - this proves the DI wiring resolves correctly, which is all this
      story needs to prove since there is no real consumer yet.
- [x] Delete the temporary controller and its `AppModule` registration before finishing -
      confirmed absent from `git status`/`git diff`.

### C. Regression

- [x] `pnpm --filter @portfolio/backend build`, `typecheck`, `lint` all pass.
- [x] `docker compose up -d --build` brings up the full stack; `GET /backend/api/health`
      through nginx still returns `200`.
- [x] `grep -rn 'new Date()\|Date.now()\|dayjs()' backend/src` returns nothing outside
      `backend/src/common/clock/system-clock.ts` - the one deliberate exception this
      story creates, and the check every later story can re-run to confirm it still holds.

## Technical Notes

### What this story deliberately does not build

**`TimeFrameService`** - architecture's module map names `common/time-frame/
TimeFrameService` as the thing that eventually takes this `Clock` and converts a
`TimeFrame` code into a date range, collapsing the duplicated arithmetic at
`dbService.ts:250-271`/`372-392`. It is not built here: no PRD story assigns it to Epic 4,
and there is no real consumer for it until whichever Epic 5 story first needs time-frame
boundary math. That story builds `TimeFrameService` against this story's `Clock`, not the
other way around.

### `dayjs`, not `moment` (architecture D30)

When `TimeFrameService` is eventually built, it uses `dayjs` (already a dependency
elsewhere in this initiative's design, `moment` being in maintenance mode) - this story
adds neither, since it has no date-arithmetic logic of its own, only the `now()` wrapper.

## Out of Scope

- `TimeFrameService` and any time-frame date-range arithmetic - whichever Epic 5 story
  first needs it.
- `rememberMe`'s actual 8h/30d expiry calculation - story 4.5, which consumes this
  story's `Clock`.
- Structured logging (4.1, sequenced before this story) and global error shaping (4.3,
  after).

## Dev Notes

### Section B - diagnostic evidence

Temporary `DiagTempController` (`backend/src/diag-temp.controller.ts`, registered
transiently in `AppModule.controllers`) constructor-injected `@Inject(CLOCK) private
readonly clock: Clock` and exposed `GET /backend/api/diag-temp/clock` returning `{ now:
this.clock.now().toISOString() }`.

After `docker compose up -d --build`, called it via `curl -sk
https://www.tubesock.xyz/backend/api/diag-temp/clock --resolve
www.tubesock.xyz:443:127.0.0.1`:

```
{"now":"2026-08-21T02:32:39.350Z"}
```

A real, current UTC timestamp - confirms the `CLOCK` token resolves to `SystemClock`
through DI. `DiagTempController` and its `AppModule` registration were then deleted -
confirmed absent from `git status` (only `backend/src/app.module.ts` and the new
`backend/src/common/clock/` directory show as changed).

### Changed Files

+ backend/src/common/clock/clock.ts           `Clock` interface and `CLOCK` DI token (Symbol)
+ backend/src/common/clock/system-clock.ts    `SystemClock`, the sole permitted `new Date()` call site
+ backend/src/common/clock/clock.module.ts    `@Global()` `ClockModule` providing/exporting `CLOCK`
~ backend/src/app.module.ts                   imports `ClockModule`

### Verification

- `pnpm --filter @portfolio/backend typecheck` - passed, no output.
- `pnpm --filter @portfolio/backend lint` - passed; only the pre-existing
  `no-floating-promises` warning at `main.ts:49` (present before this story's changes,
  per story 4.1's Dev Notes).
- `pnpm --filter @portfolio/backend build` - passed (`nest build`, no output/errors).
- `grep -rn 'new Date()\|Date.now()\|dayjs()' backend/src` - only hits are
  `backend/src/common/clock/system-clock.ts` (the implementation line and its
  explanatory comment); no occurrences anywhere else.
- `docker compose up -d --build` - full stack came up; `curl -sk
  https://www.tubesock.xyz/backend/api/health --resolve www.tubesock.xyz:443:127.0.0.1`
  returned `200` `{"status":"ok"}`, both with the diagnostic controller present (proving
  the DI wiring, see Section B evidence above) and again after its removal.
