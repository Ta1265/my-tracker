# Story 14.2: Owner-reported bug fixes

Status: Done

## Context

An open-ended container for defects the owner reports from using the live, cut-over app -
distinct from story 14.1's automated re-check, which only catches divergence from 5.10's
recorded pre-cutover responses. A bug the owner hits by using the app (a page that errors, a
value that looks wrong, a flow that breaks) may have no corresponding row in 5.10's transcript
at all - a new interaction, an edge case 5.10's fixture never exercised, or something in
`frontend/src` rather than in a backend response body.

This story starts empty. There is nothing to fix until the owner reports something; recording
that as the epic's real starting state (rather than inventing placeholder defects) is the
point of this epic existing at all, per its own Scope: a sweep that finds nothing is a valid
outcome.

## Acceptance Criteria

- [ ] For each bug the owner reports, add a dated sub-heading under this story's Dev Notes
      containing: the report as given, the investigation and confirmed root cause (with the
      exact file and line the defect lives in), the fix, and the verification that
      re-exercises the originally reported symptom and confirms it is gone.
- [ ] No bug is marked fixed without a recorded root cause - "seems to work now" without
      identifying why it was broken does not satisfy this story.
- [ ] If a single reported bug's fix is large enough to need its own review round separate
      from the rest of this epic's diff (a new endpoint, a schema-level change, anything
      touching more than one domain), split it into its own story - `14.2a`, `14.2b`, ... -
      following the `1.2a` numbering convention, and record the split and why in this
      story's Dev Notes rather than folding it in regardless of size.
- [ ] If a reported symptom traces back to one of the three items this epic's Scope names as
      deliberately excluded (Epic 13's F2, the Prometheus 403/down bug, the stale
      `prometheus.yml:11` comment), say so and do not fix it here - point back at this
      epic's Scope section for why, and raise it as a separate item for the owner to decide
      on rather than silently absorbing it into this story.
- [ ] Every fix keeps GR-1 intact: nothing under `frontend/src/app/api/` or
      `frontend/src/server/` (the files that existed at initiative start; the GR-1
      clarification under the PRD's Ground rules names the two Epic 12 exceptions) is
      deleted, moved, gutted, or rewritten as a side effect of a fix that belongs elsewhere.
- [ ] Every fix's response-shape changes are checked against FR-3/FR-27 the same way 14.1's
      are: if a DTO's shape changes, regenerate and commit `frontend/src/api/generated.ts`
      (FR-26) in the same sub-item, and say so.

## Technical Notes

No architecture citation applies up front - this story's content is whatever the owner
reports, and each sub-item cites the specific `architecture.md` decision or PRD requirement
its own fix touches, the same way 5.10's and 11.1's Dev Notes did for the defects they found.

Follow 5.10's and 11.1's evidence conventions for any fix that touches live data: disposable
rows only (never the two real `User` accounts), inserted and deleted within the same
investigation, confirmed via a row-count check afterward rather than assumed.

## Out of Scope

- Anything story 14.1's automated re-check already covers - a divergence from 5.10's
  recorded transcript is that story's find, not a fresh owner report.
- The three known-open observability items named in this epic's Scope - out of scope for
  this story specifically, not merely unreported.
- Any new feature or behavior the owner did not report as broken.

## Dev Notes

Closed empty on 2026-08-28. The owner reported no bugs over this story's open period and
approved Epic 14 at its review gate with this story still empty, which the epic's Scope names
as a valid outcome. No defect was found by this route; the epic's two fixes both came from
story 14.3's browser sweep and its 14.3a split-out.

### Changed Files

### Verification
