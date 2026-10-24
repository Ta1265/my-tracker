<!--
Owned by: bmad-sm (drafts), bmad-dev (implements)

Review happens once per epic, not per story - findings live in the epic file under
`docs/bmad/<feature-slug>/epics/`, not here.

Copy to `docs/bmad/<feature-slug>/stories/<epic>-<n>-<slug>.md` - hyphens throughout,
e.g. `1-1-project-scaffold.md`, `1-2a-bump-node-version.md`. One file per story.

It must be self-contained: a dev agent should be able to implement it without
re-reading prd.md or architecture.md in full. Say each fact exactly once, in the
section that owns it - see "Writing efficiently" in the bmad-sm agent.
-->

# Story <epic>.<n>: <title>

Status: Draft

<!-- Draft | Ready | In Progress | Done | Blocked

     Draft -> Ready is the owner's sign-off gate, given once for the whole epic's
     story batch. No agent performs it.

     Done is set by bmad-dev itself, and only once the story's verification commands
     have actually passed. There is no per-story review gate - the reviewer runs once
     the whole epic is Done.

     Blocked means this story needs an owner decision before it can proceed. -->

## Context

Why this story exists and where it sits, referencing the relevant epic in `prd.md`.
Cite any ground rules that constrain it by ID plus one line of relevance - don't
reproduce the rule's text.

## Acceptance Criteria

- [ ] Criterion 1
- [ ] Criterion 2

## Technical Notes

The current shape of the code a dev would otherwise have to go read, and the specific
`architecture.md` decisions (by ID) this story implements. Pull forward the actionable
facts - exact paths, commands, values - not the full reasoning behind them.

## Out of Scope

What this story explicitly does not cover, and which story owns it instead.

## Dev Notes

(Filled in by bmad-dev: decisions made, and anything that deviated from the story as
drafted. Keep it to what a reader could not get from the diff.)

### Changed Files

<!--
One line per file bmad-dev touched, written as it goes. The driver aggregates these
into the epic's Changed Files summary, which is what the owner reads at the review
gate, and uses the paths as the commit pathspec - so a file missing here is a file
that does not get committed.

Marker is + added, ~ modified, - deleted. Blurb says what changed in a few words; do
not restate the path.

  + backend/src/auth/auth.guard.ts    JWT guard, 401 on missing or expired token
  ~ backend/src/app.module.ts         registers AuthModule
-->

### Verification

<!--
The commands actually run and their result. Done cannot be set until these pass.

  pnpm --filter backend build    pass
  pnpm --filter backend test     pass (14 tests)
-->
