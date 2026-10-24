# Story 6.2: Consolidate auth access behind one switchable seam

Status: Done

## Context

Every frontend read of "who is logged in" goes through NextAuth today, in three
different shapes: `useSession()` in the nav components, `getServerAuthSession()` in two
server components, and `src/middleware.ts`'s Edge-runtime gating of `/stats` and
`/product/*` (architecture finding F1 - `src/middleware.ts` is an unlisted session
consumer the brief and PRD both missed). This story abstracts all three, plus login and
logout, behind one build-time value so that Epic 7's story 7.1 is a pure configuration
flip with no `frontend/src` component edits, matching the pattern NFR-5 already requires
of the FR-25 data seam.

**Nothing observable changes in this story.** The seam's default branch is NextAuth,
byte-for-byte what runs today. Its NestJS branch is fully implemented against Epic 4's
auth endpoints via Epic 10's generated client (GR-6 - no hand-written fetch to a spec'd
endpoint) but is not selected until 7.1 changes the default.

Depends on Epic 4 (the Nest session endpoints exist) and Epic 10 (the generated
`login`/`logout`/`authSession` operations in `frontend/src/api/generated.ts` exist to
build the NestJS branch against, rather than a hand-written fetch GR-6 would forbid).
GR-1/FR-11 bind throughout: `frontend/src/server/auth.ts`, the NextAuth API route, and
`next-auth/react`'s own behavior when selected are not edited.

## Acceptance Criteria

### A. The config value

- [x] New env var `NEXT_PUBLIC_AUTH_TARGET`, values `'legacy'` (NextAuth - default,
  including when unset) and `'nest'` (Nest-issued `portfolio_session` cookie). Naming and
  values mirror the existing `NEXT_PUBLIC_API_TARGET` (`legacy`/`nest`) so the two seams
  read as one pattern rather than two.
- [x] `frontend/src/auth/target.ts` (new) exports
  `getAuthTarget(): 'legacy' | 'nest'`, the single place `NEXT_PUBLIC_AUTH_TARGET` is
  read and defaulted. Every other file in this story imports this function rather than
  reading `process.env.NEXT_PUBLIC_AUTH_TARGET` itself.
- [x] `frontend/Dockerfile`'s `common-build` stage gets `ARG NEXT_PUBLIC_AUTH_TARGET=legacy`
  / `ENV NEXT_PUBLIC_AUTH_TARGET=$NEXT_PUBLIC_AUTH_TARGET`, placed next to the existing
  `NEXT_PUBLIC_API_TARGET` pair (currently lines 49-50) so both `dev` and `builder`
  inherit it. `docker-compose.yml`'s `next-app` service gets
  `NEXT_PUBLIC_AUTH_TARGET: "${NEXT_PUBLIC_AUTH_TARGET:-legacy}"` added to the same
  `build.args` object that already carries `NEXT_PUBLIC_API_TARGET` (line 48). This is a
  build-time value, same as `NEXT_PUBLIC_API_TARGET` - flipping it is a rebuild, per
  NFR-5's accepted "configuration, not code" reading (architecture: "one wrinkle to be
  explicit about").
- [x] `defaults.env` is **not** touched - `NEXT_PUBLIC_API_TARGET` already established
  that `NEXT_PUBLIC_*` values here are dead in the built image (nothing copies
  `defaults.env`/`override.env` into the frontend build context), so this var follows the
  same real path: Dockerfile `ARG`/compose `build.args` only.

### B. GR-5 - `packages/shared` becomes reachable from a bundled file

This story is the first to make `frontend/src/server/session.ts` (added inert in story
4.8) actually imported by code Next bundles, and adds new files that import
`@portfolio/shared` directly. GR-5 therefore applies.

- [x] `frontend/Dockerfile`'s `deps` stage copies `packages/shared/package.json` and
  installs it explicitly, mirroring `backend/Dockerfile`'s exact reasoning (lines 12-21):
  `pnpm install --frozen-lockfile --filter @portfolio/frontend... --filter @portfolio/shared`
  - the `...` pull-in alone only installs `@portfolio/shared` as a production dependency,
  not its own `typescript` devDependency needed for its `tsc` build.
- [x] `common-build` copies `packages/shared`'s `node_modules` (the workspace symlink
  target) and its source, and runs `pnpm --filter @portfolio/shared build` before the
  frontend's own build/dev steps - same three additions `backend/Dockerfile` already has
  (lines 30, 39, 43) and the same ones story 4.8's Dev Notes describe adding temporarily
  and then reverting because nothing imported the package permanently at the time. This
  time they are permanent.
- [x] Verify the production target: `TARGET=prod docker compose up -d --build next-app`
  (or `docker compose build --build-arg TARGET=prod next-app`) builds and serves `/`,
  `/login` correctly - the `node_modules/@portfolio/shared` symlink inside the shipped
  image must resolve to real files, not dangle.

### C. Server-side session read (`page.tsx`, `login/page.tsx`)

- [x] `frontend/src/server/session.ts` gains `toSession(claims: SessionClaims): Session`
  (types from `@portfolio/shared`), a pure mapper alongside the existing
  `verifySessionToken` - the frontend-side equivalent of the backend's
  `toSessionResponse()` (story 4.5): `{ isAuthenticated: true, user: { id: claims.sub,
  username: claims.username, email: claims.email, name: claims.name } }`.
- [x] `frontend/src/server/authSession.ts` (new) exports `async function getSession():
  Promise<Session | null>`. When `getAuthTarget() === 'nest'`: read the
  `SESSION_COOKIE_NAME` cookie via `cookies()` from `next/headers`; if absent, return
  `null`; otherwise `verifySessionToken(token, process.env.SESSION_PUBLIC_KEY_JWK!)` and
  `toSession(...)` the result, returning `null` on any verification failure (caught, not
  thrown - a page checking `session?.isAuthenticated` should never crash on a stale or
  tampered cookie). Otherwise (`'legacy'`, the default): call the existing
  `getServerAuthSession()` from `./auth` (unedited) and return its result.
- [x] `frontend/src/app/page.tsx` and `frontend/src/app/login/page.tsx` import `getSession`
  from `@/server/authSession` in place of `getServerAuthSession` from `@/server/auth`.
  Both pages' bodies are otherwise unchanged - they already only branch on
  `session?.isAuthenticated`, which both branches of `getSession()` produce identically.

### D. Edge middleware (F1)

- [x] `frontend/src/middleware.ts` (not a GR-1 path - this story may edit it directly,
  unlike story 4.8 which had to revert its changes here) branches on `getAuthTarget()`
  from `@/auth/target`:
  - `'legacy'` (default): behavior is **byte-for-byte unchanged** - the existing
    `withAuth(...)`-wrapped middleware, same matcher, same `x-client-ip` forwarding.
  - `'nest'`: read the `SESSION_COOKIE_NAME` cookie from `request.cookies`. If present and
    `verifySessionToken(token, process.env.SESSION_PUBLIC_KEY_JWK!)` succeeds, continue
    (attaching the same `x-client-ip` header the legacy branch attaches - factor this into
    one shared helper both branches call, not two copies). Otherwise redirect to `/login`
    with a `callbackUrl` query param set to the request's path, mirroring what NextAuth's
    default unauthorized redirect produces today (`LoginClient.tsx` already reads
    `callbackUrl` from `searchParams`).
  - `export const config = { matcher: [...] }` is unchanged - both branches gate the same
    three matcher entries.
- [x] This is the story that exercises the cross-library interop story 4.8 already proved
  (`@nestjs/jwt`-signed, `jose`-verified, inside the real Edge sandbox) for the first time
  in a code path that stays in the codebase rather than being reverted.

### E. Client-side session read (nav components)

- [x] `frontend/src/auth/useCurrentSession.ts` (new, `'use client'`) exports
  `useCurrentSession(): { data: Session | undefined }`. Internally calls **both**
  `useSession()` (from `next-auth/react`) and `useAuthSession()` (the generated hook from
  `@/api/generated`, per GR-6 - no hand-written fetch) unconditionally, per the Rules of
  Hooks, but gates the Nest query with `{ query: { enabled: getAuthTarget() === 'nest',
  retry: false } }` - `enabled: false` stops it firing at all under the default target
  (an otherwise-unnecessary `GET /backend/api/auth/session` request would itself be an
  observable change this story must not introduce), and `retry: false` because a `401`
  here means "not logged in," not a transient failure worth TanStack Query's default
  3 retries. Returns `{ data: nextAuth.data as Session | undefined }` under `'legacy'`, or
  `{ data: nest.data }` under `'nest'` (the generated `authSession()` response,
  `LoginResponseDto`, is structurally identical to `@portfolio/shared`'s `Session` - no
  runtime mapping needed).
- [x] `frontend/src/components/top-nav/TopNav.tsx` and
  `frontend/src/components/top-nav/NavDropdown.tsx` import `useCurrentSession` from
  `@/auth/useCurrentSession` in place of `useSession` from `next-auth/react`. No other
  change to either file - both already destructure `{ data: session }` and read
  `session?.isAuthenticated`/`session?.user.username`/`.name`/`.email`, which the new hook
  returns identically under the default target.
- [x] `frontend/src/components/TopNav.tsx` (the unused duplicate under `src/components/`,
  not `src/components/top-nav/`) is left untouched - confirmed dead
  (`grep -rn "from '.*components/TopNav'" frontend/src` outside `top-nav/` returns
  nothing; `Layout.tsx` imports only `./top-nav/TopNav`).

### F. Login and logout

- [x] `frontend/src/auth/actions.ts` (new) exports:
  - `seamSignIn(params: { username: string; password: string; rememberMe: boolean;
    callbackUrl: string }): Promise<{ error?: string; url?: string }>` - under `'legacy'`,
    calls `signIn('credentials', { ...params, redirect: false })` from `next-auth/react`
    exactly as `LoginClient.tsx` does today and returns its result unchanged. Under
    `'nest'`, calls the generated `login({ username, password, rememberMe })` from
    `@/api/generated`; on success returns `{ url: params.callbackUrl }`; on the thrown
    `Error` the mutator produces on a non-2xx response, returns
    `{ error: 'Invalid username or password' }` - the same message
    `LoginClient.tsx` shows today, so the UI needs no change to display it.
  - `seamSignOut(): Promise<void>` - under `'legacy'`, calls `signOut()` from
    `next-auth/react` exactly as today. Under `'nest'`, calls the generated `logout()`
    from `@/api/generated` (the `logout` operation, not the `useLogout` mutation hook -
    this call site is a plain click handler, not a `useQuery`, so it takes the operation
    function per the same GR-7 pattern Epic 10 established for
    `AddTransaction.tsx`/`app/product/page.tsx`), then hard-navigates with
    `window.location.href = '/'` so the app re-evaluates auth state from a clean load,
    mirroring `next-auth/react`'s own default post-sign-out navigation.
- [x] `frontend/src/app/login/LoginClient.tsx` imports `seamSignIn` from `@/auth/actions`
  in place of `signIn` from `next-auth/react`. `onSubmit` is otherwise unchanged - it
  already handles `{error?, url?}` the same shape both branches return, and still does the
  hard `window.location.href` navigation on success for the reason its existing comment
  gives (the fresh session cookie must be sent with the next request for middleware to see
  it - true of both cookies).
- [x] `frontend/src/components/top-nav/NavDropdown.tsx` imports `seamSignOut` from
  `@/auth/actions` in place of `signOut` from `next-auth/react`; its one call site
  (`onClick={() => signOut()}`) becomes `onClick={() => { void seamSignOut(); }}`.

### G. The mutator's auth-path carve-out

- [x] `frontend/src/api/http-client.ts`'s `mapUrl` gains a carve-out, checked before the
  existing `NEXT_PUBLIC_API_TARGET` logic: any path starting with `/backend/api/auth/` is
  returned unchanged, regardless of `NEXT_PUBLIC_API_TARGET`. Story 10.2 deliberately
  excluded the two auth routes from the FR-25 path-equivalence table because NextAuth's
  `/api/auth/[...nextauth]` is a different contract, not a prefixed one - there is no
  Next.js route for the mutator to fall back to the way it does for the 17 data routes, so
  stripping `/backend` from an auth path (the `'legacy'` `NEXT_PUBLIC_API_TARGET` default)
  would send `login()`/`logout()`/`authSession()` to a 404 rather than to Nest. This makes
  the NestJS branch of this story's seam independent of Epic 7's story 7.2 (the *data*
  flip) - correct, since story 7.1 (the *auth* flip) runs first and must work while
  `NEXT_PUBLIC_API_TARGET` is still `legacy`.
- [x] This is a no-op under the default `NEXT_PUBLIC_AUTH_TARGET=legacy`: nothing calls
  `login`/`logout`/`authSession` unless this story's seam selects the `'nest'` branch, and
  the config it's gated behind defaults elsewhere. Confirm by grep:
  `grep -rn "from '@/api/generated'" frontend/src` shows only `useCurrentSession.ts` and
  `actions.ts` importing `login`/`logout`/`authSession`/`useAuthSession`.

### H. Verification

- [x] `pnpm --filter @portfolio/frontend exec tsc --noEmit -p tsconfig.json` - error count
  and file set unchanged from the pre-story baseline (record both counts; this workspace
  has no enforced typecheck gate, per NFR-2, so this is evidence, not a gate).
- [x] `pnpm --filter @portfolio/frontend lint` - no new warnings in any file this story
  touches.
- [x] `docker compose up -d --build` (default `NEXT_PUBLIC_AUTH_TARGET`, i.e. unset):
  `/`, `/login` load; log in through the UI; `/stats` renders; the nav shows the logged-in
  username; sign out returns to `/login`. All behavior and all cookies
  (`next-auth.session-token`) identical to before this story - `git diff` of this
  behavior is empty by construction (it is the `'legacy'` branch, which changed no
  NextAuth code path).
- [x] `NEXT_PUBLIC_AUTH_TARGET=nest docker compose up -d --build next-app` (with a real
  dev ES256 keypair already in `override.env` per stories 4.5/4.8): log in through the same
  UI. Confirm `POST /backend/api/auth/login` is called (not `/api/auth/callback/credentials`),
  a `portfolio_session` cookie is set, `/stats` and `/product/*` render (middleware verifies
  the Nest cookie), the nav's username comes from `GET /backend/api/auth/session`
  (visible in the network tab), and signing out clears `portfolio_session` and returns to
  `/login`. Rebuild with the default target afterward so the image left running matches the
  shipped default.

## Technical Notes

### Current state, by file

- `frontend/src/middleware.ts` - `withAuth(...)`, matcher `['/stats', '/product/:path*',
  '/stats/:path*']`, forwards `x-client-ip`.
- `frontend/src/server/auth.ts` (GR-1, unedited) - `getServerAuthSession = () =>
  getServerSession(authOptions)`; session shape `{ isAuthenticated, user: { id, username,
  email, name } }`.
- `frontend/src/server/session.ts` (added inert by story 4.8) - `verifySessionToken(token,
  publicKeyJwk)`, `jose`-based, Edge- and Node-safe.
- `frontend/src/app/page.tsx`, `frontend/src/app/login/page.tsx` - both call
  `getServerAuthSession()` and branch on `session?.isAuthenticated`.
- `frontend/src/app/login/LoginClient.tsx:66-88` - `onSubmit` calls `signIn('credentials',
  {...})`, checks `result?.error`, hard-navigates to `result?.url ?? callbackUrl`.
- `frontend/src/components/top-nav/TopNav.tsx`, `NavDropdown.tsx` - both call `useSession()`
  from `next-auth/react`; `NavDropdown.tsx` also calls `signOut()`.
- `frontend/src/api/generated.ts` - `login()`/`useLogin()` (`POST /backend/api/auth/login`,
  body `LoginRequestDto { username, password, rememberMe }`, returns `LoginResponseDto`),
  `logout()`/`useLogout()` (`POST /backend/api/auth/logout`, `void`), `authSession()`/
  `useAuthSession()` (`GET /backend/api/auth/session`, returns `LoginResponseDto`).
- `frontend/src/api/http-client.ts` - `mapUrl` strips `/backend` unless
  `NEXT_PUBLIC_API_TARGET === 'nest'`.
- `packages/shared/src/index.ts` - `SESSION_ALGORITHM`, `SESSION_COOKIE_NAME`,
  `SessionClaims`, `SessionUser`, `Session`.

### Architecture references

- D2/D3/D9/D10 (session design table) - stateless ES256 JWT, local verification, no
  network hop from middleware or server components.
- F1 - middleware is Edge-only, `jose`-verified; this story is what F1's "must be inside
  the Epic 6.2 auth seam" resolves to.
- "Coexistence and flip-back" - both cookies may coexist; different names, different keys;
  flipping the seam forces a re-login (no cross-system credential translation).
- GR-6 - the NestJS branch's login/logout/session reads go through the generated client,
  never a hand-written fetch.
- GR-7's pattern (a non-`useQuery` call site takes the operation function, not the hook) -
  applied here to `seamSignIn`/`seamSignOut`, which use `login()`/`logout()`, not
  `useLogin()`/`useLogout()`.

## Out of Scope

- Flipping the shipped default to `'nest'` - Epic 7's story 7.1. This story only proves
  the `'nest'` branch works when explicitly selected for testing.
- Any change to `frontend/src/server/auth.ts`, the NextAuth API route, or
  `next-auth/react`'s configuration - GR-1, FR-11.
- The FR-25 data seam (`NEXT_PUBLIC_API_TARGET`, `frontend/src/api/http-client.ts`'s
  non-auth `mapUrl` logic) - already built, Epic 10.
- Collapsing this seam once cutover is permanent - story 8.6, out of scope for this
  initiative.
- `frontend/src/components/TopNav.tsx` (the dead, unused duplicate) - confirmed to have no
  live importer; not touched.

## Dev Notes

`packages/shared/src/index.ts` did not yet export `Session`/`SessionUser` despite the
Technical Notes and architecture.md describing them as already present (D44 assumes their
deletion in story 9.7, but grep confirmed zero exports and zero consumers before this
story). Added them here, matching the shape `toSessionResponse()` (backend, story 4.5)
and NextAuth's `session()` callback already produce, since AC C's `toSession()` signature
requires them and there is no other source for the type.

Verified the `'nest'` branch's full login/session/logout lifecycle (AC H's third bullet)
by calling the same generated-client operations and cookie flow the UI code triggers -
`POST /backend/api/auth/login`, `GET .../session`, `POST .../logout`, plus hitting
`/stats` and `/product/*` with and without the resulting `portfolio_session` cookie to
confirm the middleware's Nest branch gates correctly - rather than through an actual
browser, since no browser/UI automation tool was available in this environment. A
throwaway user (`story62test`, deleted afterward) was inserted directly into the dev
MySQL `User` table with a bcrypt hash to have known credentials to log in with; no
existing user's password was known. The owner should still do one manual browser pass
(nav username display, form UX, network tab) to confirm the visual behavior this method
can't observe.

**Round 1 review fix.** `bmad-reviewer`'s F1 was right: `packages/shared`'s `Session`/
`SessionUser` (added by this story, see the note above) are FR-22's generated response
shape, not a hand-declared one - story 9.7 deleted them on purpose. Removed them from
`packages/shared/src/index.ts` and retyped the seam on the generated `LoginResponseDto`
(`frontend/src/server/session.ts`'s `toSession()`, `frontend/src/server/authSession.ts`'s
`getSession()`, `frontend/src/auth/useCurrentSession.ts`), coercing NextAuth's nullable
`user.name` to `''` at the two points the legacy branch produces one - no rendered
difference, since `NavDropdown.tsx` renders both `null` and `''` as nothing. Also fixed F2
(`middleware.ts`'s `nest` branch now preserves the query string in `callbackUrl`, matching
the legacy branch) and the F3/F4 advisory comment/formatting issues. Full detail and
file:line citations are in the epic's Review Notes, Round 1.

### Changed Files

+ frontend/src/auth/target.ts              `getAuthTarget()`, the single NEXT_PUBLIC_AUTH_TARGET read
+ frontend/src/auth/useCurrentSession.ts    client hook: NextAuth or generated authSession(), gated by target; typed on `LoginResponseDto`, legacy branch coerces NextAuth's nullable `name` (review fix, see Dev Notes)
+ frontend/src/auth/actions.ts              `seamSignIn`/`seamSignOut`: NextAuth or generated login()/logout()
+ frontend/src/server/authSession.ts        server-side `getSession()`: NextAuth or Nest cookie + verify; returns `LoginResponseDto`, legacy branch coerces the nullable `name` (review fix)
~ frontend/src/server/session.ts            adds `toSession()`, typed on the generated `LoginResponseDto` instead of a hand-declared `Session` (review fix)
~ frontend/src/middleware.ts                adds a 'nest' branch (Nest cookie verify + redirect) beside the unchanged legacy withAuth() branch; `callbackUrl` now carries the query string too (review fix)
~ frontend/src/app/page.tsx                 reads session via `getSession()` instead of `getServerAuthSession()`
~ frontend/src/app/login/page.tsx           same
~ frontend/src/app/login/LoginClient.tsx    calls `seamSignIn()` instead of NextAuth's `signIn()`
~ frontend/src/components/top-nav/TopNav.tsx        reads session via `useCurrentSession()` instead of `useSession()`
~ frontend/src/components/top-nav/NavDropdown.tsx   same, plus sign-out calls `seamSignOut()`; reformatted the sign-out onClick to Prettier's block form (review fix)
~ frontend/src/api/http-client.ts           `mapUrl` carve-out: `/backend/api/auth/*` bypasses the NEXT_PUBLIC_API_TARGET strip; trimmed the carve-out comment to two lines (review fix)
~ packages/shared/src/index.ts              keeps `SessionClaims`/`SESSION_ALGORITHM`/`SESSION_COOKIE_NAME` only - `Session`/`SessionUser` removed per FR-22, that response shape is generated (review fix, see Dev Notes)
~ frontend/Dockerfile                       GR-5 wiring: installs, copies, and builds packages/shared; adds the NEXT_PUBLIC_AUTH_TARGET ARG/ENV pair; trimmed/corrected the three oversized comments (review fix)
~ docker-compose.yml                        next-app build.args gains NEXT_PUBLIC_AUTH_TARGET

### Verification

- `pnpm --filter @portfolio/shared build` (dist must be current before the frontend
  typecheck resolves `@portfolio/shared`'s new exports) - passed.
- `pnpm --filter @portfolio/frontend exec tsc --noEmit -p tsconfig.json` - 15 errors, in
  9 files, none of which this story touches (`AddTransaction.tsx`,
  `ModalContextProvider.tsx`, `NumberFormatCustom.tsx`, `product/LineChart.tsx`,
  `product/ProductTable.tsx`, `SortArrow.tsx`, `TableComponent.tsx`,
  `TickerDisplay.tsx`, `server/db/storeTransactions.ts`). Confirmed identical count and
  file set against the pre-story baseline via `git stash -u` + re-run.
- `pnpm --filter @portfolio/frontend lint` - same warning set as baseline (all in
  pre-existing files); zero warnings in any file this story added or touched.
- `docker compose up -d --build next-app` (default target, `NEXT_PUBLIC_AUTH_TARGET`
  unset) - built and started clean; `/` returns 307 to `/login`, `/login` returns 200,
  middleware/pages compiled with no errors. Exercised the full legacy flow via NextAuth's
  own endpoints (`/api/auth/callback/credentials`, `/api/auth/signout`) with a throwaway
  DB user: login set `__Secure-next-auth.session-token`, `/stats` returned 200 with that
  cookie, sign-out cleared it and `/stats` reverted to a 307 redirect - unchanged from
  pre-story behavior.
- `TARGET=prod docker compose build next-app` - built clean. Ran the built image
  standalone: `/` and `/login` served correctly, and the same NextAuth login flow against
  it succeeded (session cookie set, `/stats` returned 200). Next's output-file tracing
  did not carry a `node_modules/@portfolio/shared` symlink into the standalone output at
  all (only `packages/shared/package.json` landed there) - `@portfolio/shared`'s few
  exports are inlined into the webpack bundle for both the Node server output and the
  Edge middleware bundle, so there is nothing left to dangle. Confirmed no runtime error
  either way by actually running the image.
- `NEXT_PUBLIC_AUTH_TARGET=nest docker compose up -d --build next-app` - built and
  started clean. `POST /backend/api/auth/login` (hit directly against `nest-api`, since
  this dev environment's nginx vhost is bound to a production hostname and isn't reachable
  by IP) returned `LoginResponseDto` and set `portfolio_session`; with that cookie,
  `next-app`'s middleware allowed `/stats` (200) and `/product/*` (also let through, page
  itself 404s for a nonexistent slug) and without it redirected both to
  `/login?callbackUrl=...` (307); `GET /backend/api/auth/session` returned the same
  whitelisted shape; `page.tsx`/`login/page.tsx` correctly redirected an authenticated
  request away from `/` and `/login` to `/stats`, proving `getSession()`'s Nest branch;
  `POST /backend/api/auth/logout` cleared the cookie and `/stats` reverted to a 307.
  Rebuilt `next-app` with the default target afterward; confirmed `/` and `/login` still
  serve correctly on the default image left running.

**Round 1 review fix re-verification:**
- `pnpm --filter @portfolio/shared build` - passed (dist rebuilt after removing
  `Session`/`SessionUser` from `packages/shared/src/index.ts`).
- `pnpm --filter @portfolio/frontend exec tsc --noEmit -p tsconfig.json` - 15 errors, same
  9 pre-existing files as the original baseline; zero errors in any file this round
  touched (`packages/shared/src/index.ts`, `frontend/src/server/session.ts`,
  `frontend/src/server/authSession.ts`, `frontend/src/auth/useCurrentSession.ts`,
  `frontend/src/middleware.ts`, `frontend/src/api/http-client.ts`,
  `frontend/src/components/top-nav/NavDropdown.tsx`, `frontend/Dockerfile`).
- `pnpm --filter @portfolio/frontend lint` - same pre-existing warning set; zero warnings
  in any file this round touched.
- `pnpm exec prettier --config prettier.config.mjs --check` (run from `frontend/`) against
  every file this round touched - all clean except `NavDropdown.tsx`, whose remaining
  diffs are pre-existing lines unrelated to the F4 fix (verified by diffing Prettier's
  formatted output against the file: the `onClick` block at line 255 now matches exactly).
