# Epic 1: Monorepo restructure and backend skeleton

Status: Complete

Stories: 1.1, 1.2, 1.2a, 1.3, 1.4, 1.5, 1.6
Depends on: none
Base commit: 217dbe5

## Scope

A repo shaped `frontend/` + `backend/` on pnpm and Node 24, with an empty-but-booting
NestJS service wired into Compose and nginx, and the application behaving exactly as it
does today. No API work.

## Changed Files

<!--
Backfilled. This epic was built story by story under the previous per-story workflow, so
there are no Dev-written per-file blurbs to aggregate. The commits are the record:

  git log --oneline 217dbe5..523681d
  git diff --stat 217dbe5..523681d

Story 1.1 produced `docs/bmad/nestjs-migration/inventory-root-vs-frontend.md` and has no
commit of its own - `docs/` is deliberately untracked on this branch.
-->

## Review Notes

<!--
Reviewed per story under the previous workflow. The rounds are recorded in each story
file's own `## Review Notes`, and are left there as the historical record of how these
stories were actually reviewed. Do not migrate them here.
-->

## Owner Feedback

<!-- Signed off per story under the previous workflow, one commit at a time. -->
