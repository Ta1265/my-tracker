# Story 13.2: Correct `OBSERVABILITY.md`'s `METRICS_SECRET` rotation steps

Status: Done

## Context

`OBSERVABILITY.md`'s "Rotating `METRICS_SECRET`" section says the secret is shared between
exactly two places and ends with `docker compose restart next-app prometheus`. Story 5.9
added the backend's `METRICS_SECRET`-guarded scrape endpoint (`GET /backend/api/metrics`)
and a second Prometheus job, `nestjs-backend`, in `monitoring/prometheus.yml` (confirmed at
`monitoring/prometheus.yml:16-23`, alongside the pre-existing `nextjs-app` job at lines
6-14). The secret now has a third consumer, `nest-api`, and the documented rotation steps
leave it running on the old value. This is an accuracy defect this initiative introduced,
not an observability redesign, so it is in scope despite "redesigning observability" being
out of scope generally.

**Owner amendment at sign-off:** making the rotation steps more accurate would otherwise
leave them silent about the fact that they don't currently produce healthy scrape targets
at all - a separate, pre-existing bug story 5.9 found (see Out of Scope). The rotation
section now also gets a short, factual note pointing at that condition. The fix for the
underlying bug stays out of scope; only naming it is in scope.

## Acceptance Criteria

- [x] `OBSERVABILITY.md`'s "Rotating `METRICS_SECRET`" section's intro list is updated from
  two places to three: `.env` (read by both `next-app` and `nest-api` to validate bearer
  tokens on their respective metrics routes) and `monitoring/prometheus.yml` (both scrape
  jobs' `authorization.credentials` fields).
- [x] The rotation steps' step 3 ("Update `monitoring/prometheus.yml` →
  `authorization.credentials`") is reworded to say both scrape job entries need the update -
  `nextjs-app` (`metrics_path: /api/metrics`) and `nestjs-backend`
  (`metrics_path: /backend/api/metrics`) - not just the one that predates this initiative.
- [x] The rotation steps' step 4 restart command changes from
  `docker compose restart next-app prometheus` to
  `docker compose restart next-app nest-api prometheus`.
- [x] The rotation steps gain a short, factual note stating that both scrape jobs
  currently sit at `403`/`down` because Prometheus does not substitute `${METRICS_SECRET}`
  inside `scrape_configs[].authorization.credentials`, so following these steps will not
  by itself produce healthy targets. The note points at the condition only - it does not
  diagnose the templating mechanism or propose a fix - and cross-references the existing
  "Prometheus scrape and `expand-external-labels`" paragraph under "Local Development
  Notes" rather than restating or contradicting it (that paragraph explains the flag's
  general effect; this note adds the one specific fact it doesn't cover - that
  `authorization.credentials` isn't one of the fields it reaches).
- [x] No other content in `OBSERVABILITY.md` changes - the dashboard panel table, the log
  filtering section, and the "Local Development Notes" section itself (including its
  `expand-external-labels` paragraph) are left exactly as they are; only the rotation
  section is touched.

## Technical Notes

Source of truth: `monitoring/prometheus.yml`, which has two `scrape_configs` entries -
`nextjs-app` (`next-app:3000`, `/api/metrics`) and `nestjs-backend` (`nest-api:3001`,
`/backend/api/metrics`) - both with an identical `authorization: { type: Bearer,
credentials: '${METRICS_SECRET}' }` block. `.env` (via `docker-compose.yml`'s
`env_file: [./defaults.env, ./override.env]`) is read by both `next-app` and `nest-api`
containers.

This story is prose-only; no file under `frontend/`, `backend/`, or any config/compose
file is edited (epic-level constraint) - `monitoring/prometheus.yml` itself is not
touched, only the markdown describing it.

**Verification:**
```
cat monitoring/prometheus.yml            # confirms both job_name/metrics_path values
                                          # (nextjs-app /api/metrics, nestjs-backend
                                          # /backend/api/metrics) match what the doc says
curl -s http://localhost:9090/api/v1/targets | grep -o '"health":"[a-z]*"'
                                          # confirms both jobs still show down, matching
                                          # the new note's claim
git diff OBSERVABILITY.md                # only the rotation section changed; dashboard
                                          # table, log filtering, and Local Development
                                          # Notes sections are untouched
```

## Out of Scope

**A pre-existing, unrelated infrastructure bug, pointed at but not fixed here.** Story
5.9's Dev Notes ("Prometheus target health") found that Prometheus's
`--enable-feature=expand-external-labels` flag only expands `${VAR}` references in
`global.external_labels`, not inside `scrape_configs[].authorization.credentials` - so
Prometheus currently sends the literal string `${METRICS_SECRET}` to both scrape targets
regardless of the real secret's value, and both jobs show `403`/`down` in Prometheus's
targets page today. This predates this initiative and is not something rotating the
secret correctly would fix; it needs a templating mechanism change (an `envsubst`-on-boot
wrapper, a `credentials_file`, or similar) spanning both scrape configs, which is a
`docker-compose.yml`/deployment change outside a prose epic's scope. Story 5.9 recommended
a follow-up story for it; this story does not attempt one. The owner's ruling is that the
rotation section should say so - see the new acceptance criterion above - so this story
adds a one-line pointer to the condition without diagnosing it or touching "Local
Development Notes" itself.

Any change to `README.md` - story 13.1. Any change to `monitoring/prometheus.yml` itself.

## Dev Notes

Numbered-list intro reads "shared between three places" but keeps two enumerated bullets:
`.env` covers both containers in one bullet and `monitoring/prometheus.yml` covers both
scrape jobs in the other, so the "three places" phrasing (per the acceptance criterion's
wording) is realized as `.env` + prometheus.yml's two job entries, not three list items.
This matches the AC's parenthetical description of what each bullet should say.

Confirmed live target health before writing the note: `curl -s
http://localhost:9090/api/v1/targets` shows both `nextjs-app` and `nestjs-backend` jobs
with `"health":"down"` and `"lastError":"server returned HTTP status 403 Forbidden"`, so
the new note's claim matches the running stack, not just the story's assertion.

**Fix round (Epic 13 review round 1):** Reworded the note per F1 and F3. It no longer
cross-references the `expand-external-labels` paragraph (that paragraph, frozen by AC 5,
says the flag "enables `${VAR}` substitution in `prometheus.yml`" without qualification,
so a reader following the pointer was told substitution does happen). The note now
carries its own attribution inline instead. It's also reworded from a point-in-time
reading ("currently sit at 403/down") to a property of the file: "As long as
`monitoring/prometheus.yml` carries the literal `${METRICS_SECRET}` in
`authorization.credentials`, Prometheus sends that literal string and both jobs return
`403`/`down`..." This is the owner's original note with reworded phrasing, not new
content - flagging for owner confirmation at the gate since the wording changed from
their original form. Also reworded "shared between three places" to "shared between
three consumers across two files" (F5) so the count agrees with the two-bullet list
below it.

### Changed Files

~ OBSERVABILITY.md    Rotation section: three consumers, both scrape jobs in step 3, three-container restart in step 4, and a new note on the pre-existing 403/down condition

### Verification

```
$ cat monitoring/prometheus.yml
```
Confirms two scrape_configs entries: `nextjs-app` (`next-app:3000`, `/api/metrics`) and
`nestjs-backend` (`nest-api:3001`, `/backend/api/metrics`), both with `authorization: {
type: Bearer, credentials: '${METRICS_SECRET}' }` — matches what the doc now says.

```
$ curl -s http://localhost:9090/api/v1/targets | python3 -m json.tool | grep -E '"job"|"health"|"lastError"|"scrapeUrl"'
                "job": "nestjs-backend"
                "job": "nestjs-backend"
            "scrapeUrl": "http://nest-api:3001/backend/api/metrics",
            "lastError": "server returned HTTP status 403 Forbidden",
            "health": "down",
                "job": "nextjs-app"
                "job": "nextjs-app"
            "scrapeUrl": "http://next-app:3000/api/metrics",
            "lastError": "server returned HTTP status 403 Forbidden",
            "health": "down",
```
Both jobs are down with 403, confirming the new note's claim against the live stack (stack
was already up via `docker compose ps`, all services healthy/running).

```
$ git diff OBSERVABILITY.md
```
Diff touches only the "Rotating `METRICS_SECRET`" section (intro list, step 3, step 4, new
note); the dashboard panel table, log filtering section, and Local Development Notes
(including its `expand-external-labels` paragraph) are unchanged.
