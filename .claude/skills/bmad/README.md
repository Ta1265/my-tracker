# BMAD - a document-driven, phase-gated feature workflow

A BMAD-style (Breakthrough Method for Agile AI-driven Development) workflow, packaged
as a self-contained Claude Code plugin. Nothing in this folder is specific to any repo
or any feature - drop it into any project and it works.

## Why documents, not chat history

Each phase is owned by a dedicated persona (a subagent in `agents/`). A persona reads
only the document(s) produced by the phase before it, and writes only its own document.
That is the whole mechanism: it keeps each phase's context small, and it means any
phase can be picked up cold - new session, new machine, new person - without replaying
the conversation that produced the previous phase.

## Installing it in another project

This folder is the entire workflow. To reuse it:

```bash
cp -r .claude/skills/bmad /path/to/other-project/.claude/skills/
```

Claude Code auto-loads any folder under a skills directory that contains
`.claude-plugin/plugin.json`. There is no install step, no marketplace, and no
`settings.json` change. Two conditions apply to project-scope plugins:

- You must accept the **workspace trust dialog** for that repo.
- The plugin loads from the `.claude/skills/` of **the directory you start Claude Code
  in** - it does not walk up to the repo root. Launch from the repo root, or run
  `/reload-plugins` after changing directories.

To make it available in *every* project instead, copy it to `~/.claude/skills/bmad`
(personal scope, no trust gate).

Edits to `agents/` and `skills/` need `/reload-plugins` or a restart to take effect.

## What it produces

The workflow writes only into `docs/bmad/<feature-slug>/`, one folder per initiative:

```
docs/bmad/
  <feature-slug>/
    project-brief.md      Analyst
    prd.md                PM        (ground rules, and the execution graph)
    architecture.md       Architect
    HANDOFF.md            the driver, after each epic completes
    epics/
      <n>-<slug>.md          Scrum Master creates, Reviewer reviews, owner approves
    stories/
      <epic>-<n>-<slug>.md   Scrum Master drafts, Dev implements
```

The document skeletons live in this plugin's `templates/`, and each agent copies the
one it owns. Agents reference them as `${CLAUDE_PLUGIN_ROOT}/templates/<name>.md`,
which resolves wherever the plugin is installed - so the templates travel with the
workflow instead of being left behind in the project it came from.

## Phases

| # | Phase | Agent | Writes |
|---|---|---|---|
| 1 | Analyst | `bmad-analyst` | `project-brief.md` |
| 2 | PM | `bmad-pm` | `prd.md`, including the execution graph |
| 3 | Architect | `bmad-architect` | `architecture.md` |
| 4 | Scrum Master | `bmad-sm` | one epic file and all of that epic's story files |
| 5 | Dev | `bmad-dev` | the code, plus each story's Dev Notes |
| 6 | Reviewer | `bmad-reviewer` | that epic's Review Notes |

Phases 4-6 repeat once per **epic**, and `/bmad:run` drives them without stopping
except at the two owner gates.

### The unit of batching is the epic

The PRD lists every epic and story up front at the one-line level, so the shape of the
work is visible from the start. Turning those entries into detailed stories - concrete
paths, exact commands, checkable acceptance criteria - happens one epic at a time,
immediately before that epic is implemented.

Not per story, and not per initiative. Both extremes are worse:

- **Per initiative** drafts stories before the facts exist. Earlier epics routinely
  surface things the PRD and architecture did not know about - an undocumented consumer,
  a CI step that breaks on a path change - and a story drafted before that discovery
  needs rewriting anyway.
- **Per story** costs a sign-off gate for every story, which is where this workflow used
  to spend most of its wall-clock time, and it buys nothing for stories that follow a
  pattern an earlier story in the same epic already established.

An epic is the largest batch whose stories share enough context that drafting them
together is *more* accurate than drafting them apart, not less. Drafting them as a set
is also what surfaces the errors a single-story view cannot see: two stories that
overlap, a gap between them, three that each invent a different name for the same
thing.

## Status lifecycle

Two levels. Stories carry implementation state; the epic carries review state.

```
                            ┌──────── one epic ────────┐

epic:   Draft ──(you)──> Ready ──> In Progress ──> In Review ──> Owner Review ──> Complete
                                        ^  │            │  │           │  ^
                                        │  └── all ─────┘  │           │  │
                                        │    stories Done  │           │  │
                                        │                  │           │  │
                                        └── findings ──────┘           │  │
                                            (bmad-reviewer)            │  │
                                        └── your feedback ─────────────┘  │
                                                                       (you)
story:  Draft ──(you)──> Ready ──> In Progress ──> Done
                                        (bmad-dev sets Done itself,
                                         once verification passes)
```

**You appear exactly twice per epic**, and only at the two transitions no agent
performs:

- **`Draft` -> `Ready`**, signing off on the whole story batch at once. `bmad-sm` always
  leaves stories at `Draft`; `bmad-dev` refuses to start anything that is not `Ready`.
- **`Owner Review` -> `Complete`**, approving the epic's diff. You get here only after
  `bmad-reviewer` has passed it, so what you read has already been reviewed.

Everything between those runs unattended.

### One Dev agent per story, not per epic

`bmad-dev` starts fresh for each story and is given exactly that story. It is not one
long-lived agent walking the epic, and the reason is that three mechanisms this design
depends on all decay with context length:

- **Verification.** A fresh agent runs the build because it has no memory of having run
  it. An agent six stories deep concludes it already passed. That gate is the only check
  between a broken story and the ones built on top of it.
- **`### Changed Files`.** A long-lived agent conflates which files belong to which
  story, and per-story commits stop being clean - taking the epic summary and per-story
  revert with them.
- **Scope.** An agent that has read the whole epic starts doing story 5's work while in
  story 3, because it can see the connection.

The token tradeoff is closer than it looks: a fresh agent pays a flat re-read cost per
story, a long-lived one pays its accumulated context on every turn thereafter, and past
four or five stories the second is usually the more expensive.

The exception is the **fix round**, which runs as one agent across the whole epic.
Findings reference each other and fixes need a whole-epic view, so there the long context
is the point.

Where this costs something is an epic of near-identical stories rediscovering the same
pattern once each. The fix is `bmad-sm` writing the established pattern into the sibling
stories, not a longer-lived agent - cheaper, and it survives across sessions.

### There is no per-story review gate

`bmad-dev` sets its own story to `Done`. The thing that makes that safe is not trust, it
is the **verification gate**: a story may only reach `Done` once the commands its
Technical Notes name have actually been run and passed. That check is mechanical and
deterministic, it takes seconds, and it catches the failure mode that matters here -
seven stories built on top of a broken one, discovered only at the epic review.

Judgment review is what moved to the epic boundary. Mechanical verification did not, and
must not.

### Blocked

`Blocked` means something could not be resolved without your decision. Nothing proceeds
until you make it, and **no agent leaves `Blocked`**. There are two ways out, and the
Reviewer says which one it is asking for when it escalates:

- **The disagreement had an answer.** Record your ruling and set the epic back to
  `In Progress`. That puts `bmad-dev` back in fix mode with the answer it was missing.
- **The story was wrong.** Send it back to `bmad-sm` to redraft, which returns it to
  `Draft` and to your sign-off gate.

## The Dev/Reviewer loop

Dev and Reviewer iterate until the epic is clean, rather than the Reviewer fixing things
itself. The split is deliberate:

- **`bmad-dev` owns every change to the working tree**, including fixes for findings.
  One author for the diff.
- **`bmad-reviewer` owns the judgment about whether the epic is ready for you**, and
  never edits code - only the epic's Review Notes.

`/bmad:run` drives the loop: `bmad-dev` for each story, then `bmad-reviewer` on the
epic, and if the Reviewer hands it back at `In Progress`, `bmad-dev` again pointing at
the open findings, then `bmad-reviewer` again. Each pass appends a new round, and
findings carry stable IDs (`F1`, `F2`) across rounds so a disagreement can be followed.

### The Reviewer runs before you, not after

This is the ordering that decides how much of your time the workflow costs. The reviewer
loops with Dev until nothing blocking remains, and only then does the epic reach you. So
however many rounds that takes, **you are pulled in once.**

The reverse - you first, reviewer second - costs you a pass per reviewer round, and
worse, the first thing you look at is code nothing has checked. Your attention goes to
missed null checks and inconsistent error shapes instead of to whether this is the
product you wanted, which is the only question you can answer and the reviewer cannot.

The same invariant holds after you give feedback: Dev applies it, the Reviewer passes
over the new code, and only then does it come back to you. **You never read unreviewed
code.**

### Review depth is proportional

Not every change earns the same scrutiny, and a security audit on a docs commit is not
thoroughness - it is noise that buries the findings that matter. The Reviewer groups an
epic's diff by what each part touches and picks a depth per group:

- **Skim** for docs, comments, formatting, pure renames, lockfile regeneration. Checks
  only that the change is what it claims and its criteria are met.
- **Standard** for ordinary logic and new isolated code. Acceptance criteria,
  correctness, reuse, conventions, hallucinated references.
- **Deep** adds error handling, security, and performance, and is triggered by concrete
  signals rather than by feel: a trust boundary (auth, secrets, input parsing, shelling
  out, outbound requests), money or data integrity, changed behavior that already has
  live consumers, or anything that can run twice or concurrently.

Depth is chosen **per file group, not per epic** - twelve doc files and one auth guard
means skim on twelve and deep on one. The Reviewer states its choice in one line at the
top of each round, so the judgment is visible and you can correct it.

### Dev can veto

For each blocking finding, Dev either **fixes** it or **disputes** it with
justification. A dispute has to meet the same evidence standard as a finding - cite the
code, name the case where the claim does not hold. "This is minor" is not a dispute.

The Reviewer then adjudicates: **withdraw** the finding if Dev is right, or **contest**
it by answering the specific argument with evidence it has not already given. A
reviewer that can only restate its original finding should withdraw it.

Neither agent can unilaterally win. Dev cannot silently ignore a finding, and the
Reviewer cannot force a fix it cannot defend.

### When it stops

The loop ends at `Owner Review` when no blocking findings remain. It ends at `Blocked`,
for you to decide, when:

- **Deadlock** - a finding was contested and disputed again, with both sides stated
  twice and no convergence.
- **Three rounds** have completed with blocking findings still open.
- **A fix would need a judgment call**, expand a story's scope, or break a ground rule.
- **The story itself is wrong** - an unachievable or self-contradictory acceptance
  criterion, which is a `bmad-sm` problem rather than a diff problem.

On `Blocked`, the Reviewer states both positions fairly and says what it needs from
you, without using the last word to advocate for its own side.

## Commit cadence

One commit per story, made by the driver the moment `bmad-dev` sets that story `Done`.
No pause, no sign-off, no ceremony - **committing is bookkeeping, not a checkpoint.**

Committing is never part of any phase's definition of done. `bmad-dev` and
`bmad-reviewer` are both forbidden from running `git add` or `git commit`; the driver
does it between stories, using that story's `### Changed Files` list as an explicit
pathspec.

**Never `git add -A`.** A repo usually carries things that are deliberately untracked -
scratch files, local config, and in most BMAD repos the `docs/` planning artifacts
themselves. A blanket add sweeps them into a story commit, and the fact that
`### Changed Files` is an explicit list is what makes the narrow add possible.

Per-story commits are load-bearing for two things downstream, which is why the cadence
survived even though the gate did not:

- The epic's `Base commit` is the **diff baseline** the review and the changed-files
  summary are computed against.
- A single story stays **revertable** while the epic is still being built.

### Collapse the epic into one commit before review

Per-story commits are scaffolding for building an epic, not the shape it ships in. Once
the last story is `Done`, the driver soft-resets every commit back to the epic's
`Base commit`:

```bash
git reset --soft <base commit>
```

The epic's whole change is then one uncommitted diff. That is the form both
`bmad-reviewer` and the owner review, and it is the point of doing this: a reviewer
reading five separate commits sees a file that story 2 wrote and story 4 rewrote as two
changes, and reviews the intermediate state as though it were going to ship. It is not.
Only the final state ships, so only the final state should be read.

The reset is not a checkpoint and needs no sign-off - it happens the moment the last
story is `Done`, before the changed-files summary is rendered.

Fix rounds then land in the working tree rather than as new commits, which keeps the
property above true no matter how many rounds an epic takes. Nothing is committed again
until the owner approves at `Owner Review`, at which point the driver makes **one commit
for the whole epic**, staging the aggregated `## Changed Files` list as an explicit
pathspec.

The obvious objection is that a soft reset discards per-story history. It does, and that
is deliberate - by the time an epic reaches review, "revert story 3 alone" is not a
thing anyone does, because the stories after it are built on top. What survives is the
per-story record in the story files themselves, which is where that history was always
more legible anyway.

**Uncommitted work is the normal state of an epic under review.** A driver recomputing
state from scratch mid-review will find a dirty tree; that is expected and is not a
reason to commit.

### Regenerate HANDOFF.md right after each epic

`docs/bmad/<feature-slug>/HANDOFF.md` is a session bridge, not a BMAD artifact.
Overwrite it after every epic completes - it is a snapshot of current state, never a
running log.

Copy `${CLAUDE_PLUGIN_ROOT}/templates/handoff.md` the first time, then overwrite it in
place after each subsequent story.

Keep it to what `/bmad:status` cannot compute. That skill reads story statuses, file
states and git history directly, so **do not restate ground rules, story statuses, or
the phase order in HANDOFF.md** - that is exactly the duplication that goes stale. What
belongs there is the gotcha a fresh session would otherwise rediscover by trial, any
change made to the workflow itself, open threads not captured in a story file, and the
single concrete next action.

## The driver

`/bmad:run <feature-slug>` is what actually moves an initiative. It recomputes state
from the files on every run, works out what can happen next, runs it, and stops only at
an owner gate. A fresh session running the same command picks up exactly where the last
one left off - there is no handoff, because there is no state held anywhere but the
files.

It orchestrates and does nothing else: it does not read source, write code, or form its
own opinion of the diff. Every unit of work goes to the agent that owns that phase. That
restraint is what keeps it cheap enough to re-run constantly, and it is the same
"documents, not chat history" property everything else here runs on.

### What you see at a gate

Both owner gates present the work so you can act without opening a file first. The epic
review gate renders the epic's changed files with a one-line blurb each:

```
Epic 4 - Authentication                    3 stories, 7 files
Reviewed: 2 rounds, 3 findings resolved, 1 withdrawn

  + backend/src/auth/auth.guard.ts         JWT guard, 401 on missing or expired token
  + backend/src/auth/auth.module.ts        wires the guard globally
  ~ backend/src/app.module.ts              registers AuthModule
  ~ backend/.env.example                   adds AUTH_SECRET
  - backend/src/auth/stub.guard.ts         replaced by the real guard
```

**`bmad-dev` writes those blurbs as it goes**, into each story's `### Changed Files`;
the driver only aggregates them. Writing them at the point of change is both cheaper and
more accurate than summarizing a large diff afterwards, and it means the list doubles as
the commit pathspec - a file missing from it is a file that does not get committed.

### When the diff is the wrong thing to review

Some epics are not judged by reading their diff. The deliverable is a rendered page, a
generated document, a running service, a real login - and the file list is not just
insufficient there, it actively points the owner at the wrong question.

Those epics carry a `## Gate` section in the epic file, written by `bmad-sm`: the
artifact to open, how to bring it up, and what makes it pass. The driver leads the gate
with that and puts the changed-files summary underneath.

The signal that an epic needs one is usually already in the PRD, in one of two shapes: a
ground rule demanding that a specific artifact be signed off, or a "story" whose entire
content is the owner reviewing something. The second is a gate wearing a story's clothes.
It should be a `## Gate`, not a story - a Dev agent handed it has nothing to implement,
and leaving it as a story means the owner signs off twice on the same artifact, once for
the story and once for the epic.

The same summary is printed once earlier, when Dev finishes the epic and before the
Reviewer starts. That one is **informational and does not wait**: it is there so you can
see the shape of an epic early and interrupt if it is wrong, not so you have to respond.

## The execution graph

`prd.md` carries a `## Execution graph` section, written by `bmad-pm`, giving every epic
its dependencies:

```
- **Epic 5** depends-on: 4
- **Epic 6** depends-on: 1
- **Epic 8** depends-on: OUT OF SCOPE
```

This is the only machine-readable statement of what may run when, and the driver
schedules directly off it. An epic missing from it never runs. Epics run one at a time,
in the order the graph allows.

**`depends-on` is the real constraint, not the numbering.** The question is what an epic
actually consumes - an epic that only needs the scaffold says `depends-on: 1` however it
is numbered. Two things fall out of writing that down honestly rather than transcribing
the numbering:

- **An epic can be pulled forward.** If Epic 6 depends only on Epic 1, you can choose to
  build it before Epics 3 to 5 rather than after, because the graph proves nothing in
  between is needed. The driver surfaces that as a choice; it does not reorder on its
  own.
- **An epic can be fenced off.** `depends-on: OUT OF SCOPE` is a dependency nothing can
  satisfy, so an epic carrying it is never schedulable. That is how an epic the PRD
  lists for sequencing but forbids building stays unbuildable, without a second
  mechanism to enforce it.

## Ground rules are per-feature, not part of this plugin

Some initiatives need binding constraints that outrank any individual story - "additive
only, nothing under the legacy API is deleted", "no implementation work starts before
the scaffold is signed off". Those are **feature-scoped**, so `bmad-pm` writes them
into a `## Ground rules` section in that feature's `prd.md` as `GR-1`, `GR-2`, and so
on, and every later phase reads them from there.

Do not copy ground-rule text into story files. Cite the ID and add only the one line of
story-specific relevance - `GR-1 applies: nothing under the legacy API path is touched
here`. Restating the full rule in every story is how the two copies drift apart.

The process rules on this page (commit cadence, sign-off gates) apply to every
initiative and are not numbered as GRs. If a PRD's ground rules restate them, the PRD
copy will eventually contradict this page - reference instead.

## Delegating to the phase agents

`bmad-sm` and `bmad-dev` declare `model: sonnet` in their own frontmatter, because
story drafting and single-story implementation are mechanical. The remaining agents
inherit the parent session's model, since they make real judgment calls under ambiguity
- the Architect's elicitation gate, PM scoping tradeoffs, the Reviewer catching a bug
or an inert config a cheaper pass would miss.

### Agents cannot hold a conversation

A subagent has no interactive channel back to you. To say anything mid-run it has to end
its turn, and `AskUserQuestion` is **not** available inside a subagent - naming it in an
agent's `tools:` list does nothing, it is dropped exactly like a misspelled tool name.
Verified, not assumed.

That is a real constraint on the two phases whose job is partly to ask, so both are
built as two invocations rather than one conversation:

- **Analyst.** First pass writes what it can and puts the rest in `## Open Questions`,
  then stops and says the brief is provisional. You answer; it is re-invoked with the
  answers and folds them in.
- **Architect.** The gate pass writes no design at all - it enumerates the forks, with
  options, tradeoffs and a recommendation for each, and ends there. You answer; the
  design pass writes `architecture.md` and records the answers in Key Decisions.

The orchestrating session is what carries the questions to you, because it is the only
place with a channel to you. Re-reading the source document on the second pass is the
intended cost, not waste - it is the same "documents, not chat history" property
everything else here runs on.

The Scrum Master does not need a gate: it picks the next available epic from the
execution graph and states that choice up front so you can redirect it.

The failure this prevents is the quiet one. An unsurfaced default is still a decision
made on your behalf, and it is the one you are least likely to notice until it is
expensive.

Also look for verification a human does faster and more reliably than an agent: logging
in with real credentials, eyeballing a rendered page, confirming a business decision
looks right. When a story's acceptance criteria include one of those, ask the owner to
check it directly rather than spending agent turns working around missing access. It
avoids an agent doing something unauthorized (forging a session, stubbing out an auth
check) to route around a hard blocker.

## Files in this plugin

| Path | Role |
|---|---|
| `.claude-plugin/plugin.json` | Manifest. Its `name` sets the `/bmad:` skill namespace. |
| `README.md` | This file - the process definition. |
| `templates/` | Skeletons for each document, copied by the agent that owns it (`handoff.md` by the driver). |
| `agents/bmad-analyst.md` | Phase 1. Owns `project-brief.md`. |
| `agents/bmad-pm.md` | Phase 2. Owns `prd.md` and the ground rules. |
| `agents/bmad-architect.md` | Phase 3. Owns `architecture.md` and the elicitation gate. |
| `agents/bmad-sm.md` | Phase 4. Drafts one whole epic at a time. |
| `agents/bmad-dev.md` | Phase 5. Implements one story, or fixes an epic's findings. |
| `agents/bmad-reviewer.md` | Phase 6. Reviews one epic's diff, at a depth it picks. |
| `references/review-checklist.md` | The Reviewer's what-to-check list, in numbered categories the depth tiers select from. Loaded on a first review only. |
| `skills/run/SKILL.md` | `/bmad:run <feature>` - the driver. Runs phases until it hits an owner gate. |
| `skills/status/SKILL.md` | `/bmad:status` - read-only status of every initiative. |
| `skills/new/SKILL.md` | `/bmad:new <feature>` - starts an initiative. |
