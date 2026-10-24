# Epic 7: Cutover - throw the switch

Status: Complete

Stories: 7.1, 7.2, 7.3
Depends on: 5, 6, 11
Base commit: 246feeb40e107b6d697ff6f02e5fe904f512561e

## Scope

Flip the two switchable seams Epics 6 and 10 built - the auth seam
(`NEXT_PUBLIC_AUTH_TARGET`, story 6.2) and the generated client's origin seam
(`NEXT_PUBLIC_API_TARGET`, FR-25, story 10.2) - from the Next.js routes to the NestJS
backend, by changing each seam's shipped default. Auth flips first (7.1), because a
NestJS data endpoint cannot authorize a browser holding only a NextAuth session; the
data flip is all-at-once for every domain (7.2), not per-domain, with story 5.10's
parity sweep as the evidence it is safe. 7.3 is a cold full-stack verification of the
result.

**No frontend code is written in this epic beyond two configured default values** -
`docker-compose.yml`'s `build.args` and `frontend/Dockerfile`'s matching `ARG` defaults.
`frontend/src/middleware.ts`, `frontend/src/auth/target.ts`, and
`frontend/src/api/http-client.ts` are not edited: story 6.2 already wrote both branches
of the auth seam and story 10.2 already wrote both branches of the data seam, so this
epic only changes which branch is the default. If a story here finds itself editing a
component to make the cutover work, the seam it is flipping was incomplete, and the fix
belongs in the epic that built that seam (6 or 10), not here - reopening the completed
epic is an owner decision, the same call that gave FR-27 its own Epic 11 rather than a
story bolted onto 6 or 7.

Reverting any story in this epic is a configuration change and nothing more (NFR-5).

## Gate

Artifact: the live stack with both cutover flips in place - the shipped default after
this epic, with no env override - browsed end to end over the local HTTPS flow.

Bring it up with: `docker compose up -d --build` (no `NEXT_PUBLIC_AUTH_TARGET` or
`NEXT_PUBLIC_API_TARGET` override - the point of this gate is what ships by default).

Passes when: logging in through `/login` sets `portfolio_session` (not the NextAuth
cookie), the nav shows the logged-in username, and `/`, `/stats`, and
`/product?unit=...&name=...` all render identically to how they rendered before this
epic - same data, same layout, no console or network errors, with the network tab
showing requests landing on `/backend/api/...`. Signing out clears the session and
returns to `/login`. The Grafana **Portfolio App** dashboard's Live Application Logs
panel shows lines from both `next-app` and `nest-api`, Prometheus's targets page shows
both scrape jobs healthy, and `/backend/docs` serves Swagger UI over the real nginx/TLS
route. Reading the diff does not substitute for this: every story in this epic is a
one- or two-line configuration change, and the one thing no agent in this loop can
exercise is a logged-in render against the real cut-over stack.

## Changed Files

~ docker-compose.yml   `next-app.build.args` defaults: `NEXT_PUBLIC_AUTH_TARGET` and
                       `NEXT_PUBLIC_API_TARGET` both `legacy` -> `nest`
~ frontend/Dockerfile  `common-build` stage `ARG` defaults for the same two variables,
                       `legacy` -> `nest`

Story 7.3 is verification-only and changed no file, as its own Context states.

`frontend/next-env.d.ts` also shows as modified in the working tree. It is not part of
this epic: it is Next-regenerated drift predating story 7.1, recorded as such by every
story in this epic, and it is excluded from this epic's pathspec.

## Review Notes

## Owner Feedback
