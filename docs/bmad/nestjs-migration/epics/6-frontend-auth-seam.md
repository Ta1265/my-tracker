# Epic 6: Frontend auth access seam

Status: Complete

Stories: 6.2
Depends on: 4, 9, 10
Base commit: c6dd3976b074a6d3fccab5f6edc3272d05616b2b

## Scope

Consolidate every frontend read of "who is logged in" - the client-side `useSession()`
calls in the nav components, the server-side `getServerAuthSession()` calls in
`src/app/page.tsx` and `src/app/login/page.tsx`, and `src/middleware.ts`'s Edge-runtime
gating of `/stats` and `/product/*` (architecture finding F1) - plus login and logout,
behind one switchable seam keyed on a single build-time value. The seam's NextAuth branch
is the only one selected by default and is byte-for-byte what runs today; its NestJS
branch is fully written against Epic 10's generated `login`/`logout`/`authSession`
operations (GR-6) but is not the shipped default. Epic 7's story 7.1 flips the value.

Story 6.1 (the data base-URL seam) no longer exists - Epic 10 absorbed it into FR-25 - so
this epic is a single story.

## Gate

Artifact: the running app's login/logout/nav-gating flow, exercised against both branches
of the seam this story builds.

Bring it up with: `docker compose up -d --build` for the shipped default
(`NEXT_PUBLIC_AUTH_TARGET` unset, i.e. `legacy`); separately,
`NEXT_PUBLIC_AUTH_TARGET=nest docker compose up -d --build next-app` for the seam's other
branch, temporarily, for this check only.

Passes when: with the default build, `/`, `/login`, `/stats`, and the nav's logged-in
username/sign-out all behave exactly as they did before this epic - same cookie
(`next-auth.session-token`), same redirects, same middleware matcher. With the temporary
`nest`-targeted build, logging in calls `POST /backend/api/auth/login`, sets the
`portfolio_session` cookie, `/stats` and `/product/*` render for that session (middleware
verifies the Nest cookie, not the NextAuth one), the nav's username comes from
`GET /backend/api/auth/session`, and signing out clears the Nest cookie and returns to
`/login`. Reading the diff does not show this - the two build variants are what prove the
seam is genuinely switchable, not just written.

## Changed Files

+ frontend/src/auth/actions.ts              `seamSignIn`/`seamSignOut`: NextAuth or generated login()/logout()
+ frontend/src/auth/target.ts               `getAuthTarget()`, the single NEXT_PUBLIC_AUTH_TARGET read
+ frontend/src/auth/useCurrentSession.ts    client hook: NextAuth or generated authSession(), gated by target; typed on `LoginResponseDto`, legacy branch coerces NextAuth's nullable `name` (F1/F5 fix)
+ frontend/src/server/authSession.ts        server-side `getSession()`: NextAuth or Nest cookie + verify; returns `LoginResponseDto`, legacy branch coerces the nullable `name` (F1 fix)
~ docker-compose.yml                        next-app build.args gains NEXT_PUBLIC_AUTH_TARGET
~ frontend/Dockerfile                       GR-5 wiring: installs, copies, and builds packages/shared; adds the NEXT_PUBLIC_AUTH_TARGET ARG/ENV pair; trimmed/corrected the three oversized comments (F3/F4 fix)
~ frontend/src/api/http-client.ts           `mapUrl` carve-out: `/backend/api/auth/*` bypasses the NEXT_PUBLIC_API_TARGET strip; trimmed the carve-out comment to two lines (F4 fix)
~ frontend/src/app/login/LoginClient.tsx    calls `seamSignIn()` instead of NextAuth's `signIn()`
~ frontend/src/app/login/page.tsx           reads session via `getSession()` instead of `getServerAuthSession()`
~ frontend/src/app/page.tsx                 reads session via `getSession()` instead of `getServerAuthSession()`
~ frontend/src/components/top-nav/NavDropdown.tsx   reads session via `useCurrentSession()`, plus sign-out calls `seamSignOut()`; reformatted the sign-out onClick to Prettier's block form (F4 fix)
~ frontend/src/components/top-nav/TopNav.tsx        reads session via `useCurrentSession()` instead of `useSession()`
~ frontend/src/middleware.ts                adds a 'nest' branch (Nest cookie verify + redirect) beside the unchanged legacy withAuth() branch; `callbackUrl` now carries the query string too (F2 fix)
~ frontend/src/server/session.ts            adds `toSession()`, typed on the generated `LoginResponseDto` instead of a hand-declared `Session` (F1 fix)

## Review Notes

### Round 1

Depth: `frontend/src/auth/**` · `frontend/src/server/**` · `frontend/src/middleware.ts` ·
`frontend/src/api/http-client.ts` · `packages/shared/src/index.ts` deep (session
verification, login/logout, and route gating are the trust boundary this epic moves) ·
`frontend/Dockerfile` · `docker-compose.yml` standard (shipped-image build config) ·
the six call-site swaps (`page.tsx`, `login/page.tsx`, `LoginClient.tsx`, `TopNav.tsx`,
`NavDropdown.tsx`) standard.

- **F1** [blocking · scope] `packages/shared/src/index.ts:18-30` - re-adds `Session` and
  `SessionUser`, which story 9.7 deleted on purpose; hand-declaring them here is what
  FR-22 forbids.
  The new interfaces sit directly under the comment story 9.7 left to prevent exactly
  this: *"The JWT payload and the cookie/algorithm names have no HTTP response to
  generate from, so they can't move to `frontend/src/api/generated.ts` the way the old
  response-shaped exports did."* `Session`/`SessionUser` **are** a response shape - they
  are `LoginResponseDto`/`AuthUserDto` in `frontend/src/api/generated.ts:32-42`, returned
  by both `POST /auth/login` and `GET /auth/session`. FR-22: *"`Session` and `SessionUser`
  are the response body of `GET /auth/session` ... so under FR-20 they are generated, not
  hand-declared."* Architecture D44 and story 9.7 (Done, Epic 9 approved) executed that as
  a deletion. The concrete failure this restores is the one 9.7 removed: a change to the
  backend's `AuthUserDto` now silently diverges from the hand-written copy, because
  nothing regenerates or checks `packages/shared`.
  Dev Notes are right that the story's Technical Notes and AC C are stale on this point -
  but the resolution is to take the type from the generated client, not to revert an
  approved epic. Two routes, either acceptable, the nullability wrinkle being the only
  real obstacle (`AuthUserDto.name` is `string`; NextAuth's augmented session has
  `name: string | null`, and `frontend/tsconfig.json` sets `strict: true`, so the legacy
  branch will not assign to `LoginResponseDto` unmodified):
  (a) type the seam on `LoginResponseDto` and coerce once in `getSession()`'s legacy
  branch (`name: session.user.name ?? ''`) - no rendered difference, since
  `NavDropdown.tsx:101` renders `{session?.user.name}` and both `null` and `''` render
  nothing; or (b) declare the nullable-name variant in `frontend/src/auth/`, derived from
  the generated type, leaving `packages/shared` at its FR-22 boundary. Type-only imports
  of `@/api/generated` are erased at build, so this does not pull the generated client
  into the Edge middleware bundle.
  Note this does not affect the GR-5 Dockerfile wiring: `session.ts` still imports
  `SESSION_ALGORITHM` and `middleware.ts` still imports `SESSION_COOKIE_NAME` as runtime
  values, so the copy/build steps stay required either way.
  - Status: Resolved (Round 2)
  - Took route (a): `packages/shared/src/index.ts` no longer exports `Session`/`SessionUser`
    (`SessionClaims`, `SESSION_ALGORITHM`, `SESSION_COOKIE_NAME` remain, per FR-22).
    `frontend/src/server/session.ts:17` (`toSession`) and `frontend/src/server/authSession.ts:8`
    (`getSession`) now type on the generated `LoginResponseDto`, mirroring the backend's own
    `toSessionResponse()` mapper. Chose (a) over (b) because the nest branch's `Session` type
    already has to equal `LoginResponseDto` exactly (`useCurrentSession.ts` returns
    `nest.data` unmapped, per AC E), so a second nullable-name variant under
    `frontend/src/auth/` would just be a type alias of the same shape with one field widened -
    coercing the one real divergence (NextAuth's nullable `name`) at its two read sites is
    less surface than introducing a type.
    `frontend/src/server/authSession.ts:20-24` coerces the legacy branch:
    `{ ...session, user: { ...session.user, name: session.user.name ?? '' } }`.
    `frontend/src/auth/useCurrentSession.ts:19-25` does the same for the client-side legacy
    branch (this file wasn't itself called out at F1 but has the identical nullability
    problem, since it also assigns NextAuth's `Session` onto the same `LoginResponseDto`
    return type - fixing it here also resolves F5, see below).
    Confirmed the GR-5 Dockerfile wiring stays required, as predicted: `session.ts:2` still
    imports `SESSION_ALGORITHM` and `middleware.ts:4` still imports `SESSION_COOKIE_NAME` as
    runtime values (grepped both files after the edit). No Dockerfile change beyond F3/F4.

- **F2** [blocking · correctness] `frontend/src/middleware.ts:40` - the `nest` branch
  drops the query string from `callbackUrl`, so the flip loses it where the legacy branch
  keeps it.
  ```ts
  signInUrl.searchParams.set('callbackUrl', request.nextUrl.pathname);
  ```
  next-auth's own unauthorized redirect, which AC D says this mirrors, sets
  `` `${basePath}${pathname}${search}` `` (`next-auth/next/middleware.js:56`). The gated
  matcher includes `/product/:path*`, and `frontend/src/app/product/page.tsx:24-34` reads
  **only** query params (`unit`, `name`) and returns an empty `<div></div>` without them.
  So today, logged out, `/product?unit=USD&name=Bitcoin` redirects to
  `/login?callbackUrl=/product%3Funit%3DUSD%26name%3DBitcoin` and renders the product
  after login; under the `nest` branch the same link lands on a blank `/product`. That is
  an observable behavior change produced by story 7.1's flip alone, which is what this
  seam exists to prevent. Fix: `request.nextUrl.pathname + request.nextUrl.search`.
  - Status: Resolved (Round 2)
  - `frontend/src/middleware.ts:40` now sets `callbackUrl` to
    `request.nextUrl.pathname + request.nextUrl.search`, exactly the fix suggested.

- **F3** [advisory · conventions] `frontend/Dockerfile:31-33` - the pre-existing comment
  is made false by the line this diff adds three lines below it.
  It reads *"This stays scoped to frontend's own dependencies - the filtered install
  above never pulls in another workspace package's deps, so this won't grow once
  `backend/` exists"*, immediately above the new
  `COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules`
  and an install that now names `--filter @portfolio/shared` explicitly. It did grow.
  Reword or drop it.
  - Status: Resolved (Round 2)
  - Dropped it (`frontend/Dockerfile`, `common-build` stage). Folded into the F4 rewrite of
    the same block, which was already over the two-line limit once this sentence's false
    claim was removed.

- **F4** [advisory · conventions] Comments exceed this repo's two-line limit, and one new
  line is not Prettier-formatted. CLAUDE.md: *"A comment that survives the test gets two
  lines at most"*, and *"delete a comment that ... argues why a rejected alternative was
  rejected - design rationale belongs in the architecture doc"*. Occurrences:
  `frontend/src/api/http-client.ts:9-12` (4 lines), `frontend/src/auth/useCurrentSession.ts:10-12`
  (3), `frontend/Dockerfile:17-22` (6, and it restates reasoning `backend/Dockerfile:12-21`
  already carries), `frontend/Dockerfile:55-57` (3). Separately,
  `frontend/src/components/top-nav/NavDropdown.tsx:255` - `onClick={() => { void seamSignOut(); }}`
  is the one line in the diff Prettier reformats (`prettier` with this repo's config emits
  the three-line block form); nothing enforces it, since `prettier/prettier` is commented
  out in `frontend/.eslintrc.cjs`, so it needs doing by hand.
  - Status: Resolved (Round 2)
  - `frontend/src/api/http-client.ts:9-10` trimmed to 2 lines. `frontend/src/auth/useCurrentSession.ts:10-11`
    trimmed to 2 lines. `frontend/Dockerfile:17-18` (deps stage) trimmed to 2 lines and no
    longer restates `backend/Dockerfile`'s reasoning verbatim - keeps only the one fact
    specific to why `@portfolio/shared` needs naming directly (its own `typescript`
    devDependency). `frontend/Dockerfile:47-48` (tsc-build-order comment) trimmed to 2 lines.
    `frontend/src/components/top-nav/NavDropdown.tsx:255` reformatted to the three-line
    block form; verified against `pnpm exec prettier --check` run from `frontend/` against
    this repo's root `prettier.config.mjs` - the pre-existing formatting issues elsewhere in
    that file (unrelated lines, not touched by this epic) are out of scope and left alone.

- **F5** [advisory · correctness] `frontend/src/auth/useCurrentSession.ts:20` - the cast
  claims `undefined` where the value is `null` at runtime.
  ```ts
  return { data: nextAuth.data as Session | undefined };
  ```
  `useSession()` returns `data: Session | null`, so an unauthenticated legacy render
  returns `null` from a function declared to return `Session | undefined`. Both current
  consumers use `session?.`, so nothing breaks today; a future `=== undefined` check
  would. Widen the declared type to include `null` rather than casting it away.
  - Status: Resolved (Round 2)
  - Resolved as part of the F1 rework: `useCurrentSession.ts:8` now declares
    `{ data: LoginResponseDto | null | undefined }` (`null` from the legacy `useSession()`
    branch, `undefined` from the nest branch's `useAuthSession()` before it resolves), and
    the legacy branch (`useCurrentSession.ts:19-25`) builds the returned object explicitly
    instead of casting, so there is no remaining `as` cast on this path.

#### On the two items Dev flagged

Both are recorded here rather than as findings - neither is a defect in this diff.

**The `packages/shared` addition** is F1: the discrepancy Dev found is real and the story
is stale, but the fix belongs on the generated side.

**The `http-client.ts` carve-out is correct and does belong in this epic.** Verified:
`getLoginUrl()`/`getLogoutUrl()`/`getAuthSessionUrl()` emit `/backend/api/auth/{login,logout,session}`
(`frontend/src/api/generated.ts:398,482,533`), so without the carve-out the default
`NEXT_PUBLIC_API_TARGET=legacy` strip would send them to `/api/auth/login` etc., which is
NextAuth's `[...nextauth]` catch-all - a different contract with no matching action, not a
404-to-Nest fallback. This epic's own Gate exercises the `nest` auth branch while
`NEXT_PUBLIC_API_TARGET` is still `legacy`, so the carve-out is required by this epic, not
just by Epic 7. It is inert under the default: `grep -rn "from '@/api/generated'" frontend/src`
returns only `auth/actions.ts`, `auth/useCurrentSession.ts`, and `app/product/page.tsx`
(the last importing `deleteTransaction`, not an auth op).

**But the premise behind it - that story 7.1 can flip auth before 7.2 flips data - does not
hold, and the owner should know before the gate.** Twelve handlers under
`frontend/src/app/api/**` authenticate with `getServerAuthSession()` and return 401
without a NextAuth cookie (e.g. `frontend/src/app/api/stats/[unit]/route.ts:21-22`). With
`NEXT_PUBLIC_AUTH_TARGET=nest` and `NEXT_PUBLIC_API_TARGET=legacy`, the browser holds only
`portfolio_session`, so every legacy data route 401s: login, nav, and middleware gating all
work, and `/stats` renders empty. That is expected under this epic's `nest`-build gate
check, not a failure of this seam - but it means 7.1 is not a standalone flip, which is an
Epic 7 sequencing question for the owner/SM, not something to fix in this diff.

### Round 2

Depth: re-review of the Round 1 delta only. Deep on the retyped seam
(`frontend/src/server/session.ts`, `frontend/src/server/authSession.ts`,
`frontend/src/auth/useCurrentSession.ts`, `frontend/src/middleware.ts`,
`packages/shared/src/index.ts` - the retype crosses the session trust boundary and
changes what the legacy branch returns) · standard on `frontend/Dockerfile` and
`docker-compose.yml` · skim on the comment-only and formatting-only edits
(`http-client.ts`, `NavDropdown.tsx`).

All five Round 1 findings verified against the diff and marked `Resolved`. The epic's
authored change passes. Two new findings, neither of which is a defect in that change:
F6 (blocking) is working-tree drift that appeared during this review window and only
needs restoring from the index, and F7 (advisory) is a stale Changed Files line.

- **F1** - Resolved. Route (a) is correctly executed and complete.
  `git diff HEAD -- packages/shared/src/index.ts` is **empty**: the file is byte-for-byte
  the base commit's again, so `Session`/`SessionUser` are gone and story 9.7's deletion
  stands. `session.ts:18` (`toSession`), `authSession.ts:8` (`getSession`) and
  `useCurrentSession.ts:8` all type on the generated `LoginResponseDto`, imported
  `import type` in the two server files so nothing pulls the generated client into the
  Edge bundle.
  The GR-5 wiring is still load-bearing, as predicted: `session.ts:2` imports
  `SESSION_ALGORITHM` and `middleware.ts:4` / `authSession.ts:2` import
  `SESSION_COOKIE_NAME` as runtime values, and `packages/shared/dist/index.d.ts` still
  exports all three.
  The `name: ... ?? ''` coercion loses nothing. The only read of `name` anywhere in the
  app is `NavDropdown.tsx:101` `{session?.user.name}`; `null` and `''` both render
  nothing. `page.tsx` and `login/page.tsx` read only `isAuthenticated`. The twelve
  `frontend/src/app/api/**` handlers still call `getServerAuthSession()` directly and
  never see the coerced object.
  Verified independently rather than on the claim: `pnpm --filter @portfolio/frontend
  exec tsc --noEmit -p tsconfig.json` gives 15 errors across the same 9 pre-existing
  files (`AddTransaction`, `ModalContextProvider`, `NumberFormatCustom`,
  `product/LineChart`, `product/ProductTable` ×5, `SortArrow`, `TableComponent` ×2,
  `TickerDisplay` ×2, `server/db/storeTransactions`) - zero in any file this epic
  touches. `eslint` on `src/auth`, `src/server/{authSession,session}.ts`,
  `src/middleware.ts`, `src/api/http-client.ts` is silent.

- **F2** - Resolved. `frontend/src/middleware.ts:40` now reads
  `signInUrl.searchParams.set('callbackUrl', request.nextUrl.pathname + request.nextUrl.search)`,
  which is what `next-auth/next/middleware.js` builds for the legacy branch. The
  `/product?unit=…&name=…` case that motivated the finding now survives the flip.

- **F3** - Resolved. The false "this won't grow once backend/ exists" sentence is gone
  from `frontend/Dockerfile`'s `common-build` stage; what remains (lines 25-26) is the
  still-true symlink explanation.

- **F4** - Resolved, verified by running Prettier rather than on the claim.
  `http-client.ts:9-10`, `useCurrentSession.ts:10-11`, `Dockerfile:17-18` and
  `Dockerfile:47-48` are each two lines, and the Dockerfile one no longer restates
  `backend/Dockerfile:15-21`. `NavDropdown.tsx:255-257` is Prettier's block form.
  `pnpm exec prettier --config ../prettier.config.mjs --check` from `frontend/` over
  every file in the diff flags only `target.ts` and `docker-compose.yml` - both solely
  because of the working-tree drift in F6, not because of anything Dev wrote - plus
  `LoginClient.tsx` and `TopNav.tsx`, whose remaining diffs I confirmed are entirely
  pre-existing lines this epic did not touch. `docker-compose.yml` already failed
  `--check` at the base commit anyway, on leading-blank-lines / quote-style /
  final-newline points that predate this epic.

- **F5** - Resolved. `useCurrentSession.ts:8` declares
  `{ data: LoginResponseDto | null | undefined }` and the legacy branch builds its return
  value explicitly (`:19-25`); no `as` cast remains on that path, and the declared type
  now matches what `useSession()` actually returns.

- **F6** [blocking · scope] `frontend/src/auth/target.ts:4` and `docker-compose.yml:1` -
  the working tree has drifted from the staged, Dev-authored blobs in two places, so
  `git diff HEAD` currently carries two edits nobody wrote.
  ```
  frontend/src/auth/target.ts
  - return process.env.NEXT_PUBLIC_AUTH_TARGET === 'nest' ? 'nest' : 'legacy';   (staged)
  + return process.env.NEXT_PUBLIC_AUTH_TARGET=== 'nest' ? 'nest' : 'legacy';    (worktree)

  docker-compose.yml
  - # version: '3'                                                               (staged)
  +                                                                              (worktree)
  ```
  Both are in the index correctly - `git show :frontend/src/auth/target.ts` and
  `git show :docker-compose.yml` have the space and the comment - and `git diff` (worktree
  vs index) for these two paths contains *nothing but* these two deletions. So this is not
  a defect in the authored change; the blobs Dev staged are clean.
  Stating the provenance plainly: both files' mtimes are `23:21:27`, identical to the
  second, and both fall inside this review's window, not Dev's (Dev's originals are
  `22:47:39`, the Round 1 fixes `23:14:19`-`23:15:18`, the `next lint` rewrite of
  `next-env.d.ts` `23:15:34`). I did not run a writing command - only `tsc --noEmit`,
  `eslint`, `prettier --check` and `prettier` to stdout, none of which write source - so I
  cannot attribute it, and it may be an editor or another process touching the tree.
  Whatever the cause, it has to be undone before the owner reads the diff: an epic diff
  must be exactly the authored change, and an unexplained deletion inside
  `docker-compose.yml` is precisely the kind of thing that must not ride along.
  Neither edit is behavioral (a comment, and whitespace TypeScript ignores), which is why
  nothing in the verification suite caught it. Restore with
  `git checkout -- frontend/src/auth/target.ts docker-compose.yml`, then re-check
  `git diff` is empty for those two paths. This is the only reason this round did not go
  to `Owner Review`.
  - Status: Resolved (Round 3)

- **F7** [advisory · accuracy] `docs/bmad/nestjs-migration/epics/6-frontend-auth-seam.md:59`
  (and the story's mirror at `stories/6-2-consolidate-auth-access.md:312`) - both still
  list `packages/shared/src/index.ts` under Changed Files as `~` modified, but the F1 fix
  restored it to the base commit exactly: `git diff HEAD -- packages/shared/src/index.ts`
  produces no output. The owner reads this list against the diff, and a file listed as
  changed that has no hunk at all reads as a missing change rather than a reverted one.
  Drop the line, or reword it to say the file ends unchanged.
  - Status: Resolved in the epic (Round 3) · still Open in the story file (advisory)

#### Not filed as findings

**`frontend/next-env.d.ts`.** Out of the epic's scope, and benign. Next drops the
`next/navigation-types/compat/navigation` directive when `hasPagesDir` is false
(`next/dist/lib/typescript/writeAppTypeDeclarations.js:49-51`), and this repo has no
`pages/` directory at either `frontend/pages` or `frontend/src/pages`. The committed file
was stale; `next lint` (AC H's second bullet) calls `verifyTypeScriptSetup`, which
rewrites it. It will keep reappearing on every host-side `next lint`/`next build` until
someone commits it. It does not move this epic's typecheck baseline either: the only
consumer that the directive's nullability would affect is
`LoginClient.tsx:47`, which already uses `searchParams?.get(...)` and compiles both ways.

### Round 3

Depth: skim on the whole round. Nothing in the delta since Round 2 is a source change -
the two items outstanding were a working-tree restore from the index (F6) and a docs
line (F7), and the authored diff itself was already verified at Round 2's depths. What
this round owes is verification that the restore changed only what it claimed, not a
re-read of code that has not moved.

Both outstanding findings closed. **The epic passes; it goes to the owner.**

- **F6** - Resolved. `git diff HEAD -- frontend/src/auth/target.ts docker-compose.yml`
  now carries only authored content: `target.ts` is the 5-line file with
  `NEXT_PUBLIC_AUTH_TARGET === 'nest'` spaced correctly, and `docker-compose.yml`'s
  only hunk is the `build.args` expansion at `:45-55`. `docker-compose.yml:1` is
  `# version: '3'` again. `git diff` (worktree vs index) for both paths is empty, so
  the worktree matches the blobs Round 2 confirmed Dev had staged.
  **Verified the restore lost no Round 1 fix**, rather than assuming it. `git checkout`
  overwrites from the index, so the risk was an unstaged Round 1 fix in either file -
  there was none: the Round 1 fixes landed in `packages/shared/src/index.ts`,
  `server/session.ts`, `server/authSession.ts`, `auth/useCurrentSession.ts`,
  `middleware.ts`, `api/http-client.ts`, `Dockerfile` and `NavDropdown.tsx`, and neither
  restored file is among them. All eight still hold their fixes at the content Round 2
  verified: `middleware.ts:40` `callbackUrl` is `pathname + search` (F2);
  `authSession.ts:26` and `useCurrentSession.ts:25` both carry the
  `name: session.user.name ?? ''` coercion and `useCurrentSession.ts:8` declares
  `LoginResponseDto | null | undefined` (F1/F5); `http-client.ts:9-10`,
  `Dockerfile:16-17`, `Dockerfile:46-47` are two lines each and the false "won't grow"
  sentence is gone (F3/F4); `NavDropdown.tsx:255-257` is Prettier's block form (F4).
  Their mtimes are unchanged from the Round 1 fix window (23:14:19-23:15:18); only the
  two restored files moved (23:31:06), which is the restore itself.
  Re-ran Prettier on the two restored paths as a targeted check, since F6's drift was
  what made them fail at Round 2. `target.ts` now passes `--check` outright.
  `docker-compose.yml` still fails, but its failure set is now **identical to the base
  commit's** - I formatted both the base blob and the current file and diffed each
  against its source: three pre-existing points either way (double-space before the
  `# prod or dev` comment, double-quoted `${...}` values, missing final newline). The
  new `NEXT_PUBLIC_AUTH_TARGET` line inherits the same double-quote style as the
  `NEXT_PUBLIC_API_TARGET` line beside it, which is the right call for consistency
  within the file. The blank-line drift F6 flagged is gone and nothing replaced it.

- **F7** - Resolved in the epic; the story-file half remains, advisory, and does not
  block. `packages/shared/src/index.ts` is now absent from this epic's Changed Files
  (14 entries) and absent from `git status` entirely - unstaged, and byte-for-byte the
  base commit. `git diff HEAD`, `git diff --cached` and `git diff` are all empty for it.
  The list now matches the diff exactly: `git diff HEAD` touches 15 paths, the epic's
  14 plus `frontend/next-env.d.ts` (adjudicated out of scope in Round 2, not a finding).
  **On the story's own line 312**, which the orchestrator correctly left alone: it
  should be **dropped, not reworded**, and it does not need a Dev round of its own.
  `### Changed Files` is a manifest of paths this story changes, read against the diff;
  an entry for a file with no hunk reads as a missing change, which is the same defect
  F7 raised against the epic's copy. Nothing is lost by deleting it - the story's Dev
  Notes already record the round in prose ("Removed them from
  `packages/shared/src/index.ts` and retyped the seam on the generated
  `LoginResponseDto`", `stories/6-2-consolidate-auth-access.md:286-296`), and that
  paragraph, not the manifest, is where the history belongs. Rewording it to "ends
  unchanged" would leave a manifest entry that says nothing changed, which is worse than
  no entry. Since it is advisory and the file is Dev's, the right moment is Dev's next
  touch of the story, or the owner can wave it through as-is; it is not worth a round.

**No other drift since Round 2.** `git status --porcelain` lists the same 15 tracked
paths plus the two untracked directories (`.claude/skills/bmad/`, `docs/`), and every
tracked file's mtime still sits in Dev's authoring window (22:47:39) or the Round 1 fix
window (23:14:19-23:15:34), with the two restored files the only exceptions. No new
file appeared and no file outside the 14 changed.

## Owner Feedback

- **Deferred, not a change to this epic.** `frontend/src/server/session.ts` and
  `frontend/src/server/authSession.ts` are misfiled under `frontend/src/server/`. That
  folder reads as "server code that goes away once everything is in NestJS", but these two
  are the opposite: they are the frontend's side of the auth seam, and `authSession.ts`
  exists specifically to read a *Nest-issued* session. They survive the migration rather
  than dying with it. Natural home is `frontend/src/auth/`, beside `target.ts`,
  `actions.ts` and `useCurrentSession.ts`.

  Owner explicitly deferred this to a later cleanup rather than reopening Epic 6. Whoever
  drafts that cleanup should check what else is left in `frontend/src/server/` at that
  point - the same question applies to the rest of the folder, and the move is a rename
  plus import updates, with `middleware.ts`'s Edge-bundle import path the one to watch.
