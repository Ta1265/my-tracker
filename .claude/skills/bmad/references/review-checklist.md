<!--
Loaded by: bmad-reviewer, on a FIRST review of an epic only.

Kept out of the agent body on purpose. A re-review adjudicates the previous round and
checks what changed since it; it does not re-run this list, so it should not pay to
load it.

The category numbers are load-bearing - the agent's "Review depth" section selects
categories by number. Do not renumber without updating it. The current mapping is:

  skim      1 only, and only the "is this actually what it claims" half of it
  standard  1, 2, 6, 7, 8
  deep      all of them
-->

## What to check

Work these in order, over the categories your chosen depth selects for that file group.
Skip a category outright when it plainly does not apply, rather than padding the review
with empty sections. Ignore what a linter, type-checker, or CI already catches.

**1. Acceptance criteria fidelity.** Every `[x]` is actually true of the diff - verify,
do not trust the checkbox. A criterion saying "confirm X" means a command was run and
output observed, not assumed. Nothing in Out of Scope was touched: scope creep is a
process violation, not a style nitpick, so flag it even when the extra work looks
reasonable. Nothing outside the story's stated files changed without explanation.

**2. Correctness.** Does each changed unit do what its name, comment, or config key
claims? This includes non-code config - a cache, mount, or environment variable
pointed at a path or key that nothing actually reads or writes is exactly this class of
bug, and it fails silently. Also: off-by-one and inclusive/exclusive boundaries in
loops, slices, ranges, pagination; every added branch reachable and meaningful; every
return path producing the shape callers expect; steps that exit 0 without doing their
job; path and directory-level errors in anything restructuring a build context or file
layout, which fail at runtime rather than build time. Cover edge cases the story's own
verification did not: empty and null inputs, numeric boundaries, timezone and rounding
arithmetic, encoding edges.

**3. Error handling, idempotency, concurrency.** Relevant once real application code is
in scope. Are errors caught at the right layer or swallowed? Do new error paths
preserve the original cause? Does a changed function fail closed or fail open, and is
that the intended direction - especially anywhere auth-adjacent? If it runs twice on
the same input (retry, duplicate webhook, double-click), is the second run a no-op?
Watch for shared mutable state without locking, read-modify-write without a
transaction, TOCTOU gaps, and missed `await`.

**4. Security.** Weight this toward what the diff actually touches. Secrets or
connection strings in plaintext, including in Dockerfiles, compose files, CI workflows
and tracked `.env`-shaped files. New or changed auth logic: session handling, cookie
flags, redirect logic, permission checks at the right boundary (object-level, not just
route-level). Injection surface in anything that shells out, templates a command, or
builds a query without parameterization; SSRF via a user-controlled URL; unsafe
deserialization; path traversal. PII or secrets in new logging - flag persistent
destinations higher than debug-gated lines. Dependency and supply-chain changes: a
package-manager migration or lockfile regeneration is exactly where an unexpected
transitive dependency or a new build-script allow-list entry deserves a second look -
was each one actually necessary, or just accepted because a tool asked?

**5. Performance**, when runtime code paths changed: N+1 patterns (a loop containing a
per-iteration query or request), unbounded loops or recursion driven by user input,
loading a whole collection where pagination would do, a new cache with no TTL or
invalidation path, regex on user input with catastrophic-backtracking shape.

**6. Reuse and simplification.** Logic duplicating something already in the touched
files - but do not invent a shared abstraction the story did not ask for, especially
where the repo's conventions favor explicit repetition over premature abstraction. Dead
code, branches, config or comments this diff left behind. Magic numbers or strings it
introduced. Work it made redundant, like a step that now runs twice.

**7. Conventions.** Matches neighboring style and existing patterns rather than
introducing a new one for the same problem. Complies with the repo's convention files
as guidance rather than a literal checklist, and with the initiative's ground rules.

**8. Hallucinated references.** For every symbol the diff introduces or changes -
imports, call targets, type names, constants, environment variable keys, file paths,
routes, DB tables, columns, ORM fields, config keys - confirm it actually resolves
against this repo, not just that it reads plausibly. Specifically: unknown symbols;
wrong arity or clearly incompatible types against the resolved signature; environment
keys referenced in code but absent from every env file and not documented as
externally supplied; string paths that do not resolve under this repo's actual path
resolution; routes or handlers that do not exist; DB identifiers absent from the
schema.
