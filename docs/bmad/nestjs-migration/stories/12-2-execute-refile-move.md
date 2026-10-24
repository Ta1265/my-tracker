# Story 12.2: Move `session.ts` and `authSession.ts` into `frontend/src/auth/`

Status: Done

## Context

Executes the move story 12.1 surveyed and approved: `frontend/src/server/session.ts` and
`frontend/src/server/authSession.ts` relocate to `frontend/src/auth/`, beside `target.ts`,
`actions.ts`, and `useCurrentSession.ts`. Depends on 12.1 for the exact destination
filename of `authSession.ts` - use whatever name that story's Dev Notes settled on; if it
kept `authSession.ts` unchanged, this story does too.

This is a rename plus import-specifier updates only: no exported name, function
signature, or runtime behavior changes (GR-1's clarification; architecture D64).
`frontend/src/server/auth.ts` is not touched - `authSession.ts` keeps importing
`getServerAuthSession` from it, now via `@/server/auth` rather than a relative path,
since the file moved out of that directory.

**Sequencing note carried from the PRD, not requiring action here:** `architecture.md`
has five path citations of these two files written against the pre-move location on
purpose (Overview, Session design, `packages/shared` scope-and-build, D25, D64). Story
12.2 does not edit `architecture.md` - repointing those five citations is a
`bmad-architect` obligation discharged in a separate pass once this story lands, not
something this story's scope includes. This story's Dev Notes must record that the five
citations are now stale and name architecture.md's "Epic 12" paragraph under
`## Migration / Rollout Strategy` as the inventory, so the handoff is explicit.

## Acceptance Criteria

- [ ] `frontend/src/server/session.ts` moves to `frontend/src/auth/session.ts` with no
  content change beyond import specifiers.
- [ ] `frontend/src/server/authSession.ts` moves to
  `frontend/src/auth/<name from 12.1>.ts` with no content change beyond import
  specifiers.
- [ ] `frontend/src/middleware.ts` imports `verifySessionToken` from `@/auth/session`
  instead of `@/server/session`.
- [ ] `frontend/src/app/page.tsx` and `frontend/src/app/login/page.tsx` import `getSession`
  from `@/auth/<name from 12.1>` instead of `@/server/authSession`.
- [ ] The moved `authSession.ts`'s own imports of `toSession`/`verifySessionToken` from
  its sibling `session.ts` stay a relative specifier (same directory, unchanged path);
  its import of `getServerAuthSession` changes to `@/server/auth` (an alias import,
  replacing whatever relative path it used from inside `frontend/src/server/`).
- [ ] No `index.ts` barrel is added to `frontend/src/auth/` - `authSession.ts` imports
  `next/headers` and is server-only, while `target.ts`/`actions.ts`/`useCurrentSession.ts`
  are `'use client'`; a barrel would pull the server-only import into a client bundle.
  Every importer continues to name the moved file directly.
- [ ] No file under `frontend/src/app/api/` or the remainder of `frontend/src/server/` is
  touched.
- [ ] `frontend/src/server/` no longer contains `session.ts` or `authSession.ts`.
- [ ] `docker compose up -d --build` builds the production `next-app` image successfully,
  proving the GR-5 Dockerfile wiring (the `@portfolio/shared` copy/build step landed by
  story 6.2) still resolves the package on the new import path - the load-bearing check,
  since `middleware.ts` reaches `@portfolio/shared`'s `SESSION_COOKIE_NAME` through the
  moved `session.ts` on the Edge runtime.
- [ ] Login, logout, the nav username, `/stats` and `/product/*` gating, and the
  server-side redirects on `/` and `/login` all behave exactly as before this story, on
  the shipped (post-Epic-7) default seam targets - no `NEXT_PUBLIC_AUTH_TARGET` or
  `NEXT_PUBLIC_API_TARGET` override.
- [ ] This story's Dev Notes record that `architecture.md`'s five pre-move citations
  (Overview, Session design, `packages/shared` scope-and-build, D25, D64) are now stale,
  point at the "Epic 12" paragraph under `## Migration / Rollout Strategy` as the
  inventory of what needs repointing, and state that repointing is a separate
  `bmad-architect` pass, not this story's own scope.

## Technical Notes

Current import graph (four importers, three of them external to the moved files):
- `frontend/src/app/page.tsx:2` - `import { getSession } from '@/server/authSession'`
- `frontend/src/app/login/page.tsx:2` - same
- `frontend/src/middleware.ts:6` - `import { verifySessionToken } from '@/server/session'`
- `frontend/src/server/authSession.ts:6` - imports `toSession`, `verifySessionToken` from
  `./session` (sibling; stays relative after the move, since both files move together)

`session.ts` exports `verifySessionToken` and `toSession`, and imports `SESSION_ALGORITHM`
from `@portfolio/shared` to consume internally - a **runtime** import, per GR-5. (It does
not re-export it; the GR-5 argument rests only on the import being a runtime one, which
holds either way.)
`authSession.ts` and `middleware.ts` both import `SESSION_COOKIE_NAME` from
`@portfolio/shared` as a runtime value too. None of these three runtime imports of
`@portfolio/shared` change; only the file paths that contain them move. This is why the
production image build is an acceptance criterion rather than an assumption - it is the
only check that proves the Edge-bundled path still resolves the workspace package.

`middleware.ts` runs on the Edge runtime (Next.js 14.0.1 has no Node runtime opt-out for
middleware - architecture finding F1). Verify its import resolves correctly under a real
build, not just `tsc`, since Edge bundling is a separate step from the type-checker.

**Verification:** `pnpm --filter @portfolio/frontend typecheck && pnpm --filter
@portfolio/frontend lint`; `git status --porcelain frontend/src/server frontend/src/auth`
to confirm exactly the two files moved and nothing else in either directory changed;
`grep -rn "@/server/session\|@/server/authSession" frontend/src` returns no hits;
`docker compose up -d --build next-app` succeeds; then a manual browse per this epic's
`## Gate` - login, logout, nav username, `/stats` and `/product/*` gating, `/` and
`/login` redirects, all on the shipped default seam targets.

## Out of Scope

Repointing `architecture.md`'s five stale citations - a `bmad-architect` pass after this
story lands (architecture.md D64; PRD Epic 12 section). Any file under
`frontend/src/server/` other than the two named here - story 12.1's survey is the record
of what stays and why. Editing `frontend/src/server/auth.ts` - GR-1 protects it and this
epic does not touch it.

## Dev Notes

`authSession.ts` moved to `frontend/src/auth/serverSession.ts`, the name story 12.1 settled
on. Both files moved with `git mv`, so the rename is recorded as a rename rather than as an
add plus a delete.

Only one import specifier inside the moved files changed: `getServerAuthSession` now comes
from `@/server/auth` instead of `./auth`, since the file no longer sits in that directory.
The sibling import of `toSession`/`verifySessionToken` stayed relative (`./session`) because
both files moved together, and `getAuthTarget` kept its existing `@/auth/target` alias -
correct from the new location and left alone rather than converted to a relative path.

No barrel was added to `frontend/src/auth/`. `serverSession.ts` imports `next/headers` and
is server-only; `target.ts`, `actions.ts` and `useCurrentSession.ts` are `'use client'`.

### `architecture.md` citations are now stale

Five path citations in `architecture.md` were written against the pre-move location on
purpose and are stale as of this story: **Overview**, **Session design**, **`packages/shared`
scope-and-build**, **D25**, and **D64**. The inventory of what needs repointing is the
"Epic 12" paragraph under `## Migration / Rollout Strategy`.

Repointing them is **not this story's scope**. It is a `bmad-architect` pass discharged
separately once this story lands, per architecture.md D64 and the PRD's Epic 12 section.

### Changed Files

~ frontend/src/app/login/page.tsx        imports getSession from @/auth/serverSession
~ frontend/src/app/page.tsx              imports getSession from @/auth/serverSession
+ frontend/src/auth/serverSession.ts     moved from server/authSession.ts, renamed per 12.1
+ frontend/src/auth/session.ts           moved from server/session.ts, unchanged content
~ frontend/src/middleware.ts             imports verifySessionToken from @/auth/session
- frontend/src/server/authSession.ts     moved to auth/serverSession.ts
- frontend/src/server/session.ts         moved to auth/session.ts

### Verification

- `pnpm --filter @portfolio/frontend typecheck` - output is byte-identical to the
  pre-change baseline (verified by stashing the change and diffing): 15 errors, all
  pre-existing and all in GR-1-protected legacy files (`components/*`,
  `server/db/storeTransactions.ts`). None in any file this story touched. The frontend
  typecheck was already red before this story; story 1.6 enforced the *backend* one.
- `pnpm --filter @portfolio/frontend lint` - warnings only, all in legacy files, same set
  as baseline. No errors.
- `grep -rn "@/server/session\|@/server/authSession" frontend/src` - no hits.
- `git status --porcelain frontend/src/server frontend/src/auth` - exactly two renames,
  nothing else in either directory changed. `frontend/src/server/` retains `auth.ts`,
  `logger.ts`, `metrics.ts`, `redisClient.ts`, `db/`, `helpers/`.
- **Production image build** - `TARGET=prod docker compose build next-app` succeeds:
  `✓ Generating static pages (13/13)` and `ƒ Middleware 71.8 kB`. The middleware bundling
  at all is the load-bearing result, since it is the only check that proves the Edge bundle
  still resolves `@portfolio/shared` through the moved `session.ts`.
  Note `docker-compose.yml` sets `target: ${TARGET:-dev}`, and the dev target skips
  `pnpm --filter @portfolio/frontend build` - so a plain `docker compose up --build` does
  **not** exercise `next build` and does not satisfy this criterion. `TARGET=prod` is
  required. This epic's `## Gate` command has been corrected to match.
- **Unauthenticated route behavior** on the running prod image, shipped default targets, no
  `NEXT_PUBLIC_AUTH_TARGET` / `NEXT_PUBLIC_API_TARGET` override:
  `/` -> 307 to `/login` (server component path, through the moved `serverSession.ts`);
  `/login` -> 200; `/stats` -> 307 to `/login?callbackUrl=%2Fstats` and
  `/product/bitcoin` -> 307 to `/login?callbackUrl=%2Fproduct%2Fbitcoin` (Edge middleware
  path, through the moved `session.ts`). Both moved files are exercised.
- **Not verified here, and left to the epic gate:** the authenticated half - login, the nav
  username, logout, and the redirect off `/login` when a session exists - needs real
  credentials.
