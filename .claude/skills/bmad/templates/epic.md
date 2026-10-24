<!--
Owned by: bmad-sm (creates), bmad-reviewer (review rounds), the driver (status, summary)

Copy to `docs/bmad/<feature-slug>/epics/<n>-<slug>.md` - one file per epic, created by
bmad-sm at the same time as that epic's story batch.

This is where epic-scoped state lives: the status that carries the review loop, the
reviewer's rounds, and the owner's feedback. Per-story files keep Dev Notes and nothing
else about review.
-->

# Epic <n>: <title>

Status: Draft

<!-- Draft | Ready | In Progress | In Review | Owner Review | Complete | Blocked

     Draft         bmad-sm has drafted the story batch; awaiting the owner's sign-off.
     Ready         Owner signed off on the batch. Every story in it is Ready.
     In Progress   bmad-dev is working: implementing stories, or fixing findings.
     In Review     Every story is Done. bmad-reviewer's turn.
     Owner Review  Reviewer found nothing blocking. The owner's turn, and the only
                   gate where the owner reads code.
     Complete      Owner approved. Nothing further happens to this epic.
     Blocked       Needs an owner decision. No agent leaves this state.

     Draft -> Ready and Owner Review -> Complete are the owner's two gates.
     No agent performs either. -->

Stories: <n>.1, <n>.2, <n>.3
Depends on: <epic numbers, or none>
Base commit: <sha recorded by the driver when the epic starts; the diff baseline>

## Scope

Two or three lines on what this epic delivers, lifted from the PRD's epic goal. Enough
that a reviewer arriving cold knows what the diff is supposed to accomplish, without
opening `prd.md`.

## Gate

<!--
OPTIONAL. Delete this heading if the epic's Owner Review gate is just "read the diff".

Fill it in when the thing the owner must actually judge is not the diff - a rendered
page, a generated document, a running service, a real login. Say what artifact to open,
how to get to it, and what makes it pass. The driver presents this instead of leading
with the changed-files summary, because for these epics the file list is the wrong thing
to put in front of the owner and will pull their attention to the wrong question.

  Artifact: the generated Swagger UI at https://localhost/api/docs
  Bring it up with: docker compose up -d backend
  Passes when: every endpoint from the 2.1 inventory is present, each with a realistic
  request and response example, tags coherent, auth posture visible per endpoint.
  Reading the controller source instead does not count - a scaffold that compiles but
  generates thin Swagger output is exactly what this gate exists to catch.
-->

## Changed Files

<!--
Aggregated by the driver from each story's Dev Notes once every story is Done. This is
what the owner reads at the Owner Review gate, so it is the highest-value section in
the file. Marker is + added, ~ modified, - deleted. One short blurb per file, saying
what changed, not restating the path.

  + backend/src/auth/auth.guard.ts    JWT guard, 401 on missing or expired token
  ~ backend/src/app.module.ts         registers AuthModule
-->

## Review Notes

<!--
bmad-reviewer appends one round per pass; bmad-dev appends its response beneath each
finding. Finding IDs are stable across rounds. Neither agent edits the other's text.

### Round 1

Depth: `backend/src/auth/**` deep (auth boundary) · everything else standard

- **F1** [blocking · correctness] `path/to/file.ts:42` - <one-sentence defect>
  <evidence: the offending snippet, and the concrete inputs/state that fail>
  - Status: Open
  - *Dev*: Fixed - <what changed, by file:line>   OR
    Disputed - <why the finding is wrong, with evidence>
  - *Reviewer*: Resolved | Withdrawn - <what I missed> | Contested - <answer to the
    specific argument, with new evidence>
-->

## Owner Feedback

<!--
The owner's feedback at the Owner Review gate, recorded by the driver so bmad-dev can
act on it precisely and a later session can see why the code looks the way it does.
One heading per round, same shape as review rounds.

### Feedback 1
- The summary endpoint should return an empty array rather than 404 on no holdings.
- Drop the debug logging in price-history.
-->
