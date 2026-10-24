# Story 13.1: Add the setup section to `README.md`

Status: Done

## Context

`README.md` today contains only the Orval type-generation section; the repo has never had
setup instructions for the pnpm monorepo or the `next-app` + `nest-api` topology this
initiative built. This story adds that section above the existing Orval content, which is
left unchanged.

Runs after Epic 12 so the frontend layout it documents is durable rather than one epic from
going stale: Epic 12 moved `frontend/src/server/session.ts` and
`frontend/src/server/authSession.ts` into `frontend/src/auth/` (as `session.ts` and
`serverSession.ts`), and story 12.1's survey table
(`docs/bmad/nestjs-migration/stories/12-1-survey-server-folder.md`, "Survey of
`frontend/src/server/`") is the source material for what remains under
`frontend/src/server/` and why - use it directly rather than re-deriving the split from the
filesystem.

## Acceptance Criteria

- [x] A new section is added to `README.md`, above the existing "API client type generation
  with Orval" section, covering:
  - **Prerequisites and pinned toolchain**: Node 24 (root `.nvmrc` pins `24`; both
    `frontend/package.json` and `backend/package.json` declare `engines: { node: ">=24
    <25" }`), pnpm (root `package.json`'s `packageManager: "pnpm@11.22.0"`), Docker and
    Docker Compose.
  - **The pnpm workspace layout**: `pnpm-workspace.yaml` lists `frontend`, `backend`, and
    `packages/*`, with `injectWorkspacePackages: true` and a single root `pnpm-lock.yaml`.
    `packages/shared` holds only the session claim contract - `SessionClaims`,
    `SESSION_ALGORITHM`, `SESSION_COOKIE_NAME` - and both
    `frontend` and `backend` depend on it as `@portfolio/shared` (`workspace:*`).
  - **Installs go through pnpm, not npm**: `pnpm install` at the repo root; there is no
    `package-lock.json` anywhere in the repo any more.
  - **The frontend's internal layout, post-Epic-12**: `frontend/src/auth/` holds the auth
    seam - `session.ts` and `serverSession.ts` (moved from `frontend/src/server/` in Epic
    12), plus `target.ts`, `actions.ts`, `useCurrentSession.ts` - and is a mix of
    server-only and `'use client'` files with no barrel file, deliberately. `frontend/src/
    server/` still holds the pre-initiative Next.js API layer (`auth.ts`, `logger.ts`,
    `metrics.ts`, `redisClient.ts`, `db/`, `helpers/`) that GR-1 protects for the whole
    initiative and that only Epic 8 (out of scope) removes. `frontend/src/api/` holds the
    Orval-generated client (`generated.ts`) and its mutator (`http-client.ts`), covered by
    the existing Orval section.
  - **Bringing up the stack**: `docker compose up -d --build` (the `dev` build target is
    the default via `TARGET=${TARGET:-dev}` in `docker-compose.yml`; set `TARGET=prod` for
    a production-target build). One-time local HTTPS setup on macOS is
    `sudo ./setup_local_https.sh` (mkcert-based; see the script's own header comment for
    what it does), after which the stack is reachable at `https://www.tubesock.xyz`.
  - **The nginx topology**: `nginx/nginx.conf` terminates TLS, redirects port 80 to 443,
    proxies `location /backend/` to `nest-api:3001`, and proxies everything else to
    `next-app:3000`. Swagger UI is served at `https://www.tubesock.xyz/backend/docs`
    (the backend's OpenAPI JSON, which the existing Orval section already covers, is at
    `/backend/docs-json`). `nest-api` also publishes `127.0.0.1:3002:3001` for browsing
    Swagger directly from the host without nginx; it is not needed for `spec:generate`,
    which runs inside the `next-app` container over the Compose network.
- [x] Every fact above is verified against its source file before being written, and the
  Dev Notes record which file each claim was checked against (`pnpm-workspace.yaml`,
  `package.json`, `.nvmrc`, `docker-compose.yml`, `nginx/nginx.conf`,
  `setup_local_https.sh`, `backend/src/main.ts`, story 12.1's survey table).
- [x] The existing "API client type generation with Orval" section's content is unchanged -
  confirm with `git diff README.md` that only new content was added, nothing in that
  section was reworded or reordered.

## Technical Notes

Source files to read rather than take on faith: `pnpm-workspace.yaml` (workspace package
list, `injectWorkspacePackages`), root `package.json` (`packageManager`), `.nvmrc`,
`docker-compose.yml` (`next-app`/`nest-api`/`nginx` service definitions, `TARGET` build
arg, the `nest-api` port comment), `nginx/nginx.conf` (`location /backend/` block),
`setup_local_https.sh` (its own header comment describes purpose and assumptions),
`backend/src/main.ts` (`SwaggerModule.setup('backend/docs', ...)`, confirming the UI path).

This story is prose-only; no file under `frontend/`, `backend/`, or any config/compose
file is edited (epic-level constraint).

**Verification:**
```
cat .nvmrc                                          # 24
grep packageManager package.json                    # pnpm@11.22.0
cat pnpm-workspace.yaml                              # frontend, backend, packages/*
docker compose up -d --build
curl -sk -o /dev/null -w '%{http_code}\n' https://www.tubesock.xyz/backend/docs \
  --resolve www.tubesock.xyz:443:127.0.0.1           # 200
git diff --stat README.md                           # only new lines added; existing
                                                      # Orval section untouched
```

## Out of Scope

Editing the existing Orval section - unchanged, per acceptance criteria. Any change to
`OBSERVABILITY.md` - story 13.2. Any change to `frontend/src`, `backend/src`, or a
config/compose file - none of this epic's stories touch those.

## Dev Notes

### Fact-check log

- `.nvmrc` -> `24`.
- `frontend/package.json`, `backend/package.json` -> both have `"engines": { "node": ">=24
  <25" }`.
- root `package.json` -> `"packageManager": "pnpm@11.22.0"`.
- `pnpm-workspace.yaml` -> `packages: [frontend, backend, packages/*]`,
  `injectWorkspacePackages: true`.
- `packages/shared/src/index.ts` and its `package.json`/`dist/index.d.ts` -> **diverges
  from the story as drafted**. The package exports only `SESSION_ALGORITHM`,
  `SESSION_COOKIE_NAME`, and the `SessionClaims` interface. There is no `SessionUser` or
  `Session` type anywhere in `packages/shared` (confirmed against `dist/index.d.ts` too,
  and a repo-wide grep for `SessionUser`/`Session` type declarations turned up nothing
  else exported from shared - `backend/src/auth/session.service.ts` has its own
  `SessionUserInput`, unrelated to the shared package). Wrote the true three exports
  instead of the story's five.
- repo-wide search for `package-lock.json` (excluding `node_modules`) -> none found,
  confirming pnpm-only installs.
- `frontend/src/auth/` -> `ls` shows exactly `actions.ts`, `serverSession.ts`,
  `session.ts`, `target.ts`, `useCurrentSession.ts`, matching the story and story 12.1's
  survey/naming decision.
- `frontend/src/server/` -> `ls` shows `auth.ts`, `db/`, `helpers/`, `logger.ts`,
  `metrics.ts`, `redisClient.ts` still present, matching story 12.1's survey table
  (all rows there besides the two refiles).
- `frontend/src/api/` -> `generated.ts`, `http-client.ts` present.
- `docker-compose.yml` -> `next-app` build `target: ${TARGET:-dev}`; `nest-api` build
  `target: ${TARGET:-dev}`, publishes `127.0.0.1:3002:3001` with a comment confirming it's
  for direct Swagger browsing, not codegen.
- `setup_local_https.sh` -> header comment confirms mkcert-based local HTTPS setup for
  `https://www.tubesock.xyz`, macOS-only, run via `sudo ./setup_local_https.sh`.
- `nginx/nginx.conf` -> `location /backend/` proxies to `http://nest-api:3001`; the
  fallback `location /` proxies to `http://next-app:3000`; port 80 server block returns a
  301 to `https://www.tubesock.xyz`.
- `backend/src/main.ts` -> `SwaggerModule.setup('backend/docs', app, document)`, confirming
  the `/backend/docs` UI path (gated behind `appConfigService.swaggerEnabled`, which is
  out of scope for this story to describe further).
- story 12.1's survey table (`docs/bmad/nestjs-migration/stories/12-1-survey-server-folder.md`)
  used directly for the `frontend/src/server/` file list and the "moved from
  `frontend/src/server/`" framing, rather than re-deriving it from the filesystem.

**Correction (post-review, F6):** the acceptance criterion listing `packages/shared`'s
exports named five symbols (`SessionClaims`, `SessionUser`, `Session`,
`SESSION_ALGORITHM`, `SESSION_COOKIE_NAME`), but the package only ever exported three -
Dev caught this during implementation (see the fact-check log entry above), wrote the
true three into `README.md`, and left the story's own criterion text unedited. The
criterion above has now been corrected to match. The checkbox stays ticked: the acceptance
was met against reality (`README.md` documents the three exports that actually exist);
only the story's own wording was stale.

**Fix round (Epic 13 review round 1):** F4 - the "Bringing up the stack" section quoted
`TARGET=${TARGET:-dev}`, which does not appear in `docker-compose.yml`; the actual line
(confirmed above in the fact-check log) is `target: ${TARGET:-dev}`. Corrected the quote
in `README.md` to match.

### Changed Files

~ README.md   new "Developer setup" section (prerequisites, workspace layout, frontend
  layout post-Epic-12, bringing up the stack, nginx topology) added above the existing
  Orval section, which is untouched; fix round corrected a misquoted `docker-compose.yml`
  key in the "Bringing up the stack" section

### Verification

```
$ cat .nvmrc
24

$ grep packageManager package.json
  "packageManager": "pnpm@11.22.0"

$ cat pnpm-workspace.yaml
packages:
  - frontend
  - backend
  - packages/*
...
injectWorkspacePackages: true

$ docker compose ps
# stack already up (next-app, nest-api, nginx, redis, portfolio-db, monitoring services
# all "Up"); no rebuild needed to verify

$ curl -sk -o /dev/null -w '%{http_code}\n' https://www.tubesock.xyz/backend/docs \
  --resolve www.tubesock.xyz:443:127.0.0.1
200

$ git diff --stat README.md
 README.md | 70 +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 1 file changed, 70 insertions(+)

$ git diff README.md | grep '^-'
--- a/README.md
# (only the diff header; no removed lines - confirms the Orval section is untouched)
```
