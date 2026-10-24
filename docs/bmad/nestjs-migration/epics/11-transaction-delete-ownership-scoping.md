# Epic 11: Ownership scoping on transaction delete

Status: Complete

Stories: 11.1
Depends on: 5
Base commit: dc3ae6273c58980591294d6a85224ab4cf58244d

## Scope

Implement FR-27: `DELETE /transaction/:id` in the NestJS backend deletes only rows
belonging to the authenticated caller, where today's Next.js route (and the NestJS port
built in story 5.1) deletes any row by bare `id`. One behavior change, one endpoint,
recorded as the eighth intentional divergence in `inventory-endpoint-contracts.md`. No
response shape, status code, or error body changes - a foreign id folds into the same
`500` a nonexistent id already produces, so the two cases stay indistinguishable to the
caller. `frontend/src/app/api/transaction/[id]/route.ts` is not touched (GR-1); it keeps
serving today's unscoped behavior for the whole coexistence window.

This is the last point in the initiative where the tightening can be diffed against the
old route: both routes serve traffic here, so this story's NFR-4 evidence records the
old route's response and the new route's response for the same foreign-id case side by
side. After Epic 7's cutover there is no old route left to diff against, which is why the
PRD requires this epic to complete before Epic 7 rather than land as a later cleanup.

Single-story epic, the same shape as Epic 6.

## Changed Files

~ backend/src/transactions/transactions.controller.ts    `delete` passes `user.sub` as the new `userId` argument; the stale "deliberately not scoped" comment is removed; the `500` `@ApiResponse` description is reworded to state a foreign-owned id is indistinguishable from a nonexistent one
~ backend/src/transactions/transactions.service.ts       `deleteTransaction` takes a second `userId` parameter and filters the `nativeDelete` on `{ id, userId }`; leading comment updated to describe the three cases (miss, throw, foreign-owned row) the zero-affected branch now folds into the same 500

## Review Notes

### Round 1

Depth: `backend/src/transactions/**` deep (authorization boundary, changed behavior with
a live consumer) · rest of the diff is those two files only, so no other group.

- **F1** [blocking · acceptance criteria] `docs/bmad/nestjs-migration/stories/11-1-scope-delete-to-owner.md:179-189` - AC F's required confirmation ("confirm whether Orval emits `@ApiResponse` descriptions as JSDoc at all - do not assume either way") is recorded in Dev Notes as a fact that is false, and the false version is the one a future reader will act on.
  Dev Notes states: "`frontend/src/api/generated.ts` has zero JSDoc comments anywhere in the file (checked the `deleteTransaction` export and its surrounding React Query helpers) - this Orval config does not emit `@ApiResponse` `description` text as JSDoc at all". The file has 61 JSDoc blocks, and one of them sits directly above the export named in the claim - `frontend/src/api/generated.ts:733-736`:
  ```ts
  /**
   * Delete the caller's transaction by id.
   */
  export const deleteTransaction = async (
  ```
  That text is the `@ApiOperation` `description` from `backend/src/transactions/transactions.controller.ts:64`, so Orval demonstrably does emit Swagger description text as JSDoc. The same pattern appears at `generated.ts:403, 487, 533, 643, 818, 928, ...` for every other operation.
  The *outcome* is correct and I verified it independently: the running `nest-api` serves the new text (`/backend/docs-json` -> the `500` response description reads "The delete failed: no row with that id, or the id belongs to another user - the two are indistinguishable to the caller."), so the regen did run against the updated spec, and `git diff HEAD -- frontend/src/api/generated.ts` is empty. The real reason it is empty is narrower than what is recorded: Orval emits the **operation** description as JSDoc and does not emit **per-response** descriptions, so a change confined to `@ApiResponse` cannot move the file - but a change to `@ApiOperation.description` would.
  The recorded generalization inverts that, and `CLAUDE.md` notes no build or check catches a stale generated client, so a future story that edits an `@ApiOperation` description and skips the regen on the strength of this note would ship a stale client silently. Rewrite the AC F Dev Note to state the actual mechanism; no code change is needed.
  - Status: Fixed - verified independently (61 JSDoc blocks in `generated.ts`; `deleteTransaction`'s JSDoc at `generated.ts:733-736` is the `@ApiOperation.description` from `transactions.controller.ts:64`; the `@ApiResponse` 500 description text this story edited does not appear anywhere in `generated.ts`). Rewrote `stories/11-1-scope-delete-to-owner.md`'s AC F Dev Note to state the operation-vs-per-response mechanism; no code change.

- **F2** [advisory · conventions] `backend/src/transactions/transactions.service.ts:51-53` - the replacement leading comment runs to three lines, against `CLAUDE.md`'s "two lines at most" for a comment that survives the does-a-reader-need-this test.
  ```ts
  // `nativeDelete` returns an affected-row count rather than throwing on a miss, so the
  // zero-affected branch below now folds three cases into the same 500: a genuine miss,
  // a delete that throws, and a row that exists but belongs to another user.
  ```
  The content is what AC A asked for and it earns its place - the fold is the deliberate divergence, which is knowledge external to the file. Only the length is off, and "now" and "below" are the slack: "now" dates the comment against a change no future reader can see, and "below" points at the next four lines. The three cases fit in two lines without them. Not blocking.
  - Status: Fixed - `transactions.service.ts:51-52` now reads: "`nativeDelete` returns an affected-row count rather than throwing on a miss, so the / zero-affected branch folds a genuine miss, a throw, and a foreign-owned row into one 500." Two lines, no "now"/"below".

**Checked and clear**, recorded so the owner does not re-derive it:

- The `500`-on-foreign-id indistinguishability holds on every channel I could find, not just the response body. Both cases reach the identical `throw` at `transactions.service.ts:63`; `AllExceptionsFilter` (`backend/src/common/filters/all-exceptions.filter.ts`) takes the `HttpException` branch, which emits `{ error: 'An error occurred while deleting the transaction' }` and **does not log** - only the non-`HttpException` branch calls `logger.error`. `HttpMetricsInterceptor` labels on `method`/`path`/`status_code` only, so both cases increment the same series. The emitted SQL is one statement with the same shape either way. No oracle.
- The check is object-level and atomic - the ownership predicate is in the `DELETE`'s own `WHERE`, not a read-then-delete, so there is no TOCTOU gap and it fails closed.
- AC D cleanup verified live against `portfolio-db`, not taken on trust: `SELECT COUNT(*) FROM User WHERE username LIKE 'story111temp%'` -> `0`, `Transaction WHERE id IN (2000,2001,2002,2003)` -> `0`, `Transaction WHERE userId NOT IN (1,2)` -> `0`, and `User` holds exactly `1 Taylor` / `2 test`. No trace remains.
- AC C verified: `inventory-endpoint-contracts.md:707-724`'s eighth row and its following paragraph describe the shipped behavior exactly - same status code, same error body, "not yours" and "does not exist" indistinguishable, old route untouched.
- GR-1 verified: `git diff <base> -- frontend/src/app/api frontend/src/server` is empty; `frontend/src/app/api/transaction/[id]/route.ts` is untouched.
- The signature change is contained. `deleteTransaction` has exactly one caller in the repo (`transactions.controller.ts:97`); the frontend calls the generated client, whose `deleteTransaction(id)` signature is unchanged.
- `frontend/next-env.d.ts` is excluded from this review as directed - Next auto-managed, unrelated, and unstaged.

### Round 2

Depth: re-review - adjudicate Round 1's two findings against the files, then check what
changed since. The only code change this round is a comment in
`backend/src/transactions/transactions.service.ts`, so that file gets standard depth and
the authorization logic gets a re-confirmation that it is byte-identical to what Round 1
cleared. No new group.

- **F1** [blocking · acceptance criteria] - **Resolved.** The rewritten AC F Dev Note
  (`stories/11-1-scope-delete-to-owner.md:179-194`) states the mechanism correctly, and I
  re-derived every load-bearing claim in it rather than taking the fix note on trust:
  - "61 JSDoc blocks" is exact - `grep -c '/\*\*'` -> `61` (22 at column 0 above exported
    operations, 39 indented above DTO properties).
  - `deleteTransaction`'s JSDoc is `"Delete the caller's transaction by id."` and matches
    `transactions.controller.ts:64`'s `@ApiOperation.description` verbatim. Every other
    top-level JSDoc in the file is likewise an `@ApiOperation.description` - I checked all
    22 against the controllers, including the one that made me look twice (`generated.ts:2292`
    contains the substring "No session", but it is `setPriceHistory`'s *operation*
    description, not the `401` `@ApiResponse.description` "No session." - so it is not a
    counterexample to the note's rule).
  - The per-response direction holds under grep: none of `'The delete failed'`,
    `'Transaction deleted'`, or `'Missing id parameter'` appears in `generated.ts`.
  - The typed error unions the note names exist as written -
    `DeleteTransaction400 | DeleteTransaction401 | DeleteTransaction500`, declared at
    `generated.ts:239/243/247` and used at `747/787/791`. Not a hallucinated reference.

  The note now closes the failure mode the finding was actually about: it says in as many
  words that a future story editing `@ApiOperation.description` "would move this file and
  must not skip the regen on the strength of this note", so the generalization a reader
  can draw from it is the true one. `git diff HEAD -- frontend/src/api/generated.ts` is
  still empty, which is now the correct expectation rather than a coincidence. (Nit, not
  a finding: the note cites the JSDoc block as `generated.ts:733-736`; it is 733-735, with
  736 being the `export` line. The quoted text is unambiguous.)
  - Status: Resolved

- **F2** [advisory · conventions] `backend/src/transactions/transactions.service.ts:51-52` -
  **Resolved.** Two lines, "now" and "below" gone, content intact:
  ```ts
  // `nativeDelete` returns an affected-row count rather than throwing on a miss, so the
  // zero-affected branch folds a genuine miss, a throw, and a foreign-owned row into one 500.
  ```
  Longest line is 95 columns, inside this repo's `printWidth: 100`. Still satisfies AC A's
  requirement to name all three folded cases, and still cites no requirement id.
  - Status: Resolved

**No-drift check** (asked for explicitly after an earlier epic lost characters mid-review):

- `git diff dc3ae62 --stat` and `git diff HEAD --stat` are identical - no commits sit above
  the baseline, so the whole epic is the uncommitted tree.
- `--numstat` is `4 4` on each backend file: exactly the four changed lines per file that
  Round 1 reviewed, and not one line more. `--ignore-all-space` produces the same stat, so
  nothing was lost to whitespace either. No non-ASCII or control characters in either file.
- The authorization logic is untouched by this round:
  `em.nativeDelete(Transaction, { id, userId })` at `transactions.service.ts:56` and
  `deleteTransaction(parseInt(id, 10), user.sub)` at `transactions.controller.ts:97` are
  byte-identical to what Round 1 cleared. The `affected === 0` branch and its message are
  unchanged.
- Working tree holds nothing else in scope: `git status --porcelain` lists only the two
  backend files, `frontend/next-env.d.ts` (excluded as directed - Next auto-managed,
  unrelated), and the untracked `docs/` and `.claude/skills/bmad/` trees. `docs/`'s only
  non-markdown files are `mikroorm-generator-raw/*.ts`, an Epic 3 artifact, not this epic's.

No blocking finding remains open. Epic goes to Owner Review.

## Owner Feedback
