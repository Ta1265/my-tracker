# Story 2.4: Scaffold - auth module

Status: Done

## Context

First domain scaffold after 2.3 establishes the conventions. Builds the `auth` module
per 2.2's map: three **new** endpoints (login, logout, session) that do not port an
existing route handler - 2.1 records `auth/[...nextauth]` as out of contract-inventory
scope, and Epic 4 designs these from FR-6 through FR-11 rather than from NextAuth's
internals. This story stubs their shape only; the real credential check, session
issuance, and cookie handling are Epic 4 (4.4-4.7).

Follow every convention from 2.3: DTO location/suffix, `@FormattedValue` (not needed
here - no formatted display strings in the auth responses), stub-handler body
(`NotImplementedException`), auth-posture decorators, global `ValidationPipe`.

## Acceptance Criteria

- [x] `backend/src/auth/auth.module.ts`, `auth.controller.ts` created, registered in
      `AppModule`. `@Controller('auth')`, tagged `Auth` (2.3 section A).
- [x] `POST /backend/api/auth/login` - request DTO `LoginRequestDto`: `{ username:
      string, password: string, rememberMe: boolean }` (mirrors `rememberMe`'s FR-7
      role - 8h vs 30d lifetime, decided in Epic 4, not here). Response DTO
      `LoginResponseDto` matches FR-9's whitelisted shape: `{ isAuthenticated: true,
      user: { id: number, username: string, email: string, name: string } }`.
      Documented success is `200`; document a `401` `{ error: 'Unauthorized' }` for bad
      credentials (matches FR-5's session-failure shape, which 4.3's error filter will
      produce uniformly). Deliberately public (no `@ApiCookieAuth()` - logging in
      cannot itself require a session; `@ApiOperation` description says so).
- [x] `POST /backend/api/auth/logout` - no request body. `204` empty response on
      success (FR-10). `@ApiCookieAuth()` - logging out requires an existing session,
      per FR-10's "as far as both the browser and Next.js server components are
      concerned."
- [x] `GET /backend/api/auth/session` - no request body. Response DTO
      `SessionResponseDto`, identical shape to `LoginResponseDto`'s success body (reuse
      the same DTO class - this is the one place in Epic 2 where reusing a DTO across
      two endpoints is correct, since architecture states the session endpoint is "the
      canonical FR-9 shape" both places). `@ApiCookieAuth()`. Document `401` for no/expired
      session.
- [x] All three handlers throw `NotImplementedException` per 2.3 section F, each with a
      one-line comment: login - "Verify credentials against the User table via bcrypt
      (FR-6) and issue an ES256-signed session cookie (FR-7)."; logout - "Clear the
      portfolio_session cookie (FR-10)."; session - "Verify the session cookie and
      return the FR-9 whitelisted shape."

## Technical Notes

### Current state

No `auth/` directory exists in `backend/src`. `frontend/src/server/auth.ts` (untouched
per GR-1) is the reference for what these will eventually do, but this story does not
read its internals beyond what 2.2 already recorded - the credential/session logic
itself is Epic 4's job.

### FR-9 whitelist (reference, do not add fields)

`{ isAuthenticated: boolean, user: { id, username, email, name } }`. Internal token
fields (`rememberMe`, `jti`, `iat`, `exp`) never appear in any response DTO here -
they're claims inside the JWT (Epic 4), not part of the FR-9 surface.

### Verification

- `pnpm --filter @portfolio/backend build` succeeds.
- App boots; `curl -s localhost:3001/backend/docs-json | jq '.paths | keys'` lists
  `/backend/api/auth/login`, `/backend/api/auth/logout`, `/backend/api/auth/session`.
- `curl -s -X POST localhost:3001/backend/api/auth/login -H 'content-type:
  application/json' -d '{"username":"x","password":"y","rememberMe":false}'` returns
  `501`.
- `curl -s -X POST localhost:3001/backend/api/auth/logout` and `curl -s
  localhost:3001/backend/api/auth/session` both return `501`.

## Out of Scope

- Any real credential verification, session issuance, cookie handling, or JWT signing -
  Epic 4 (4.4-4.7).
- The functioning auth guard - story 4.7.
- `packages/shared`'s session claim type - deferred to Epic 4; this story's DTOs are
  backend-local and hand-written per 2.3 D20, not derived from a shared type.
- NextAuth's own `auth/[...nextauth]` route - out of scope per 2.1; untouched under GR-1.

## Dev Notes

`SessionResponseDto` is a re-export of `LoginResponseDto` under a different name
(`export { LoginResponseDto as SessionResponseDto }`), not a subclass - this is the
literal reading of "reuse the same DTO class": the generated Swagger doc has one
schema (`LoginResponseDto`) referenced by both `/login`'s 200 and `/session`'s 200,
confirmed in the `docs-json` output below.

### Changed Files

+ backend/src/auth/auth.module.ts                    registers AuthController
+ backend/src/auth/auth.controller.ts                 login/logout/session stubs, all throw NotImplementedException
+ backend/src/auth/dto/login-request.dto.ts            username/password/rememberMe request DTO
+ backend/src/auth/dto/login-response.dto.ts           FR-9 whitelisted shape (isAuthenticated + AuthUserDto)
+ backend/src/auth/dto/session-response.dto.ts         re-exports LoginResponseDto as SessionResponseDto
~ backend/src/app.module.ts                            imports AuthModule

### Verification

- `pnpm --filter @portfolio/backend typecheck` - passed, no errors.
- `pnpm --filter @portfolio/backend build` - passed (`nest build`).
- `pnpm --filter @portfolio/backend lint` - passed; only pre-existing unrelated warning
  in `main.ts` (floating promise), no new warnings/errors from auth files.
- Booted the app locally (`pnpm start`) and ran:
  - `curl -s localhost:3001/backend/docs-json | jq '.paths | keys'` - includes
    `/backend/api/auth/login`, `/backend/api/auth/logout`, `/backend/api/auth/session`.
  - `curl -s -X POST localhost:3001/backend/api/auth/login -H 'content-type:
    application/json' -d '{"username":"x","password":"y","rememberMe":false}'` -
    returned `501` (`{"message":"Not Implemented","statusCode":501}`).
  - `curl -s -X POST localhost:3001/backend/api/auth/logout` - returned `501`.
  - `curl -s localhost:3001/backend/api/auth/session` - returned `501`.
  - Inspected `docs-json` paths for `/auth/login`, `/auth/logout`, `/auth/session`:
    login has no `security` block (public) and documents `200` (`LoginResponseDto`)
    and `401`; logout and session both carry `security: [{ cookie: [] }]`
    (`@ApiCookieAuth()`); session's `200` references the same
    `#/components/schemas/LoginResponseDto` schema as login's `200`.
