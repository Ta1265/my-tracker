# Epic 12: Refile the auth seam's server modules out of `frontend/src/server/`

Status: Complete

Stories: 12.1, 12.2
Depends on: 6, 7
Base commit: 6485bf2

## Scope

Move `frontend/src/server/session.ts` and `frontend/src/server/authSession.ts` into
`frontend/src/auth/`, updating their four importers, as a pure path change - no exported
name, signature, or runtime behavior moves. `frontend/src/server/auth.ts` is not edited;
`authSession.ts` keeps importing `getServerAuthSession` from it, as `@/server/auth`. This
is not a GR-1 relaxation: both files were created by this initiative (Epic 4, story 6.2)
and were never in the set GR-1 protects.

## Gate

Artifact: the running app's login/logout/nav-gating flow and a production `next-app`
image build, exercised against the shipped (post-Epic-7) defaults.

Bring it up with: `TARGET=prod docker compose up -d --build` (no `NEXT_PUBLIC_AUTH_TARGET`
or `NEXT_PUBLIC_API_TARGET` override). `TARGET=prod` is required and was missing from this
line as originally drafted: `docker-compose.yml` sets `target: ${TARGET:-dev}`, and the dev
target skips `pnpm --filter @portfolio/frontend build`, so the default command never runs
`next build` and cannot prove the Edge bundle resolves.

Passes when: `/`, `/login`, `/stats`, and `/product/*` all gate and redirect exactly as
they did before this epic - same cookie, same middleware matcher, same nav username
behavior - and the production `next-app` image builds successfully with the
`@portfolio/shared` copy/build step in `frontend/Dockerfile` still wired (GR-5), since
`frontend/src/middleware.ts` reaches `@portfolio/shared` through the moved `session.ts`
on the Edge runtime. Reading the diff does not exercise the Edge path or prove the image
still builds; both need the real build and a real browse.

## Changed Files

~ frontend/src/app/login/page.tsx        imports getSession from @/auth/serverSession
~ frontend/src/app/page.tsx              imports getSession from @/auth/serverSession
+ frontend/src/auth/serverSession.ts     moved from server/authSession.ts, renamed per 12.1
+ frontend/src/auth/session.ts           moved from server/session.ts, unchanged content
~ frontend/src/middleware.ts             imports verifySessionToken from @/auth/session
- frontend/src/server/authSession.ts     moved to auth/serverSession.ts
- frontend/src/server/session.ts         moved to auth/session.ts

## Review Notes

### Round 1

Depth: `frontend/src/auth/**` + `frontend/src/middleware.ts` + the two page importers deep
(auth trust boundary), rest standard. The deep pass is short by construction: `git diff -M`
reports `session.ts` at 100% rename similarity and `serverSession.ts` at 94%, and the single
changed line in the latter is an import specifier, so no auth logic, claim handling, or cookie
read is altered by this diff.

Verified independently rather than from Dev Notes:

- Both moves are recorded as renames; `frontend/src/auth/session.ts` is byte-identical to the
  old `frontend/src/server/session.ts`. The only content change in the epic's two moved files
  is `serverSession.ts:5`, `./auth` -> `@/server/auth`, which is the correct specifier for the
  new location (`@/*` maps to `./src/*` in `frontend/tsconfig.json`).
- No stale references remain. Repo-wide grep for `@/server/session`, `@/server/authSession`,
  `../server/session` and `./authSession` outside `node_modules`/`.next` returns nothing; the
  only surviving `authSession` identifiers are the unrelated Orval-generated operation of the
  same name in `frontend/src/api/generated.ts` and its source `operationId` in
  `backend/src/auth/auth.controller.ts`.
- No config, script, or build input points at the moved paths. `frontend/Dockerfile` copies
  `frontend/src` wholesale, `next.config.js` has no path-sensitive config, and the two
  `src/server` references in `frontend/package.json` (`scrapeCoins`, Prisma `schema`) are
  unaffected.
- `npx tsc --noEmit` in `frontend/` reproduces the claimed baseline: errors only in
  `src/components/**` and `src/server/db/storeTransactions.ts`, none in `src/auth/**`,
  `src/middleware.ts`, `src/app/page.tsx`, or `src/app/login/page.tsx`.
- No `index.ts` barrel exists in `frontend/src/auth/`, so the server-only `next/headers`
  import in `serverSession.ts` still cannot be pulled into a client bundle by a re-export.
- Story 12.1's survey table matches the directory: `ls` of `frontend/src/server`, `db/` and
  `helpers/` yields exactly the rows recorded, and `session.ts`/`authSession.ts` are the only
  two entries gone from it.

Every acceptance criterion in 12.1 and 12.2 that this diff can satisfy is satisfied. No
blocking findings.

- **F1** [advisory · correctness] `docs/bmad/nestjs-migration/stories/12-2-execute-refile-move.md:74`
  - Story Technical Notes describe `session.ts` as re-exporting `SESSION_ALGORITHM`; it does
  not. The file writes `import { SESSION_ALGORITHM, type SessionClaims } from '@portfolio/shared'`
  and consumes the value inside `verifySessionToken`; there is no `export` of it. Story 12.1's
  Technical Notes carry the same wording. The GR-5 argument built on it is unaffected - it is a
  runtime import either way - so this is a documentation nit only, and no code change follows
  from it.
  - Status: Open

Not verified by this pass, and deliberately left to the owner's gate: the authenticated half
of the flow - login, logout, the nav username, and the redirect off `/login` with a session
present. Story 12.2's Dev Notes are explicit that it needs real credentials and covers only
the unauthenticated redirects. Reading the diff cannot substitute for it, and neither can the
image build. The epic's `## Gate` is the check that closes it.

## Owner Feedback

Owner signed off on 2026-08-27 with no change requests.

Recorded honestly for whoever picks this up: the owner did not report back on the
authenticated half of the `## Gate` browse - login, logout, the nav username, and the
redirect off `/login` with a session present. That criterion is therefore **owner-accepted,
not verified**. Everything else in the gate was checked and passed (see `## Review Notes`
round 1 and story 12.2's Verification).

**Committed as `7ab1a99`.** The five paths in `## Changed Files` landed exactly as listed;
the two moves registered as renames (R100 and R094) and `frontend/next-env.d.ts` stayed
unstaged. An earlier session had recorded the commit as blocked by its permission
classifier; it has since landed and the epic is `Complete`.

**F1 needed no fix.** A follow-up pass on 2026-08-27 checked both story files against the
finding: `12-1-survey-server-folder.md:50` reads "it imports the value, it does not
re-export it" and `12-2-execute-refile-move.md:76` reads "not re-export it; the GR-5
argument rests only on the import being a runtime one". Neither carries the wording F1
describes, so no edit was made. The finding's own `Status: Open` is left as the reviewer
wrote it. Recorded here because the discrepancy is unexplained - either the text was
corrected outside the record, or the finding was written against a misread.
