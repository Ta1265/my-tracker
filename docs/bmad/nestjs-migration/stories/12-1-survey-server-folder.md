# Story 12.1: Survey `frontend/src/server/` and verdict every entry

Status: Done

## Context

Epic 12 relocates exactly two files - `session.ts` and `authSession.ts` - out of
`frontend/src/server/` into `frontend/src/auth/` (GR-1's clarification, PRD Epic 12
section). This story confirms that is the complete list rather than assuming it, and
settles the one naming question the move creates. It moves no files.

This survey is also the source material for Epic 13's developer-setup docs, specifically
the frontend repo-layout section that story draws from (PRD: "story 12.1's survey ... is
explicitly the source material Epic 13's layout section is written from"). Write the
table so a later reader - the SM drafting Epic 13's stories - can lift it directly,
without re-deriving it from the filesystem.

## Acceptance Criteria

- [ ] A table in this story's Dev Notes lists every file and subdirectory directly under
  `frontend/src/server/` as it exists at the start of this story, covering at least:
  `auth.ts`, `logger.ts`, `metrics.ts`, `redisClient.ts`, `db/` (and its notable
  contents: `db.ts`, `dbService.ts`, `storeTransactions.ts`, `schema.prisma`,
  `migrations/`), `helpers/` (and its contents: `get-exchange-rates.ts`,
  `update-price-history.ts`, `format-usd.ts`, `unitToNameMap.ts`), `session.ts`, and
  `authSession.ts`.
- [ ] Each row carries exactly one verdict - *created by this initiative, refile* or
  *GR-1-protected, dies with Epic 8* - plus a one-line reason.
- [ ] The table confirms `session.ts` and `authSession.ts` are the only two rows
  verdicted *refile*. If a third file appears to qualify, the story does not move it or
  recommend moving it: it records the finding and flags it as requiring an owner
  decision and a PRD amendment before any file moves (GR-1's clarification names exactly
  these two).
- [ ] The naming question is settled and recorded: whether `authSession.ts` keeps its
  name once it sits inside a folder already called `auth/` (i.e.
  `frontend/src/auth/authSession.ts` vs. some other name). State the chosen name and the
  one-line reason; story 12.2 executes whatever this story decides.
- [ ] No file under `frontend/src/server/` or elsewhere is moved, renamed, or edited by
  this story - the deliverable is the table and the naming decision, both written into
  this story's Dev Notes.

## Technical Notes

Every remaining entry under `frontend/src/server/` other than `session.ts` and
`authSession.ts` was present under `frontend/src/server/` before this initiative started,
so GR-1 protects it and Epic 8 (out of scope) is the only epic that ever removes it - this
story's default expectation for every row besides the two known refiles.

`session.ts` exports `verifySessionToken` and `toSession`, and consumes
`SESSION_ALGORITHM` internally (it imports the value, it does not re-export it);
`authSession.ts` exports `getSession`, importing `toSession` and
`verifySessionToken` from `./session` and `getServerAuthSession` from `../server/auth`
(soon `@/server/auth`). Neither export changes in this story.

**Verification:** `git status --porcelain frontend/src/server` is empty (no files moved);
`ls frontend/src/server` cross-checked against the survey table so every entry present in
the directory has a row.

## Out of Scope

Executing the move (story 12.2). Editing `architecture.md`'s five stale path citations -
that is a `bmad-architect` pass triggered by 12.2's completion, not by this story
(architecture.md D64).

## Dev Notes

### Survey of `frontend/src/server/`

Verdicts are decided by whether this initiative created the file. The initiative's first
commit is `fbcb68f` (2026-08-16, story 1.2); every entry below carries the date of the
commit that added it, so the two refiles are separable from the rest by inspection rather
than by assertion.

| Entry | Added | Verdict | Reason |
|---|---|---|---|
| `auth.ts` | 2024-01-13 | GR-1-protected, dies with Epic 8 | NextAuth config; predates the initiative, and the moved `serverSession.ts` still imports `getServerAuthSession` from it while both auth paths exist. |
| `logger.ts` | 2026-05-22 | GR-1-protected, dies with Epic 8 | Pino logger for the Next.js API routes; added by the Grafana work, before the initiative. |
| `metrics.ts` | 2026-05-22 | GR-1-protected, dies with Epic 8 | `prom-client` registry for the Next.js `/api/metrics` route; same Grafana commit. |
| `redisClient.ts` | 2024-12-22 | GR-1-protected, dies with Epic 8 | Redis connection for the Next.js exchange-rate cache. |
| `session.ts` | 2026-08-21 | **created by this initiative, refile** | Written by story 4.8 to verify the backend's ES256 session cookie. Nothing outside this initiative reads it. |
| `authSession.ts` | 2026-08-27 | **created by this initiative, refile** | Written by story 6.2 as the server half of the auth seam. Nothing outside this initiative reads it. |
| `db/db.ts` | 2024-01-13 | GR-1-protected, dies with Epic 8 | Prisma client singleton. |
| `db/dbService.ts` | 2024-11-27 | GR-1-protected, dies with Epic 8 | Prisma query layer for the Next.js API routes. |
| `db/storeTransactions.ts` | 2024-01-13 | GR-1-protected, dies with Epic 8 | Transaction-import writer. |
| `db/schema.prisma` | 2024-01-13 | GR-1-protected, dies with Epic 8 | Prisma schema; MikroORM maps the same tables without owning them. |
| `db/migrations/` | 2023-11-19 onward | GR-1-protected, dies with Epic 8 | Prisma migration history, oldest artifacts in the directory. |
| `helpers/get-exchange-rates.ts` | 2024-01-13 | GR-1-protected, dies with Epic 8 | Exchange-rate fetch used by the Next.js routes. |
| `helpers/update-price-history.ts` | 2025-10-10 | GR-1-protected, dies with Epic 8 | Price-history refresh used by the Next.js routes. |
| `helpers/format-usd.ts` | 2024-01-13 | GR-1-protected, dies with Epic 8 | USD formatting helper. |
| `helpers/unitToNameMap.ts` | 2024-01-13 | GR-1-protected, dies with Epic 8 | Unit-to-name lookup table. |

`session.ts` and `authSession.ts` are the only two rows verdicted *refile*, matching GR-1's
clarification exactly. No third file qualifies, so no owner decision or PRD amendment is
needed.

### Naming decision

`authSession.ts` is renamed to `serverSession.ts` on the move.

Inside a folder already called `auth/`, the `auth` prefix carries no information, and
`auth/authSession.ts` sitting beside `auth/session.ts` would not tell a reader which of the
two to import. `serverSession.ts` pairs against the existing `useCurrentSession.ts`: the two
files are the server and client answers to "who is logged in", with `session.ts` holding the
token primitives both rest on. Story 12.2 executes this name.

### Changed Files

~ docs/bmad/nestjs-migration/stories/12-1-survey-server-folder.md   the survey table and naming decision

No source file is moved, renamed, or edited by this story.

### Verification

- `git status --porcelain frontend/src/server` is empty - no file under the surveyed
  directory changed.
- `ls frontend/src/server` cross-checked against the table: every entry present in the
  directory has a row, and every row corresponds to a present entry.
- Each row's date comes from `git log --diff-filter=A --follow -1` on that path.
