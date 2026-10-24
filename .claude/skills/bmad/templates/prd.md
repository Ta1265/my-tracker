<!--
Owned by: bmad-pm
Read by: bmad-architect, bmad-sm

Requirements only - no technical design here, that's the Architect's job. Break work
into epics (a coherent slice of the feature) and stories (small, independently
implementable/testable units) within each epic.
-->

# PRD: <feature name>

## Summary

One paragraph restating the goal from `project-brief.md` in requirements terms.

## Ground rules

<!--
Constraints that bind every epic and story, where a story violating one is invalid
regardless of its own acceptance criteria. Number them GR-1, GR-2, ... so later phases
can cite them by ID instead of reproducing the text.

Feature-scoped constraints only. Do not restate the BMAD process itself - commit
cadence and the sign-off gates apply to every initiative and are defined in the
plugin's README.md. Write each rule so it is decidable.

Delete this whole section if the initiative has no such constraints.
-->

**GR-1 - <short name>.** <the rule>

## Requirements

Functional and non-functional requirements this feature must satisfy. Reference
specific existing code/files where relevant instead of describing them abstractly.

## Epics

### Epic 1: <name>

Goal of this epic.

**Stories**
- [ ] 1.1 - <story title>
- [ ] 1.2 - <story title>

### Epic 2: <name>

...

## Execution graph

<!--
Scheduling data, read by /bmad:run. One line per epic, in epic order. Epics run one at
a time.

`depends-on` lists the epics that must be Complete before this one may start. Use the
real constraint, not the numbering - an epic that happens to be numbered 6 but only
needs Epic 1's output should say `depends-on: 1`, which is what makes it visible that
it could be built early. Write `none` for a root epic.

For an epic the PRD lists for sequencing but forbids building under this initiative,
write `depends-on: OUT OF SCOPE`. Nothing can satisfy that, so it is never schedulable.
-->

- **Epic 1** depends-on: none
- **Epic 2** depends-on: 1

## Success Criteria

How we'll know this feature is complete and correct.
