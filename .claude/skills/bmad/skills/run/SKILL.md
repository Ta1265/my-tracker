---
name: run
description: Drive a BMAD initiative forward until it hits an owner gate. Runs phases, commits stories, and reports what needs you.
argument-hint: "<feature-slug> [epic number]"
disable-model-invocation: true
---

Drive the BMAD initiative named in `$ARGUMENTS` forward, running every phase that can
run without the owner, and stopping when you reach a gate that needs them.

You are the orchestrator. You do not read source files, write code, or review diffs
yourself - every unit of work goes to the agent that owns that phase. Your job is
deciding what runs next, committing finished stories, and carrying questions to the
owner. That division is what keeps this skill cheap enough to re-run constantly.

## Recompute state, never remember it

Work out where the initiative stands from the files, every time, exactly as
`/bmad:status` does. Do not carry state in your head across a run, and do not trust a
summary from earlier in the conversation. This is what makes the driver resumable: a
fresh session running `/bmad:run <slug>` picks up precisely where the last one stopped,
with no handoff.

```bash
d="docs/bmad/$1"
[ -d "$d" ] || { echo "no such initiative: $1"; exit 1; }
sed -n '/^## Execution graph/,/^## /p' "$d/prd.md"
grep -H '^Status:' "$d"/epics/*.md 2>/dev/null | sed 's|.*/epics/|  epic |'
grep -H '^Status:' "$d"/stories/*.md 2>/dev/null | sed 's|.*/stories/|  |'
grep -c '^### Round' "$d"/epics/*.md 2>/dev/null | grep -v ':0$'
git log --oneline -5; git status --porcelain
```

## The cycle

For each epic, in the order the execution graph allows:

| # | State | What you do |
|---|---|---|
| 1 | no epic file | Run `bmad-sm` for that epic. It writes the epic file and every story, all at `Draft`. |
| 2 | epic `Draft` | **Owner gate.** Present the story batch. Stop. |
| 3 | epic `Ready` | Record `Base commit`, set `In Progress`, run `bmad-dev` on each `Ready` story in order. Commit each as it reaches `Done`. |
| 4 | all stories `Done` | `git reset --soft <base commit>` so the epic is one uncommitted diff. Aggregate `## Changed Files`, print it, set `In Review`, and **keep going** - this is not a gate. |
| 5 | epic `In Review` | Run `bmad-reviewer`. |
| 6 | reviewer set `In Progress` | Run `bmad-dev` in epic fix mode, then back to step 5. Fixes stay uncommitted. |
| 7 | epic `Owner Review` | **Owner gate.** Present the changed-files summary. Stop. |
| 8 | owner gave feedback | Record it under `## Owner Feedback`, set `In Progress`, run `bmad-dev`, then back to step 5. Fixes stay uncommitted. |
| 9 | owner approved | Make **one commit** for the whole epic. Set `Complete`. Move to the next epic in the graph. |
| 10 | epic `Blocked` | **Owner gate.** Report what decision is needed. Stop. |

Run the whole chain without pausing anywhere except steps 2, 7 and 10. Those three are
the only places the owner is needed, and the point of this skill is that nothing else
interrupts them.

If `$ARGUMENTS` names an epic number, drive only that epic. Otherwise drive every epic
the graph makes available, and keep going after one completes.

## Scheduling from the execution graph

The PRD's `## Execution graph` gives each epic a `depends-on` list. An epic is
**available** when every epic it depends on is `Complete`. Run one epic at a time.

When more than one epic is available, take the lowest-numbered one, but **say that
others were available and name them**. A graph where Epic 6 depends only on Epic 1 means
6 can be pulled ahead of 3 through 5, and that is a call worth surfacing rather than
silently deciding by number. Do not reorder on your own.

An epic whose `depends-on` cannot be satisfied is not schedulable, and
`depends-on: OUT OF SCOPE` is the deliberate form of that. Never start one, and never
edit the graph to make one runnable - that is a PRD change, which is `bmad-pm`'s.

## Committing

Commit each story the moment `bmad-dev` sets it `Done`. No gate, no pause, no owner
sign-off - this is bookkeeping, not a checkpoint.

```bash
git add -- <every path from that story's ### Changed Files>
git commit -m "<story title> (<epic>.<n>)"
```

Why it still matters now that it is not a gate: it keeps each story's work separable
while the epic is being built, and it is what the `### Changed Files` list is checked
against while that list is still fresh. Record the epic's `Base commit` **before** the
first story of that epic runs, since everything downstream diffs against it.

**Stage named paths only. Never `git add -A` or `git commit -a`.** Repos routinely carry
deliberately untracked files - scratch work, local config, and often the `docs/` planning
artifacts themselves - and a blanket add commits them by accident.

If a story's `### Changed Files` list is missing, or names paths `git status` does not
show as modified, do not guess and do not fall back to a blanket add. Stop and say so -
the list is wrong, and `bmad-dev` needs to fix it before the epic can be reviewed against
an accurate summary.

Never commit while `bmad-dev` is mid-story. Between stories only.

### Collapse to one commit before review

The moment the last story is `Done`, soft-reset the epic's commits away:

```bash
git reset --soft <base commit>
```

Nothing is lost - every change is still there, now as one uncommitted diff. That is the
form `bmad-reviewer` and the owner both review, and it is why the reset happens before
the changed-files summary rather than after approval. A reviewer handed five commits
reviews intermediate states that never ship: a file story 2 wrote and story 4 rewrote
reads as two changes, and the first one is dead on arrival.

Do this without pausing. It is bookkeeping, exactly like the per-story commits were.

**From here until the owner approves, the tree stays dirty.** Fix rounds from steps 6
and 8 land in the working tree, not in new commits, however many rounds it takes. A
dirty tree during review is the expected state, not a signal that something needs
committing.

### The single epic commit

Only after the owner approves at step 7:

```bash
git add -- <every path from the epic's aggregated ## Changed Files>
git commit -m "<epic title>"
```

Same pathspec discipline as the per-story commits - the epic's `## Changed Files` is the
explicit list, and it is the only thing that gets staged.

If the reset has already happened and you cannot determine the base commit, do not guess
and do not commit. The epic file's `Base commit` line is the record; if it is missing,
say so rather than inventing a baseline.

## The changed-files summary

This is what the owner reads at the review gate, so it is the highest-value thing you
produce. Aggregate every story's `### Changed Files` into the epic file's
`## Changed Files`, then render it:

```
Epic 4 - Authentication                    3 stories, 7 files
Reviewed: 2 rounds, 3 findings resolved, 1 withdrawn

  + backend/src/auth/auth.guard.ts         JWT guard, 401 on missing or expired token
  + backend/src/auth/auth.module.ts        wires the guard globally
  + backend/src/auth/jwt.strategy.ts       validates against AUTH_SECRET
  ~ backend/src/app.module.ts              registers AuthModule
  ~ backend/src/main.ts                    Swagger bearer-auth scheme
  ~ backend/.env.example                   adds AUTH_SECRET
  - backend/src/auth/stub.guard.ts         replaced by the real guard

  git diff <base>..HEAD -- <path>          to read any one file
  git log -p --reverse <base>..HEAD        to read it story by story
```

Sort by marker then path, group by story only if the epic has more than about fifteen
files. Do not editorialize the blurbs Dev wrote and do not summarize them further - if a
blurb is vague, that is a signal worth passing on, not one to paper over.

Print this twice: once at step 4 when dev finishes, and again at step 7 with the review
outcome attached. **Step 4 is informational and you do not wait** - it is there so the
owner can see the shape of the epic early and interrupt if it is wrong, not so they have
to respond. Say explicitly that you are continuing to the reviewer.

## Presenting a gate

At every stop, the owner should be able to act without opening a file first.

**Step 2, the story batch.** One line per story: number, title, and what it delivers.
Name anything you would want a second opinion on - a story whose scope looks wrong, two
that overlap, a gap you can see. Then say what you need: sign-off on the batch, or
which stories to send back to `bmad-sm`.

**Step 7, the epic review.** The changed-files summary, the review outcome including any
advisory findings still open, and anything a story flagged as needing human verification
- credentials, a rendered page, a business judgment. Then say what you need: approval,
or feedback.

**If the epic file has a `## Gate` section, lead with it** and put the changed-files
summary below. That section exists because the thing the owner has to judge is not the
diff - it names an artifact to open, how to bring it up, and what makes it pass. Leading
with a file list there sends them to read source when the whole point is that reading
source does not answer the question. Run the command it names if there is one, confirm
the artifact is actually reachable, and say so; do not send the owner to a URL you have
not checked responds.

**Step 10, blocked.** The reviewer or Dev has already written what it needs. Relay it
without re-arguing either side, and say which of the two exits applies: a ruling that
sends it back to `In Progress`, or a redraft that sends it back to `bmad-sm`.

Never advocate for approval at a gate. Presenting the work is your job; judging it is
the owner's.

## What you do not do

- Do not read source files or diffs to form your own opinion of the code. The reviewer
  has that job, and duplicating it in the orchestrating session is exactly the cost this
  split exists to avoid.
- Do not write or edit code, story content, or review findings. You edit only status
  lines, `Base commit`, `## Changed Files`, and `## Owner Feedback`.
- Do not perform either owner transition yourself - `Draft` -> `Ready` and
  `Owner Review` -> `Complete` are the owner's, always, no matter how obvious the answer
  looks.
- Do not leave a `Blocked` epic. No agent leaves that state.
- Do not skip the reviewer because an epic looks small. Depth is the reviewer's call to
  scale, not yours to skip.
