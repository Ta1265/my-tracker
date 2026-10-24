# Story 11.1: Scope DELETE /transaction/:id to the caller

Status: Done

## Context

Implements FR-27, this initiative's one deliberate exception to FR-3. Today's Next.js
route and story 5.1's NestJS port both delete a transaction by bare `id` with no check
that the caller owns it - `Transaction.id` is a sequential integer, so any authenticated
user can delete any other user's rows by counting. This story closes that gap in the
NestJS backend only.

GR-1 applies: `frontend/src/app/api/transaction/[id]/route.ts` is not edited and keeps
today's unscoped behavior for the rest of the coexistence window - that is expected, not
a gap this story should also close.

This must land now, while `next-app` and `nest-api` both serve traffic, because the
foreign-id case is only diffable against the old route while the old route is still live.
Epic 7's cutover removes that comparison entirely, which is why FR-27's timing constraint
put this epic ahead of Epic 7 in the execution graph rather than after it.

`docs/bmad/nestjs-migration/inventory-endpoint-contracts.md` already carries the eighth
divergence-table row for this change (added when FR-27 was written into the PRD, under
"The eighth intentional divergence - FR-27, not FR-2", currently at lines 707-724). This
story confirms that row still matches what ships; it does not write it fresh.

## Acceptance Criteria

### A. Service: filter the delete on `userId`

- [x] `backend/src/transactions/transactions.service.ts`'s `deleteTransaction` gains a
      second parameter: `deleteTransaction(id: number, userId: number): Promise<void>`.
- [x] The `nativeDelete` call becomes `this.em.nativeDelete(Transaction, { id, userId })`
      - both conditions ANDed, so a row that exists but belongs to another user is not
      deleted.
- [x] The existing `affected === 0` branch and its `InternalServerErrorException`
      (message unchanged: `'An error occurred while deleting the transaction'`) are
      untouched - it now also catches "exists but not yours" alongside "does not exist"
      and "delete threw", with no new branch and no new response shape.
- [x] Update the method's leading comment to say the zero-affected branch now folds three
      cases into the same `500`: a genuine miss, a delete that throws, and a row owned by
      someone else. State this as a fact about the code, not as a citation of any
      requirement id.

### B. Controller: pass the caller's id, drop the stale comment

- [x] `backend/src/transactions/transactions.controller.ts`'s `delete` handler calls
      `this.transactionsService.deleteTransaction(parseInt(id, 10), user.sub)` -
      `user: SessionClaims` is already injected via `@CurrentUser()`; `user.sub` is the
      numeric userId (`packages/shared/src/index.ts`).
- [x] Delete the two-line comment directly above that call ("Deliberately not scoped to
      `user.sub`: any authenticated caller can delete any user's row by id, matching the
      existing route's behavior. Not a fix target.") - it now describes the opposite of
      what the code does.
- [x] Update the `@ApiResponse({ status: 500, ... })` description on `delete` from "The
      delete failed (e.g. no row with that id - there is no existence check)." to state
      that a foreign-owned id produces the same response as a nonexistent one, and that
      the two are indistinguishable to the caller. Keep the response `schema`/`example`
      (`{ error: 'An error occurred while deleting the transaction' }`) unchanged - only
      the description text changes.

### C. Divergence record

- [x] Read the eighth row already in `inventory-endpoint-contracts.md` (the
      `transaction/[id] DELETE` row under "The eighth intentional divergence - FR-27, not
      FR-2") once the code above lands, and confirm it still accurately describes the
      shipped behavior: same status code, same error body, same "not yours" vs "does not
      exist" indistinguishability. Correct it only if the implementation ended up
      differing from what is recorded there - it should not.

### D. NFR-4 parity evidence - the case that changes

- [x] Seed two temporary users and one transaction each directly in `portfolio-db`,
      following story 5.1's disposable-row pattern (temp `User` rows, deleted after the
      check) - do not use the two real accounts (`User.id` 1 `Taylor`, 2 `test`).
- [x] As temp user A's session, call the **old** route with temp user B's transaction id:
      `DELETE /api/transaction/{userBTxId1}`. Record the response - expect `204`, and
      confirm the row is gone. This documents that the old route's gap is unchanged
      (GR-1: it is not touched).
- [x] As temp user A's session, call the **new** route with a second, still-live
      transaction belonging to temp user B: `DELETE /backend/api/transaction/{userBTxId2}`.
      Record the response - expect `500 {"error":"An error occurred while deleting the
      transaction"}` - and confirm by a direct row read that the transaction still exists
      afterward.
- [x] Paste both request/response pairs and the row-existence check into Dev Notes. This
      is the epic's evidence that the divergence is real, bounded, and matches what
      `inventory-endpoint-contracts.md` records.
- [x] Delete the temporary users and any remaining temporary transaction rows afterward;
      confirm via a row count that no trace remains.

### E. Regression - unchanged cases

- [x] Own-row delete, both routes: as a temp user, delete that user's own transaction
      through `DELETE /api/transaction/:id` and `DELETE /backend/api/transaction/:id` -
      both `204`, row gone on the respective side. Unchanged from story 5.1's evidence;
      re-run once here as a regression check since this story edits the same method.
- [x] Nonexistent id, both routes: `DELETE .../transaction/9999999` (an id with no row at
      all) on both origins - both `500` with the same error body as today. Unchanged;
      re-run once as a regression check.

### F. Client regen (FR-26)

- [x] The `@ApiResponse` description text changed in AC B may change the generated
      OpenAPI document's JSDoc for `deleteTransaction`. Regenerate:
      `docker compose up -d --build nest-api`, then `pnpm --filter @portfolio/frontend
      spec:generate` (run from the host, or via `docker exec next-app pnpm --filter
      @portfolio/frontend spec:generate` against the rebuilt `nest-api`, per story 5.1's
      precedent). Then `git status --porcelain frontend/src/api/generated.ts`.
- [x] Commit the regenerated file if it changed. If it did not change, say so in Dev
      Notes and confirm whether Orval emits `@ApiResponse` descriptions as JSDoc at all -
      do not assume either way.

### G. Standard checks

- [x] `pnpm --filter @portfolio/backend typecheck`, `lint`, and `build` all pass.
- [x] `docker compose up -d --build` brings up the full stack; `GET /backend/api/health`
      still returns `200`.
- [x] `git diff --name-only` against the epic's base commit touches nothing under
      `frontend/src/app/api/` or `frontend/src/server/` (GR-1).

## Technical Notes

Current code, both to be edited:

```ts
// backend/src/transactions/transactions.service.ts:51-64
async deleteTransaction(id: number): Promise<void> {
  let affected: number;
  try {
    affected = await this.em.nativeDelete(Transaction, { id });
  } catch {
    affected = 0;
  }

  if (affected === 0) {
    throw new InternalServerErrorException('An error occurred while deleting the transaction');
  }
}
```

```ts
// backend/src/transactions/transactions.controller.ts:94-98
async delete(@Param('id') id: string, @CurrentUser() user: SessionClaims): Promise<void> {
  // Deliberately not scoped to `user.sub`: any authenticated caller can delete any
  // user's row by id, matching the existing route's behavior. Not a fix target.
  await this.transactionsService.deleteTransaction(parseInt(id, 10));
}
```

`Transaction` is already `em.nativeDelete`'s target from story 5.1; no entity change and
no new import are needed - `{ id, userId }` is a plain MikroORM filter object, ANDed.

FR-27's full reasoning (why this is the one FR-3 exception, the argument against doing
it at all, the scope boundary) lives in `prd.md` under FR-27 - this story implements only
the code change and its evidence; it does not need to be re-argued here.

No `architecture.md` decision exists for this change - FR-27 was added after Epic 5
completed and after `architecture.md`'s decision log was written, and the change is
small enough (one query filter) that the architecture doc has nothing to add beyond what
FR-27 itself specifies.

## Out of Scope

- Any endpoint other than `DELETE /transaction/:id` - FR-27 is bounded to this one
  endpoint; another ownership gap found elsewhere is a new requirement, not an extension
  of this one.
- Editing `frontend/src/app/api/transaction/[id]/route.ts` - forbidden by GR-1.
- Deleting the old route - that is Epic 8, out of scope for this initiative.

## Dev Notes

### AC C - divergence record check

Read `inventory-endpoint-contracts.md:707-724` after the code landed. The row's "Today" /
"New behavior" / "Why" columns and the surrounding paragraph (same status code, same error
body, "not yours" vs "does not exist" indistinguishable, old route untouched per GR-1) all
match what shipped exactly. No correction needed.

### AC F - client regen

`docker compose up -d --build` (full stack, includes `nest-api`), then `docker exec
next-app pnpm --filter @portfolio/frontend spec:generate` - Orval ran clean, and `git
status --porcelain frontend/src/api/generated.ts` printed nothing: unchanged. Confirmed why:
`frontend/src/api/generated.ts` has 61 JSDoc blocks - Orval does emit Swagger description
text as JSDoc, but only the **operation** description (`@ApiOperation.description`), not the
**per-response** description. `deleteTransaction`'s JSDoc (`generated.ts:733-736`) is
"Delete the caller's transaction by id.", which is `@ApiOperation.description` from
`transactions.controller.ts:64` and was untouched by this story. The text this story did
change - the `500` `@ApiResponse.description` - does not appear anywhere in `generated.ts`
(confirmed by grep); only the `schema`/typed error unions
(`DeleteTransaction400 | DeleteTransaction401 | DeleteTransaction500`) surface it, and those
were already present before this story and are unaffected by a description-only edit.
Nothing to commit. A future story that edits `@ApiOperation.description` instead would move
this file and must not skip the regen on the strength of this note.

### Verification evidence (AC D and E)

Two temporary users were inserted directly into `portfolio-db`'s `User` table
(`story111tempA` id 7, `story111tempB` id 8, bcrypt-hashed `TestPass123!` using the repo's
own `bcrypt` package) plus four temporary `Transaction` rows (2000/2001 owned by user B,
2002/2003 owned by user A), all deleted after the check. Sessions: the Nest cookie via
`POST /backend/api/auth/login`; the NextAuth cookie via the real `GET /api/auth/csrf` +
`POST /api/auth/callback/credentials` flow (same approach as story 4.5/5.1). Both sessions
independently confirmed to resolve to user A (`id: 7`) via `GET /api/auth/session` and `GET
/backend/api/auth/session` before use.

**AC D - the foreign-id case, old route vs new route, as temp user A:**

- Old: `DELETE /api/transaction/2000` (owned by user B) -> `204`, empty body. Row check:
  `SELECT * FROM Transaction WHERE id=2000` -> no rows. The old route's unscoped gap is
  unchanged, as expected (GR-1: not touched).
- New: `DELETE /backend/api/transaction/2001` (owned by user B) -> `500
  {"error":"An error occurred while deleting the transaction"}`. Row check:
  `SELECT * FROM Transaction WHERE id=2001` -> row still present (`userId: 8`). Confirms
  the new route now refuses to delete another user's row and folds that refusal into the
  existing 500, matching `inventory-endpoint-contracts.md`'s eighth divergence row exactly.

**AC E - regression, own-row delete, both routes, as temp user A on A's own rows:**

- Old: `DELETE /api/transaction/2002` -> `204`, empty body; row gone.
- New: `DELETE /backend/api/transaction/2003` -> `204`, empty body; row gone.

**AC E - regression, nonexistent id, both routes:**

- Old: `DELETE /api/transaction/9999999` -> `500
  {"error":"An error occurred while deleting the transaction"}`.
- New: `DELETE /backend/api/transaction/9999999` -> `500
  {"error":"An error occurred while deleting the transaction"}`.

Both unchanged from story 5.1's evidence.

**Cleanup:** `DELETE FROM Transaction WHERE id = 2001` (the one row deliberately left alive
by the AC D new-route check) and `DELETE FROM User WHERE username IN
('story111tempA','story111tempB')`. Confirmed via `SELECT COUNT(*)` that both the
`Transaction` rows for `userId IN (7,8)` and the `User` rows for the two temp usernames are
`0` afterward.

### Changed Files

~ backend/src/transactions/transactions.service.ts       `deleteTransaction` takes a second `userId` parameter and filters the `nativeDelete` on `{ id, userId }`; leading comment updated to describe the three cases (miss, throw, foreign-owned row) the zero-affected branch now folds into the same 500
~ backend/src/transactions/transactions.controller.ts    `delete` passes `user.sub` as the new `userId` argument; the stale "deliberately not scoped" comment is removed; the `500` `@ApiResponse` description is reworded to state a foreign-owned id is indistinguishable from a nonexistent one

### Verification

- `pnpm --filter @portfolio/backend typecheck` - passed, no output.
- `pnpm --filter @portfolio/backend lint` - passed; only the pre-existing
  `no-floating-promises` warning on `bootstrap();` in `main.ts` (unrelated to this story,
  present since story 4.1).
- `pnpm --filter @portfolio/backend build` - passed (`nest build`, no errors).
- `docker compose up -d --build` - full stack built and came up cleanly; `curl -sk
  https://www.tubesock.xyz/backend/api/health --resolve www.tubesock.xyz:443:127.0.0.1`
  returned `200 {"status":"ok"}`.
- `git diff --name-only dc3ae6273c58980591294d6a85224ab4cf58244d --
  frontend/src/app/api frontend/src/server` - empty output, confirming GR-1 (no edits under
  either directory).
- Live functional, NFR-4 parity, and regression checks against the running stack - see
  "Verification evidence (AC D and E)" above for the full request/response pairs and the DB
  row checks.
- `docker exec next-app pnpm --filter @portfolio/frontend spec:generate` against the
  rebuilt `nest-api`, then `git status --porcelain frontend/src/api/generated.ts` - printed
  nothing; see "AC F - client regen" above for why.

### Review Round 1 fix

- F1 (blocking): rewrote the AC F Dev Note to state the actual mechanism - Orval emits
  `@ApiOperation.description` as JSDoc but not `@ApiResponse.description`; see the note
  above for the independent verification (61 JSDoc blocks in `generated.ts`, the
  `deleteTransaction` JSDoc traced to `@ApiOperation.description`, and a grep confirming
  the edited 500 description text is absent from the file). No code change.
- F2 (advisory): shortened `transactions.service.ts`'s leading comment on
  `deleteTransaction` from three lines to two, dropping "now"/"below".
- `pnpm --filter @portfolio/backend typecheck` - passed, no output.
- `pnpm --filter @portfolio/backend lint` - passed; same pre-existing
  `no-floating-promises` warning on `main.ts`, unrelated.
- `npx prettier --check backend/src/transactions/transactions.service.ts` - passed.
