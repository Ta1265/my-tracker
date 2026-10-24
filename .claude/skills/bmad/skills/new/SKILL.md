---
name: new
description: Start a new BMAD initiative (Analyst phase) for a feature.
argument-hint: "<feature name or slug>"
disable-model-invocation: true
---

Start a new BMAD initiative for: $ARGUMENTS

1. Derive a short kebab-case feature slug from the argument - "email notifications"
   becomes `email-notifications`. If the argument is empty or too vague to derive a
   slug from, ask the user for one before continuing.
2. Check whether `docs/bmad/<feature-slug>/` already exists. If it does, tell the user
   this initiative already exists and suggest `/bmad:status <feature-slug>` instead of
   starting over.
3. Otherwise launch the `bmad-analyst` agent via the Agent tool, **in the foreground**
   (`run_in_background: false`) so its report lands in this conversation before you
   continue. Give it the feature slug and the user's description of the feature.

The Analyst creates `docs/bmad/<feature-slug>/` and drafts the project brief. It cannot
ask you anything mid-run - a subagent has no channel back to you - so it returns a
provisional brief with its real gaps listed under `## Open Questions`, rather than
inventing motivation to look finished.

That makes the first pass the start of a conversation, not the end of one. Put those
questions to the user yourself, then re-invoke `bmad-analyst` with the answers so it can
fold them in. Do not answer them on the user's behalf.

Once the brief settles, the remaining up-front phases are `bmad-pm` then
`bmad-architect`, both with their own gates. After `architecture.md` exists, hand over
to `/bmad:run <feature-slug>` - the driver takes it from there and only stops at an
owner gate.
