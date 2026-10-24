---
name: status
description: Report BMAD status for one or all initiatives, and what to do next. Read-only.
argument-hint: "[feature-slug]"
disable-model-invocation: true
---

Report the state of every BMAD initiative under `docs/bmad/`, or just the one named in
`$ARGUMENTS` if a feature slug was given.

This is a read-only status check. Do not edit any file.

## Gather the state cheaply

Do **not** read `project-brief.md`, `prd.md`, or `architecture.md` in full. On a mature
initiative those run to thousands of lines, and none of what you need is in the body of
them - it is in whether they exist, whether they have real content, what the epic and
story files say, and what the PRD's `## Execution graph` allows next. One command
answers all of that:

```bash
found=0
for d in docs/bmad/*/; do
  [ -d "$d" ] || continue
  s=$(basename "$d")
  if [ -n "$ARGUMENTS" ] && [ "$s" != "$ARGUMENTS" ]; then continue; fi
  found=1
  echo "=== $s ==="
  for f in project-brief prd architecture HANDOFF; do
    if [ -f "$d$f.md" ]; then printf '  %-16s %s lines\n' "$f.md" "$(wc -l < "$d$f.md")"
    else printf '  %-16s MISSING\n' "$f.md"; fi
  done
  grep -q '^## Execution graph' "$d"prd.md 2>/dev/null || echo "  execution graph: MISSING (nothing can be scheduled)"
  sed -n '/^## Execution graph/,/^## Success/p' "$d"prd.md 2>/dev/null | grep '^- \*\*Epic' | sed 's|^|  |'
  if [ "$(ls "$d"epics/*.md 2>/dev/null | wc -l)" -gt 0 ]; then
    grep -H '^Status:' "$d"epics/*.md | sed 's|.*/epics/|  epic |'
  else echo "  (no epics drafted yet)"; fi
  if [ "$(ls "$d"stories/*.md 2>/dev/null | wc -l)" -gt 0 ]; then
    grep -H '^Status:' "$d"stories/*.md | sed 's|.*/stories/|  |'
  else echo "  (no stories yet)"; fi
  grep -cH '^### Round' "$d"epics/*.md 2>/dev/null | grep -v ':0$' | sed 's|.*/epics/|  review rounds: |'
  newest=$(ls -t "$d"stories/*.md "$d"epics/*.md 2>/dev/null | head -1)
  if [ -n "$newest" ] && [ ! -f "$d"HANDOFF.md ]; then echo "  HANDOFF.md: never written"
  elif [ -n "$newest" ] && [ "$newest" -nt "$d"HANDOFF.md ]; then echo "  HANDOFF.md: STALE (older than $(basename "$newest"))"; fi
done
[ "$found" = 0 ] && echo "no initiative matched${ARGUMENTS:+ '$ARGUMENTS'} under docs/bmad/"
echo "=== uncommitted ==="; git status --porcelain
git log --oneline -8
```

Three details in there are load-bearing, each of which has already broken this skill
once:

- **`grep -cH`, not `grep -c`.** Without `-H`, `grep -c` drops the filename when exactly
  one epic file matches and prints a bare count.
- **The `[ -d ]` guard**, without which an unexpanded `docs/bmad/*/` glob reports a
  phantom initiative named `*`.
- **Counting files instead of `grep ... | sed ... || echo`.** A pipeline's exit status is
  the *last* command's, so `sed` succeeding masks `grep` finding nothing and the
  fallback message never prints. That silently looks identical to an initiative whose
  stories all vanished.

Read a document only when that output is genuinely ambiguous - for example a `prd.md`
of 12 lines, where you need `head -30` to tell a real short PRD from an abandoned stub.

**A dirty tree is not a finding when an epic is under review.** From the moment its last
story is `Done` until the owner approves, an epic is deliberately held as one
uncommitted diff, so `In Review` or `Owner Review` plus uncommitted files is the healthy
state. Report it as such. Uncommitted work is only worth flagging when it sits under an
epic that is `Complete`, or under no epic at all.

## Report, per initiative

Keep it to a few lines each:

- **Current phase**, inferred from which documents have real content and what the epics
  and stories say.
- **What needs work next**, and **which agent does it**: `bmad-analyst`, `bmad-pm`,
  `bmad-architect`, `bmad-sm`, `bmad-dev`, or `bmad-reviewer`. In almost every case the
  answer is "run `/bmad:run <slug>`" - say that rather than listing the agent, unless
  the next step is a phase the driver does not cover (Analyst, PM, Architect).
- **Which epics are available to start**, from the execution graph: dependencies
  `Complete`, no epic file yet. When more than one is available, name them all - an epic
  whose dependencies are all early can be pulled forward, and that is the owner's call.
- **Anything waiting on the owner.** Call these out first - they are the states where
  nothing proceeds until a human acts:
  - an epic at `Blocked` has stalled the loop - read its Review Notes, say which finding
    deadlocked and what decision is needed. Most urgent state; report it first.
  - an epic at `Draft` is waiting for sign-off on its story batch. No agent performs
    that transition.
  - an epic at `Owner Review` has passed the reviewer and is waiting for the owner to
    read the changed-files summary and approve or give feedback.
  - a story at `Blocked` needs an owner decision before that story can proceed.
- **Anything mid-loop but not stalled**: an epic at `In Review` is the reviewer's turn;
  an epic at `In Progress` with open findings is `bmad-dev`'s. Say which round it is on.
  Neither needs the owner.
- **Uncommitted changes with no story `In Progress`.** The driver commits each story at
  `Done`, so a dirty tree with nothing in flight means a run was interrupted. Say so.
- **A stale `HANDOFF.md`**: the command flags this. It should be regenerated after each
  epic completes, by overwriting it from
  `${CLAUDE_PLUGIN_ROOT}/templates/handoff.md` - a snapshot of current state, never a
  running log. Say that is the next step; do not write it yourself, this skill is
  read-only.
