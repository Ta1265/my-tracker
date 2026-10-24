# Epic 13: Developer-setup docs for the monorepo and the two-service topology

Status: Complete

Stories: 13.1, 13.2
Depends on: 7, 12
Base commit: 7ab1a99

## Scope

Write the setup documentation this repo has never had - the pnpm workspace, the Node 24 /
pnpm 11 toolchain, bringing the stack up, and the `next-app` + `nest-api` topology behind
nginx - and correct `OBSERVABILITY.md`'s `METRICS_SECRET` rotation steps, which story 5.9
made wrong by adding a third consumer of that secret. Prose only: no file under
`frontend/src`, `backend/src`, or any config or compose file is edited.

## Gate

Artifact: `README.md`'s new setup section and `OBSERVABILITY.md`'s corrected rotation
steps, checked against the actual running stack rather than read as prose.

Bring it up with: `docker compose up -d --build` (dev target is the default; no env
override needed), then browse `https://www.tubesock.xyz/backend/docs`.

Passes when: every command and path the new README section names can actually be run or
found exactly as written - `pnpm install` at the root, `docker compose up -d --build`,
`sudo ./setup_local_https.sh`, the `pnpm-workspace.yaml` package list, the
`frontend/src/auth/` vs `frontend/src/server/` split, and Swagger UI reachable at
`/backend/docs` through nginx - and `OBSERVABILITY.md`'s rotation section now names
`nest-api` in the restart command and both Prometheus scrape jobs
(`nextjs-app`, `nestjs-backend`) in the `monitoring/prometheus.yml` step. Reading the diff
does not exercise any of this - the owner (or reviewer) should actually bring the stack up
and follow the documented steps once.

## Changed Files

~ OBSERVABILITY.md    Rotation section: three consumers across two files, both scrape jobs in step 3, three-container restart in step 4, and a note (reworded in fix round) stating the pre-existing 403/down condition as a property of the current `monitoring/prometheus.yml`, with its own inline attribution rather than a cross-reference
~ README.md           new "Developer setup" section (prerequisites, workspace layout, frontend layout post-Epic-12, bringing up the stack, nginx topology) added above the existing Orval section, which is untouched; fix round corrected a misquoted `docker-compose.yml` key

## Review Notes

### Round 1

Depth: whole diff skim-plus - documentation only, so the review is a fact-check of every
claim against its source file and the live stack (`pnpm-workspace.yaml`, root/frontend/
backend `package.json`, `.nvmrc`, `packages/shared/src/index.ts` + `dist/index.d.ts`,
`docker-compose.yml`, `nginx/nginx.conf`, `setup_local_https.sh`, `backend/src/main.ts`,
`monitoring/prometheus.yml`, `curl` against nginx and `:9090/api/v1/targets`) rather than a
read for style. No logic changed, so no correctness/security/performance categories apply.

Verified true and needing no change: Node 24 pin and both `engines` blocks; `pnpm@11.22.0`;
the three-group workspace list and `injectWorkspacePackages: true`; the single root
`pnpm-lock.yaml` and absence of any `package-lock.json`; both apps' `workspace:*` dependency
on `@portfolio/shared`; the `frontend/src/auth/` file list, its absent barrel and its
genuine `'use client'`/server-only mix; the `frontend/src/server/` and `frontend/src/api/`
file lists; `sudo ./setup_local_https.sh` (mode `100755` in git, so it runs as written);
the nginx topology (port 80 returns 301, `/backend/` -> `nest-api:3001`, `/` ->
`next-app:3000`) and `127.0.0.1:3002:3001`. Live: `/backend/docs` 200, `/backend/docs-json`
200, `http://127.0.0.1:3002/backend/docs` 200, port 80 301. Both Prometheus jobs confirmed
`down` with `server returned HTTP status 403 Forbidden`, so the new note's factual claim
holds against the running stack.

- **F1** [blocking · correctness] `OBSERVABILITY.md:81-83` - the new note's cross-reference
  points the reader at a paragraph that states the opposite of the note, and promises
  content that paragraph does not contain.
  The note reads: "Prometheus does not substitute `${METRICS_SECRET}` inside
  `scrape_configs[].authorization.credentials` - see the `expand-external-labels` paragraph
  under \"Local Development Notes\" below for what that flag does and does not reach."
  That paragraph (`OBSERVABILITY.md:108-110`) is two sentences and says, without
  qualification: "The Prometheus container is started with
  `--enable-feature=expand-external-labels`, which enables `${VAR}` substitution in
  `prometheus.yml`." `authorization.credentials` **is** in `prometheus.yml`, so a reader who
  follows the pointer is told the substitution does happen, and finds nothing at all about
  what the flag "does not reach". The note delegates its load-bearing fact to a target that
  cannot carry it.
  Story 13.2 AC 5 freezes that paragraph, so the fix belongs on the note side: have the note
  carry the attribution itself rather than sending the reader away for it - e.g. "...because
  the `--enable-feature=expand-external-labels` flag described under \"Local Development
  Notes\" below does not reach that field." That adds no new diagnosis beyond what the note
  already asserts, so it stays inside AC 4's "points at the condition only" constraint.
  - Status: Fixed
  - The note now reads: "...because the `--enable-feature=expand-external-labels` flag
    described under \"Local Development Notes\" below does not reach that field." No edit
    to the `expand-external-labels` paragraph itself. See `OBSERVABILITY.md`'s
    "Rotating `METRICS_SECRET`" section.

- **F2** [advisory · correctness] `OBSERVABILITY.md:110` - story 13.2 AC 5's freeze on the
  "Prometheus scrape and `expand-external-labels`" paragraph leaves a sentence in the
  document that this epic now knows to be false ("which enables `${VAR}` substitution in
  `prometheus.yml`" - it enables it in `global.external_labels` only). Fixing F1 makes the
  document usable, but the false general claim survives. Narrowing it is a two-word edit;
  it needs the owner to widen AC 5, so it is recorded here rather than handed to Dev.
  - Status: Open

- **F3** [advisory · design] `OBSERVABILITY.md:79-83` - the note is written as a
  point-in-time observation ("currently sit at `403`/`down`") in a document that outlives
  the condition. Nothing expires it: whoever later adds an `envsubst` wrapper or a
  `credentials_file` has no reason to be reading the rotation section, and the note silently
  becomes false - the exact failure mode this epic exists to correct in the section directly
  above it.
  Concrete alternative: state it as a property of the file the reader is already being sent
  to edit, not as a runtime reading - "As long as `monitoring/prometheus.yml` carries the
  literal `${METRICS_SECRET}` in `authorization.credentials`, Prometheus sends that literal
  string and both jobs return `403`; rotating the secret does not by itself produce healthy
  targets." Same fact, no new diagnosis, but it is false only when the reader is looking
  straight at the line that falsified it. The owner asked for the note, so this is about its
  durability, not its presence.
  - Status: Fixed
  - Reworded per the reviewer's suggested text: "As long as `monitoring/prometheus.yml`
    carries the literal `${METRICS_SECRET}` in `authorization.credentials`, Prometheus
    sends that literal string and both jobs return `403`/`down`...; rotating the secret
    does not by itself produce healthy targets." Same fact as the owner's original note,
    reworded to be a property of the file rather than a point-in-time reading - flagged in
    story 13.2's Dev Notes for owner confirmation since the wording changed from the
    owner's original form.

- **F4** [advisory · correctness] `README.md:48-49` - "(`TARGET=${TARGET:-dev}` in
  `docker-compose.yml`)" quotes a string that does not appear in that file. The actual lines
  are `target: ${TARGET:-dev}` (`docker-compose.yml:45` and `:86`). The meaning is right and
  `TARGET=prod` in the environment does work, but the epic's gate is that every quoted thing
  can be found exactly as written, and grepping this one finds nothing. Quote it as
  `target: ${TARGET:-dev}`.
  - Status: Fixed
  - `README.md` now quotes `target: ${TARGET:-dev}`, matching `docker-compose.yml:45`.

- **F5** [advisory · clarity] `OBSERVABILITY.md:53-58` - "shared between three places"
  introduces a two-item list. Dev Notes acknowledges the mismatch and it follows the AC's
  wording, but a reader counts the bullets. "Shared between three consumers across two
  files" (or three bullets) says the same thing without the arithmetic.
  - Status: Fixed
  - `OBSERVABILITY.md` now reads "shared between three consumers across two files".

- **F6** [advisory · process] `docs/bmad/nestjs-migration/stories/13-1-readme-setup-section.md`
  - the story's acceptance criteria are stale, not the README. Independently confirmed:
  `packages/shared/src/index.ts` and `packages/shared/dist/index.d.ts` export exactly
  `SESSION_ALGORITHM`, `SESSION_COOKIE_NAME` and `interface SessionClaims`, and no
  `SessionUser` or `Session` declaration exists anywhere under `packages/shared`. Dev was
  right to write the three real exports and to record the divergence. The AC text still
  names five exports while its checkbox is ticked, so the story reads as satisfied by
  something untrue. Acceptance criteria are `bmad-sm`'s to correct, not Dev's and not mine -
  raised for the owner to route.
  - Status: Open

### Round 2

Depth: whole diff skim-plus again - prose only, so this round is an adjudication of round
1's findings plus a re-fact-check of every claim the fix round rewrote (`monitoring/
prometheus.yml`, `docker-compose.yml`, `backend/src/openapi/document.ts`,
`backend/src/metrics/metrics.controller.ts`, `frontend/src/app/api/metrics/route.ts`, and
a live `:9090/api/v1/targets` read). No logic changed.

Re-verified after the rewrite, since both the rotation intro and the note were rewritten:
step 3's job names and paths match `monitoring/prometheus.yml` exactly (`nextjs-app` ->
`/api/metrics`, `nestjs-backend` -> `/backend/api/metrics`); step 4's three service names
(`next-app`, `nest-api`, `prometheus`) all exist in `docker-compose.yml`; the intro's new
"both the Next.js and Nest API containers ... their respective `/api/metrics` and
`/backend/api/metrics` routes" holds - both services take the same `env_file` pair, the
backend's global prefix is `backend/api` (`backend/src/openapi/document.ts:3`) over
`@Controller('metrics')`, and both handlers compare `Authorization` against
`METRICS_SECRET`. `monitoring/prometheus.yml` still carries the literal
`${METRICS_SECRET}` in both `authorization.credentials` blocks, and both jobs still read
`down` / `403 Forbidden` live, so the reworded note is true under both its conditional and
its factual clause. The `expand-external-labels` paragraph and the whole "Local
Development Notes" section are byte-identical to the baseline - the `OBSERVABILITY.md`
diff has exactly two hunks, both inside the rotation section. `README.md` remains a
pure-addition hunk with no removed lines, so the Orval section is still untouched.

- **F1** - Status: Resolved
  The note now carries its own attribution ("...because the
  `--enable-feature=expand-external-labels` flag described under \"Local Development
  Notes\" below does not reach that field") instead of sending the reader to a paragraph
  that says the opposite. The pointer that remains is only a pointer to where the flag is
  described, which is true of that section, and the load-bearing fact no longer depends on
  it. The frozen paragraph is unedited, confirmed against the diff rather than the claim.
  The residual unqualified sentence in that paragraph is F2, not a reopening of this.

- **F2** - Status: Open (advisory, carried to the owner)
  Untouched by design - narrowing that sentence needs the owner to widen story 13.2's
  AC 5 first. Not Dev's to fix.

- **F3** - Status: Resolved
  The rewrite does what the finding argued for: the claim is now conditional on the state
  of `monitoring/prometheus.yml` ("As long as `monitoring/prometheus.yml` carries the
  literal `${METRICS_SECRET}` in `authorization.credentials`..."), which is the file the
  reader is already being sent to edit in step 3, so the note falsifies itself in front of
  whoever changes that field rather than rotting silently. The owner's intent survives
  intact: it still names the condition and its consequence, still closes on "Rotating the
  secret does not by itself produce healthy targets", and still proposes no fix - no
  `envsubst`, no `credentials_file`, no follow-up. The wording differs from the owner's
  original and is flagged for them at the gate, as it should be.

- **F4** - Status: Resolved
  `README.md` now quotes `target: ${TARGET:-dev}`, which is found verbatim at
  `docker-compose.yml:45` (and `:86`). No other README text moved.

- **F5** - Status: Resolved
  Reads "shared between three consumers across two files", which agrees with the
  two-bullet list under it.

- **F6** - Status: Open (advisory, carried to the owner)
  Story 13.1's acceptance criteria are `bmad-sm`'s file, not Dev's. Unchanged by design.

No new findings. The fix round introduced no regression: every claim verified true in
round 1 is still true, including the ones on lines the rewrite touched.

## Owner Feedback

Owner approved on 2026-08-27 with no change requests.

Recorded honestly for whoever picks this up, since three things were put to the owner and
the approval did not address them individually:

- **F2 stays open and ships.** `OBSERVABILITY.md`'s "Local Development Notes" still says
  `--enable-feature=expand-external-labels` "enables `${VAR}` substitution in
  `prometheus.yml`", which this epic established is false for
  `scrape_configs[].authorization.credentials`. Story 13.2's AC 5 froze that paragraph and
  the owner did not widen it, so the document ships carrying a claim it also contradicts
  four lines earlier. Narrowing the sentence to `global.external_labels` remains a two-word
  edit whenever it is wanted.
- **The F3 rewording is owner-accepted, not separately confirmed.** The `403`/`down` note
  was added on the owner's behalf under the driver's reading of an earlier sign-off, then
  reworded on the reviewer's argument from a point-in-time reading to a property of
  `monitoring/prometheus.yml`. Both the note's existence and its wording were flagged at
  the gate and approved as part of the whole.
- **The clean-machine half of the `## Gate` was not verified.** The driver confirmed the
  stack runs and every documented path exists (`/backend/docs` and `/backend/docs-json`
  both 200, `/` 307, all nine containers up), but `pnpm install` and
  `sudo ./setup_local_https.sh` were never run on an unconfigured host, which is the only
  thing that proves a setup document. That criterion is owner-accepted, not verified.

Follow-up outside this epic, left undone: `monitoring/prometheus.yml:11` still carries an
inline comment with the pre-Epic-13 rotation instruction ("rotate both together and restart
next-app + prometheus"), so the repo now contradicts itself on rotation across two files.
