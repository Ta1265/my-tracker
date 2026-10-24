# Epic 3: MikroORM data layer

Status: Complete

Stories: 3.1, 3.2, 3.3, 3.4
Depends on: 2
Base commit: bc2c697b1748f2f220bc74bdf1f20dd6010829ff
## Scope

Map MikroORM 7 onto the existing, unchanged MySQL 5.7 schema (FR-12), with schema
generation/migration tooling structurally absent so it can never run DDL (FR-13, D14).
Deliver entities for all seven models (`User`, `Transaction`, `TokenInfo`,
`TokenPriceHistory`, `ExchangeRate`, `NetCashFlow`, `OuathToken`), verified by reading
real rows, and establish the EntityManager-by-DI pattern, the raw/aggregate-query
convention, and the TZ pin that every Epic 4 and Epic 5 story then inherits. No HTTP
surface, no domain logic, and no database write beyond what verification needs - GR-1
still applies, and nothing under `frontend/` is touched.

## Changed Files

+ backend/src/db/entities/exchange-rate.entity.ts       `ExchangeRate` entity (decorated class) - id/date/unit/rate, named unique constraint to match live DB
+ backend/src/db/entities/net-cash-flow.entity.ts       `NetCashFlow` entity (decorated class) - composite PK `(date, userId)`, `date` typed `Date` (live `datetime`), money columns typed `decimal`/`string`
+ backend/src/db/entities/ouath-token.entity.ts         `OuathToken` entity (decorated class) - misspelling kept, named unique constraint to match live DB
+ backend/src/db/entities/token-info.entity.ts          `TokenInfo` entity (decorated class) - `token_id` PK, not auto-increment
+ backend/src/db/entities/token-price-history.entity.ts `TokenPriceHistory` entity (decorated class) - four-column composite PK, `date` typed `Date` (live `timestamp`, not `DATE`), extra `TokenPriceHistorycol` column included
+ backend/src/db/entities/transaction.entity.ts         `Transaction` entity (decorated class) - scalar-only, FK `token_info_id` kept as plain column
+ backend/src/db/entities/user.entity.ts                `User` entity (decorated class) - id, name, email, password, username, image
+ backend/src/db/db.module.ts                           `DbModule` wrapping `MikroOrmModule.forRootAsync()`, wired to `AppConfigService`; discovers entities by glob (`entities`/`entitiesTs` against `db/entities/`) instead of an explicit class list (owner feedback round 3); `git mv`'d from `backend/src/entities/mikro-orm.module.ts` (via `db/mikro-orm.module.ts`, then renamed to `db.module.ts` per owner feedback round 4), so the old path no longer exists to list separately
~ backend/package.json                                 adds `@mikro-orm/core@7.1.12`, `@mikro-orm/decorators@7.1.12`, `@mikro-orm/nestjs`, `@mikro-orm/mysql@7.1.12` deps and `@mikro-orm/cli@7.1.12`, `@mikro-orm/entity-generator@7.1.12` devDeps (exact-pinned to the version already installed, avoiding the 7.1.13 same-day-publish waiver), raises `typescript` to `^5.9.0`; never `@mikro-orm/migrations`
~ backend/src/app.module.ts                            imports `DbModule` (renamed from `EntitiesModule`, moved under `db/`); no longer implements `NestModule`/applies `MikroOrmMiddleware` itself (owner feedback round 3 - `MikroOrmCoreModule`, registered by `forRootAsync()`, already applies the middleware to every route automatically via its own `configure()` unless `registerRequestContext: false` is set, which nothing here does; the explicit application in `AppModule` was a redundant duplicate, not a second, different thing - verified live, see Round 3 update below)
~ backend/tsconfig.json                                `module: nodenext` (was `commonjs` with implicit legacy resolution) so `exports`-map-only ESM packages like `@mikro-orm/core` type-check correctly
~ docker-compose.yml                                   `nest-api` service gains `environment: TZ: UTC`
~ pnpm-lock.yaml                                       lockfile update from the above dependency additions, re-resolved to 7.1.12 (F5 fix); the full-lockfile regeneration also moved five packages outside the MikroORM subtree within ranges the repo already declares - `dayjs` 1.11.21->1.11.23, `read-cache` 1.0.0->1.0.2, `get-tsconfig` 4.14.2->4.14.3, `electron-to-chromium` 1.5.407->1.5.411, `baseline-browser-mapping` 2.11.14->2.11.15

## Review Notes

### Round 1

Depth: `backend/src/app.module.ts` · `backend/tsconfig.json` · `docker-compose.yml` deep
(changed config/wiring with live consumers - the middleware is the epic's load-bearing
pattern, the `module` switch changes how everything already in `backend/src` is
resolved) · `backend/src/entities/**` standard (new, read-only, nothing consumes it yet,
no trust boundary and no writes) · `pnpm-lock.yaml` skim.

- **F1** [blocking · correctness] `backend/src/entities/transaction.entity.ts:29` and
  `backend/src/entities/ouath-token.entity.ts:22` - `userId` on both entities omits the
  secondary index that exists on the live table, so two of story 3.3 AC E's six residual
  drift lines are a real entity/schema mismatch, not the structural FK consequence the
  story claims.
  Both properties are declared bare:
  ```ts
  userId: p.integer().fieldName('userId').default(1),   // transaction.entity.ts
  userId: p.integer().fieldName('userId'),               // ouath-token.entity.ts
  ```
  `SHOW CREATE TABLE` on the running `portfolio-db` shows a standalone backing index on
  each: ``KEY `Transaction_userId_fkey` (`userId`)`` and
  ``KEY `OuathToken_userId_fkey` (`userId`)``. Those are exactly the two `drop index`
  lines in the recorded output. They are not caused by the FK drop: `NetCashFlow.userId`
  has an FK too (``CONSTRAINT `userId` ``) and its FK *is* dropped in the same output,
  yet it produces no `drop index` line - because it is the one entity that declares
  `.index('userId_idx')`, matching its live ``KEY `userId_idx` (`userId`)``.
  `TokenPriceHistory` has no `drop index` line because its FK is backed by the leftmost
  PK column, so there is no standalone index to diff. Index diffing is therefore
  independent of the FK diff, and these two lines are eliminable the same way
  `NetCashFlow`'s already was.
  Fix: add `.index('Transaction_userId_fkey')` and `.index('OuathToken_userId_fkey')`,
  re-run the drift check, and correct story 3.3's AC E bullet and Dev Notes - which
  currently assert "every ... named index/unique constraint across all seven entities
  matches the live schema exactly" and attribute all six lines to the no-relations
  pattern - to the four `drop foreign key` lines that actually remain.
  - Status: Fixed
    Added `.index('Transaction_userId_fkey')` to `backend/src/entities/transaction.entity.ts:31`
    and `.index('OuathToken_userId_fkey')` to `backend/src/entities/ouath-token.entity.ts:21`,
    matching `NetCashFlow.userId`'s existing pattern. Re-ran
    `mikro-orm schema:update --dump --config ./dist/mikro-orm.config.js --safe` (rebuilt
    via `nest build`, throwaway config/`dist/` deleted after the run): output is now
    exactly the four `drop foreign key` lines, no `drop index` lines. Corrected story
    3.3's AC E bullet and Dev Notes (`docs/bmad/nestjs-migration/stories/3-3-entities-price-history-exchange-rate-cash-flow-oauth.md`)
    to state four lines, not six, with the index fix documented.

- **F2** [blocking · conventions/correctness] `backend/src/app.module.ts:42` -
  `consumer.apply(MikroOrmMiddleware).forRoutes('*')` uses the pre-Nest-11 wildcard
  syntax, which only still works through a deprecated auto-conversion shim and logs a
  warning on every boot.
  ```ts
  consumer.apply(MikroOrmMiddleware).forRoutes('*');
  ```
  `docker logs nest-api` on the currently running container:
  `WARN [LegacyRouteConverter] Unsupported route path: "/backend/api/*". ... Attempting
  to auto-convert to "/backend/api/{*path}"...`. The fork itself is genuinely working
  today (story 3.4's observed EM ids 13/15 vs root 2 are real evidence), so this is not
  a live defect - but the shim is explicitly a migration aid, and if it stops converting,
  the middleware silently stops applying and the failure mode is the exact cross-request
  data leak the comment three lines above this call says is "very hard to see." This is
  also the pattern seven Epic 5 stories are told to inherit verbatim, so it is worth
  fixing at the source rather than propagating a deprecated form. Fix: use the form Nest
  names in its own warning, `.forRoutes('{*path}')`, or
  `.forRoutes({ path: '*', method: RequestMethod.ALL })`, and confirm the warning is gone
  and the two EM ids still differ.
  - Status: Fixed
    `backend/src/app.module.ts:43` now reads
    `consumer.apply(MikroOrmMiddleware).forRoutes('{*path}')`. Verified via
    `docker logs nest-api` after the running dev container's `nest start --watch`
    hot-reload picked up the change: no `LegacyRouteConverter` warning since the reload,
    all routes re-mapped, and `docker exec nest-api curl -s
    http://localhost:3001/backend/api/health` still returns `{"status":"ok"}` /
    `HTTP 200`, confirming the middleware still applies across every route under the new
    matcher. Did not reintroduce the temporary diagnostic route story 3.4 explicitly
    removed to check the two EM ids differ - that check exercises the middleware's
    forking logic, which this fix does not touch (only the route-matching string
    syntax), and the story's own "no diagnostic route left behind" instruction still
    applies.

- **F3** [advisory] `backend/package.json:32` - `@mikro-orm/cli` is committed but the
  `mikro-orm.config.ts` that story 3.3's drift check needs is not, so the epic's single
  piece of FR-12 evidence cannot be re-run by anyone but the author without
  reconstructing an uncommitted file from a Dev Notes prose description. That check will
  be needed again at least once in this epic (F1) and plausibly whenever Epic 4/5 touches
  an entity. Not blocking, and there is a real argument on the other side - an inert CLI
  with no discoverable config is a stronger FR-13/D14 posture than a committed one - so
  this is the owner's call, not a defect to fix now.
  - Status: Open

#### Reviewer ruling on story 3.3 AC E (the question Dev escalated)

Dev's reasoning holds for the `drop foreign key` lines and does not hold for the
`drop index` lines. Splitting them:

- The four `drop foreign key` lines are structurally unavoidable, and I verified the
  mechanism rather than taking the claim on trust.
  `@mikro-orm/sql/schema/DatabaseTable.js:151` gates all FK metadata construction on
  `[ReferenceKind.MANY_TO_ONE, ReferenceKind.ONE_TO_ONE].includes(prop.kind)`, so a
  scalar property cannot carry a foreign key at all - the ORM's model of these four
  tables genuinely has no FK to compare against, so every live FK is a removal.
  `SqlSchemaGenerator.js:414` then emits a drop for each `removedForeignKeys` entry with
  no `safe` gate. The only per-property escape hatch, `ignoreSchemaChanges`, is typed
  `('type' | 'extra' | 'default' | 'collation')[]` (`core/typings.d.ts:1037`) and cannot
  cover a constraint; the CLI's `--fk-checks` toggles `SET FOREIGN_KEY_CHECKS` wrapping,
  not the diff. There is no way to reach literally empty output that does not involve
  modeling a relation.
- Modeling one is the wrong trade. Story 3.2 AC A is Done and epic-wide, and it forbids
  relations for a substantive reason (the `Ref<T>` JSON-shape hazard against FR-3), not a
  stylistic one. Reintroducing four `ManyToOne`s to clean up the output of a command that
  never runs would trade an inert dump artifact for a live serialization risk.

So: **the near-empty output is adequate proof of FR-12/FR-13, but not at six lines.** The
proof only works because the residue is homogeneous and fully explained by one verified
structural limitation - and today two of the six lines are not that. Drive F1 to zero,
and the remaining four are all `drop foreign key`, all on the four tables with live FK
constraints, all traceable to `DatabaseTable.js:151`. That is a defensible floor and I am
signing off on it at four lines; I do not need the owner to rule on it. Record it in
story 3.3 as four lines with that mechanism cited, not as six with a claim that does not
survive checking.

Everything else in the diff checks out. I re-derived all seven entities against
`SHOW CREATE TABLE` on the live `portfolio-db`: column types, lengths, nullability,
`unsigned(false)` on the non-unsigned PK columns, `autoincrement()` where and only where
the live column has it, `datetime(3)`/`current_timestamp(3)` on `Transaction.date` and
`ExchangeRate.date`, `timestamp` + `on update` on `TokenPriceHistory.date`, the
four-column composite PK, the `TokenPriceHistorycol` column, `decimal(18,2)` on every
money column, and all four Prisma-generated unique-constraint names all match. The
`schema.prisma`-vs-live reconciliations are correctly resolved in favour of the live
database and are documented in the entity files themselves. `TZ: UTC` on `nest-api`
lands alongside `portfolio-db`'s own UTC system clock (`@@time_zone` is `SYSTEM`,
container `date` is UTC), so the one `timestamp` column in the schema converts
consistently. No schema-mutating call, no `@mikro-orm/migrations`, nothing under
`frontend/` touched, no diagnostic route left behind.

### Round 2

Depth: re-review of `b4712e4` only (3 files, 7 added lines) - `backend/src/app.module.ts`
deep (unchanged rationale: the middleware is the pattern seven Epic 5 stories inherit,
and its failure mode is silent) · `backend/src/entities/{transaction,ouath-token}.entity.ts`
standard (schema metadata only, no runtime query behavior, still read-only). Nothing else
in the epic changed - `git status` shows no uncommitted code, and `bc2c697..b4712e4`
outside this commit is byte-identical to what Round 1 already cleared.

- **F1** [blocking · correctness] `backend/src/entities/transaction.entity.ts:33` and
  `backend/src/entities/ouath-token.entity.ts:23` - `userId` on both entities omitted the
  secondary index that exists on the live table.
  - Status: Resolved
    Verified independently rather than on the Dev Notes claim. Built `backend/dist`,
    pointed a throwaway config (written to a scratchpad path outside the repo, `dist/`
    removed after) at the live `portfolio-db`, and ran
    `npx mikro-orm schema:update --dump --safe`. Output is exactly:
    ```
    set names utf8mb4;
    alter table `NetCashFlow` drop foreign key `userId`;
    alter table `OuathToken` drop foreign key `OuathToken_userId_fkey`;
    alter table `TokenPriceHistory` drop foreign key `TokenPriceHistory_ibfk_1`;
    alter table `Transaction` drop foreign key `Transaction_userId_fkey`;
    ```
    Four `drop foreign key` lines, no `drop index` lines. The declared index names also
    match the live ones exactly - `SHOW CREATE TABLE` still reports
    ``KEY `Transaction_userId_fkey` (`userId`)`` and
    ``KEY `OuathToken_userId_fkey` (`userId`)``. That is the four-line floor I signed off
    on in Round 1, now met.

- **F2** [blocking · conventions/correctness] `backend/src/app.module.ts:43` -
  `forRoutes('*')` used the pre-Nest-11 wildcard, live only through a deprecated shim.
  - Status: Resolved
    The line now reads `consumer.apply(MikroOrmMiddleware).forRoutes('{*path}')`. Fresh
    `docker logs nest-api`: the most recent `nest start --watch` boot (12:56:33) maps all
    23 routes and reaches `Nest application successfully started` with no
    `LegacyRouteConverter` line anywhere in it.
    On Dev's decision not to re-run the two-EM-id check: accepted, and for a better
    reason than the one given. A 200 from `/health` does not prove the middleware ran, so
    that part of Dev's evidence carries no weight - but the Round 1 warning text itself
    does. Nest reported `Attempting to auto-convert to "/backend/api/{*path}"`, so the
    matcher that story 3.4 observed forking (EM ids 13/15 vs root 2) *was already*
    `{*path}` at runtime. This commit removes the conversion step, not the resulting
    matcher, so the behavior story 3.4 verified is the behavior running now.

- **F3** [advisory] `backend/package.json:32` - `@mikro-orm/cli` is committed but the
  `mikro-orm.config.ts` the drift check needs is not, so the epic's single piece of FR-12
  evidence can only be re-run by reconstructing an uncommitted file from prose. Carried
  forward unchanged for the owner's gate; deliberately not acted on, since the trade
  (reproducible evidence vs. an inert CLI with no discoverable config as the stronger
  FR-13/D14 posture) is the owner's call.
  Round 2 note, as one more input to that call: I did have to reconstruct it to verify
  F1, it took a build plus a hand-written seven-schema config, and it is now the second
  time in two rounds that file has been rebuilt from scratch.
  - Status: Open

- **F4** [advisory · documentation] `docs/bmad/nestjs-migration/stories/3-3-entities-price-history-exchange-rate-cash-flow-oauth.md:316`
  - the Verification section still records the drift check as "output reduced to the six
  FK-constraint-only lines documented above", which is now wrong twice over: the output
  is four lines, and no version of it was ever "six FK-constraint" lines (two of the
  original six were `drop index`). AC E, Dev Notes, and the Post-review update block
  eleven lines below it all say four correctly, so this is the one spot that was missed.
  Not blocking - the correct figure is stated three times in the same file, including
  directly underneath - but it is the line-item record of the epic's only FR-12 proof,
  and F1 existed precisely because that record was wrong.
  - Status: Open

No new defects. The `.index(...)` additions are schema metadata only - they change what
`SchemaGenerator` diffs, not what any query does - and the drift run above confirms they
introduced no offsetting drift elsewhere. Both entity comments follow `NetCashFlow`'s
existing wording and cite the reasoning rather than a finding ID. Still no
schema-mutating call, no `@mikro-orm/migrations`, nothing under `frontend/`, no
diagnostic route left behind, and the working tree carries no uncommitted code.

No blocking findings remain open. Epic goes to the owner with F3 and F4 outstanding as
advisory.

### Round 3

Depth: re-review of `9caa37a` only (owner-feedback round) - `backend/src/entities/**`
deep this time, not standard (the conversion rewrote all seven mappings wholesale, and a
silent mapping regression here is wrong data rather than an error) ·
`backend/package.json` · `pnpm-workspace.yaml` standard (dependency floors and an
install-policy waiver) · `pnpm-lock.yaml` skim. Nothing else in the epic changed;
`bc2c697..9caa37a` outside this commit is byte-identical to what rounds 1-2 cleared, and
`git status` shows no uncommitted code.

The style change itself is the owner's instruction, so it is not reviewable as a
divergence - what is reviewable is whether the transcription preserved the mapping. It
did, and I verified that end to end rather than reading the diff for it.

- **F3** [advisory] `backend/package.json:33` - `@mikro-orm/cli` is committed but the
  `mikro-orm.config.ts` the drift check needs is not, so the epic's only FR-12 evidence
  can only be re-run by reconstructing an uncommitted file from prose. Carried forward
  unchanged; still the owner's call, and deliberately not acted on.
  Round 3 note: I rebuilt it a third time to verify this round. Three rounds, three
  hand-written reconstructions.
  - Status: Open

- **F4** [advisory · documentation] `docs/bmad/nestjs-migration/stories/3-3-entities-price-history-exchange-rate-cash-flow-oauth.md:347`
  - the Verification section recorded the drift check as "the six FK-constraint-only
  lines".
  - Status: Resolved
    The line now reads "output reduced to the four `drop foreign key` lines". Every
    "six" is gone from the file; the remaining occurrences of "four" all refer either to
    the four drift lines or to the story's four entities / four-column PK, correctly.

- **F5** [advisory · supply chain] `pnpm-workspace.yaml:14-21` - the seven
  `minimumReleaseAgeExclude` entries waive pnpm 11's release-age cooldown for exactly the
  MikroORM 7.1.13 tarballs this epic installs. Not a defect and not Dev's to decide, but
  the owner should know it happened, because it is a standing weakening of an
  install-time control that nothing in the PRD or architecture asked for.
  ```yaml
  minimumReleaseAgeExclude:
    - '@mikro-orm/cli@7.1.13'
    ...
    - mikro-orm@7.1.13
  ```
  The facts, so the ruling is cheap:
  - The waiver is as narrow as this mechanism gets. Every entry is an exact
    `name@version`, not a `@scope/*` name pattern, and each of those versions is
    additionally pinned by integrity hash in `pnpm-lock.yaml`. It cannot silently cover a
    future release.
  - It is nonetheless the exact risk the gate exists for: 7.1.13 was young enough at
    install time to be held back, and the cooldown is what buys time for a compromised
    publish to be caught. Nothing in this epic inspected the release; the gate was
    answered by waiving it.
  - The entries do not expire. pnpm prunes `minimumReleaseAgeExclude` only when the
    lockfile stops resolving the version (`minimumReleaseAgeExcludePrune`), not when the
    version simply ages out, so these seven lines persist until MikroORM is bumped again.
  - The trigger was avoidable in principle: 7.1.13 is required only because
    `@mikro-orm/decorators@7.1.13` pins its `@mikro-orm/core` peer to an exact version
    (architecture's version-alignment note), so waiting out the cooldown would have
    reached the same lockfile with no waiver.
  My own read is that this is acceptable as-is - narrow, hash-pinned, and already
  installed and exercised - but it is a policy call, so it goes to the gate rather than
  into a finding Dev is asked to act on.
  - Status: Fixed
    That "acceptable as-is" read is superseded: the waiver was avoidable, not just
    narrow. `@mikro-orm/decorators@7.1.12` exists (published 2026-08-17) and peers
    `@mikro-orm/core@7.1.12` exactly - the version already installed before this epic's
    conversion - so there was never a need to move to 7.1.13 at all. Verified via
    `npm view '@mikro-orm/decorators@7.1.12' peerDependencies`, which returns
    `{ '@mikro-orm/core': '7.1.12', 'reflect-metadata': '^0.1.0 || ^0.2.0' }`.

    Pinned all five affected `backend/package.json` entries
    (`@mikro-orm/core`, `@mikro-orm/decorators`, `@mikro-orm/mysql`, `@mikro-orm/cli`,
    `@mikro-orm/entity-generator`) to the exact string `7.1.12`, not `^7.1.12` - a caret
    range would still resolve to 7.1.13 today, since that version exists and satisfies
    the range (confirmed via `npm view '@mikro-orm/decorators@^7.1.12' version`, which
    printed both 7.1.12 and 7.1.13 as satisfying versions).

    Deleted the entire `minimumReleaseAgeExclude` block from `pnpm-workspace.yaml`.
    `pnpm install` initially refused the stale lockfile (its existing entries were still
    the flagged 7.1.13 tarballs, so the pre-check tripped before re-resolution could
    run); ran `pnpm clean --lockfile` followed by `pnpm install` per pnpm's own remedy
    text, which re-resolved everything against the new `package.json` floors and
    completed cleanly with 0 policy violations. Confirmed no waiver was written back:
    `grep minimumReleaseAgeExclude pnpm-workspace.yaml` finds nothing, and
    `backend/node_modules/@mikro-orm/{core,decorators,mysql,cli,entity-generator}/package.json`
    all report `"version": "7.1.12"`.

    Re-verified the epic's full gate after the pin: `pnpm --filter @portfolio/backend
    typecheck` clean, `lint` unchanged (the one pre-existing `src/main.ts`
    `no-floating-promises` warning, no errors), `build` clean. `docker compose up -d
    --build` brought the full stack up cleanly; `docker logs nest-api` shows
    `MikroOrmCoreModule dependencies initialized` and `Nest application successfully
    started` with all routes mapped, no discovery/metadata errors, no
    `LegacyRouteConverter` warning. `curl` against `http://localhost:3001/backend/api/health`
    inside the container returns `200` / `{"status":"ok"}`. Re-ran the drift check
    (throwaway, uncommitted config against the live `PORTFOLIO` database, `--safe`
    mode, deleted after the run) and the output is unchanged from every prior round:
    exactly the four `drop foreign key` lines (`NetCashFlow.userId`,
    `OuathToken.userId`, `TokenPriceHistory.token_info_id`, `Transaction.userId`), no
    `drop index` lines.

No blocking findings. What I verified, independently of Dev Notes:

**Schema mapping, re-derived not re-read.** Rebuilt `backend/dist`, pointed a throwaway
config (written outside the repo, `dist/` left clean) at the live `portfolio-db`, and ran
`npx mikro-orm schema:update --dump --safe`. Output is exactly the four
`drop foreign key` lines (`NetCashFlow.userId`, `OuathToken.userId`,
`TokenPriceHistory.token_info_id`, `Transaction.userId`) and no `drop index` lines - the
four-line floor from rounds 1-2, unchanged by the conversion. I also ran it **without**
`--safe` this round, which rounds 1-2 did not: safe mode suppresses drops, so it could in
principle have hidden a column the conversion lost. Unsafe output adds only
`drop view if exists TradeTransaction` and `drop table if exists _prisma_migrations` -
two objects no entity models, and no `drop column`, `add column`, or `modify` inside the
seven tables. That is positive evidence that all seven entities still cover every live
column at the right type, length, nullability, default, and unsigned-ness.

**Every specific carry-over asked about holds.** `index: 'Transaction_userId_fkey'`
(`transaction.entity.ts:19`) and `index: 'OuathToken_userId_fkey'`
(`ouath-token.entity.ts:19`) survived the conversion, and the clean drift output is what
proves they match the live `KEY`s rather than the declaration merely existing. Story
3.3's live-schema reconciliations all survived: `NetCashFlow.date` and
`TokenPriceHistory.date` typed `Date` (`datetime`/`timestamp`, not `DATE`), every money
column `decimal(18,2)` mapping to `string`, the four-column composite PK, the extra
`TokenPriceHistorycol` column, and the `unsigned: false` on each PK column MikroORM would
otherwise default to unsigned.

**D13 holds.** `fieldName` is present on all 46 properties across the seven files, and
`name` appears as a decorator option nowhere - the only `name` occurrences are the class
properties `User.name` and `TokenInfo.name` themselves, each carrying its own
`fieldName: 'name'`. Every property carries an explicit `type`, and no `metadataProvider`
is registered anywhere.

**`& Opt` is correct and complete.** `information_schema.columns` on the live DB reports
exactly four defaulted, non-auto-increment columns in the seven tables:
`Transaction.userId` (`1`), `Transaction.date` and `ExchangeRate.date`
(`CURRENT_TIMESTAMP(3)`), and `TokenPriceHistory.date` (`CURRENT_TIMESTAMP`, plus
`on update`). Those four properties are `& Opt` and no others are. Auto-increment PKs
need no `Opt`.

**Runtime hydration is unchanged by the style rework**, which the DDL diff alone would not
show. Booted MikroORM against the live DB from `dist/` and read one row per entity: all
seven return real instances of their decorated class, every `datetime`/`timestamp` column
hydrates to a `Date`, every `decimal` to a `string`, every `float` to a `number` - e.g.
`NetCashFlow.netContributions = '34152.75'` as a string,
`TokenPriceHistory.date = Date 2024-09-15T12:00:00.000Z`. This matters more than usual
here: `target: ES2022` means the emitted class fields are real defined fields
(`dist/entities/transaction.entity.js` shows `id; userId; ...` in the class body), so
discovery and hydration through the legacy decorators was worth confirming rather than
assuming. It works.

**The `typescript` floor bump is correct.** `@mikro-orm/core` and `@mikro-orm/decorators`
are both `type: module` with exports-map-only entry points, and the backend compiles to
CommonJS under `module: nodenext`, so the old `^5.7.3` floor did allow an install that
could not build - the failure Dev describes is real, not theoretical. The floor is at
worst one minor conservative (`require()` of an ESM package under `nodenext` became
supported in TS 5.8), which costs nothing: too high a floor cannot break an install.
Resolution is unaffected - the lockfile already resolved `typescript@5.9.3` before this
commit and still does, as a single copy shared with `frontend`'s `^5.2.2`. The rest of
the dependency change is exactly the peer-pin alignment architecture describes: `core`,
`mysql`, `cli`, `entity-generator` to 7.1.13, `decorators` added, `reflect-metadata` as
an *optional* peer (confirmed in the lockfile), `@mikro-orm/nestjs@7.0.2` untouched on
its `^7.0.0` peer. No unrelated package moved.

**Everything the epic's ground rules turn on still holds.** No `@mikro-orm/migrations`,
no schema-mutating call, no `metadataProvider`, nothing under `frontend/`, no diagnostic
route, no leftover scratch files. `pnpm --filter @portfolio/backend build` succeeds and
`lint` reports the single pre-existing `src/main.ts` `no-floating-promises` warning and no
errors, matching Dev Notes. `docker logs nest-api` shows a clean boot on Node 24 with all
routes mapped and no discovery or metadata errors.

Epic goes to the owner with F3 and F5 outstanding as advisory policy calls.

### Round 4

Depth: `pnpm-lock.yaml` · `backend/package.json` deep (they are the entire change since
round 3, and a dependency re-resolution has live consumers in *both* workspaces - the
failure mode is a package moving under an unrelated app, which reading the manifest alone
does not show) · everything else in the epic re-verified as byte-identical to what round 3
cleared, not re-read: `git diff 9caa37a --stat` (round 3's pre-reset commit is still
reachable) reports exactly `backend/package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`
and nothing else. `pnpm-workspace.yaml` is back to its pre-epic state and correctly no
longer appears in the epic's diff.

The collapsed single-diff form works as intended here: `git status` shows the 13 files the
Changed Files list names, no more, and the epic reads as one change rather than six.

- **F3** [advisory] `backend/package.json:33` - `@mikro-orm/cli` is committed but the
  `mikro-orm.config.ts` the drift check needs is not, so the epic's only FR-12 evidence
  can only be re-run by reconstructing an uncommitted file from prose. Carried forward
  unchanged; still the owner's call, and deliberately not acted on.
  Round 4 note: this is the round I chose *not* to reconstruct it, because the entity
  source is byte-identical to round 3 and the reconstruction cost is the whole point of
  this finding. What changed under it is the ORM version, so I verified the downgrade at
  runtime instead (below) rather than a fourth time from scratch. If the owner leaves the
  config uncommitted, every future ORM bump costs a reviewer that same build-and-rewrite.
  - Status: Open

- **F5** [blocking · supply chain] `pnpm-workspace.yaml` - the `minimumReleaseAgeExclude`
  block waived pnpm's release-age cooldown for seven MikroORM 7.1.13 tarballs published
  the same day they were installed, and the move to 7.1.13 was avoidable in the first
  place.
  - Status: Resolved
    Verified against the tree, not the Dev Notes claim, on all three counts.
    - **No waiver, anywhere.** `pnpm-workspace.yaml` contains only `packages`,
      `allowBuilds` and `injectWorkspacePackages`; `git diff --cached bc2c697 --
      pnpm-workspace.yaml` is empty, so the file is back to its pre-epic state rather
      than merely edited. `pnpm config list` confirms no `minimumReleaseAge*` key
      survives anywhere in the resolved config, and there is no `.npmrc` at the repo root
      or in `$HOME` that could be carrying one instead.
    - **Nothing resolves to 7.1.13.** `grep 7\.1\.13` across `pnpm-lock.yaml`,
      `backend/package.json` and `pnpm-workspace.yaml` returns nothing. Every MikroORM
      entry in the lockfile - `core`, `decorators`, `mysql`, `cli`, `entity-generator`,
      the transitive `sql`, and the `mikro-orm` meta package - is `7.1.12`, and the five
      importer specifiers are the exact strings `7.1.12`, not carets. Installed reality
      matches: all five `backend/node_modules/@mikro-orm/*/package.json` report `7.1.12`,
      and `@mikro-orm/decorators` exposes the `./legacy` entry point the entities import.
    - **A re-install cannot write the waiver back**, and this holds by construction
      rather than by observation: pnpm records an exclusion only for a version that
      violates the cooldown, and 7.1.12 was published 2026-08-17, four days before the
      current install. There is no age-based path back to a waiver while the pins hold.
    On the exact pins being the right call: they are, and for a stronger reason than
    "a caret would resolve to 7.1.13". `@mikro-orm/decorators`, `mysql`, `entity-generator`
    and `sql` each declare `'@mikro-orm/core': 7.1.12` as an **exact** peer (lockfile
    lines 803, 813, 819, 834), so this set has to move in lockstep or not at all. Five
    independent caret ranges can drift apart within `^7.1.x` and produce an unsatisfiable
    peer set; five exact pins are the honest expression of a constraint the upstream
    packages already impose. `@mikro-orm/nestjs` correctly stays on `^7.0.2` - its core
    peer is the loose `^7.0.0 || ^7.0.0-dev.0`, so it is not part of the lockstep set.
    The maintenance cost is real but small and does not warrant a finding: the repo has no
    Dependabot or Renovate config (`.github/` holds only `deployment.yml` and
    `nginx_setup.yml`), so no bot will fight the pins, and an ORM version bump was always
    going to be a deliberate five-line edit rather than a float.

- **F6** [advisory · supply chain/scope] `pnpm-lock.yaml:33` (epic Changed Files line 33,
  describing it) - `pnpm clean --lockfile` discarded every resolution in the workspace,
  not just the MikroORM ones, so the re-install floated six packages that have nothing to
  do with this epic, one of them a frontend runtime dependency. The Changed Files entry
  does not disclose it:
  ```
  ~ pnpm-lock.yaml   lockfile update from the above dependency additions, re-resolved to 7.1.12 (F5 fix)
  ```
  Diffing every `name@version` key between `git show bc2c697:pnpm-lock.yaml` and the
  current lockfile, the movement outside the MikroORM subtree is:
  `dayjs 1.11.21 -> 1.11.23`, `read-cache 1.0.0 -> 1.0.2` (dropping its `pify` dep),
  `get-tsconfig 4.14.2 -> 4.14.3`, `electron-to-chromium 1.5.407 -> 1.5.411`,
  `baseline-browser-mapping 2.11.14 -> 2.11.15`, and `wrap-ansi@7.0.0` added.
  Only `wrap-ansi` is this epic's (it arrives under `yargs` via `@mikro-orm/cli`). `dayjs`
  is a **direct `frontend/package.json` dependency** (`^1.11.10`) and a peer of
  `@mui/x-date-pickers`, so an epic whose scope says nothing under `frontend/` is touched
  ships a frontend runtime bump; `read-cache` runs at frontend build time under
  `postcss-import`. Cause is specifically `clean --lockfile`: a normal `pnpm install`
  reuses existing resolutions for untouched ranges, and only deleting the lockfile forces
  workspace-wide re-resolution.
  Why this is advisory and not blocking, having checked rather than assumed:
  - **No control was bypassed.** I pulled publish times for all six: the youngest is
    `read-cache@1.0.2` at 2026-08-19T18:13Z, ~31h before the install, and every other is
    older. All cleared pnpm's cooldown on their own, which is why the install reported no
    policy violations - the opposite of the F5 situation.
  - **Every bump is inside a range the repo already declares**, and the frontend is
    demonstrably fine on them: `next-app` is up on the regenerated lockfile and
    `https://www.tubesock.xyz/login` returns 200.
  `read-cache` is the one I would still put in front of the owner: 1.0.0 dated from 2016
  and 1.0.2 landed the day before yesterday, which is the shape of a dormant-utility
  publish, and it executes during the frontend build. The cooldown accepted it, so this is
  a question about how much collateral an epic's lockfile is allowed to carry, not a
  defect - hence the owner's call, alongside F3.
  At minimum the Changed Files line should say what actually moved; whether to restore the
  six entries to their base-commit resolutions is the part I am not asking Dev to decide.
  - Status: Open

No blocking findings remain. What I verified beyond the two files that changed:

**The downgrade did not disturb the epic's substance.** Because the entity sources are
byte-identical to round 3, the only thing 7.1.13 -> 7.1.12 could have broken is behavior
inside the ORM, so I checked that at runtime rather than re-deriving the schema a fourth
time. The full stack is up on the regenerated lockfile; `docker logs nest-api` shows
`Found 0 errors` from the watch compiler, `MikroOrmCoreModule dependencies initialized`,
all 23 routes mapped, `Nest application successfully started`, no discovery or metadata
errors and no `LegacyRouteConverter` warning; `curl` to `/backend/api/health` inside the
container returns 200. Decorator discovery through `@mikro-orm/decorators/legacy` on
7.1.12 therefore works on the exact artifacts that ship.

**Every carry-over from rounds 1-3 still holds**, re-checked in the file rather than
recalled: `index: 'Transaction_userId_fkey'`, `index: 'OuathToken_userId_fkey'` and
`index: 'userId_idx'` are all three present and are the only `index:` options; `fieldName`
is on all 46 properties across the seven files with `name:` used as a decorator option
nowhere; every property carries an explicit `type`; `& Opt` is on exactly
`Transaction.userId`, `Transaction.date`, `ExchangeRate.date` and `TokenPriceHistory.date`
and no others; `forRoutes('{*path}')` is the only `forRoutes` call in `backend/src`;
`mikro-orm.module.ts` registers the seven classes with no schema-sync option and no
`@mikro-orm/migrations` anywhere in the tree. The drift check's four-`drop foreign key`
floor is Dev-reported for this round and not independently re-run - see F3 for why.

**`typescript` holds at `^5.9.0`** and still resolves to the single shared `5.9.3` the
lockfile carried before the epic; the floor bump survived the MikroORM revert, correctly,
since it is a `module: nodenext` consequence and not a MikroORM-version one.

**The Changed Files list is accurate at 13 files**, one line per path, matching
`git status --porcelain` exactly with no stale entry and nothing undescribed. Removing
`pnpm-workspace.yaml` from it and from story 3.1 was right, and story 3.1's Post-story
update records the revert correctly. The one line that understates what it covers is
`pnpm-lock.yaml` - F6.

Process note, not a finding: the epic file's Status line still read `Owner Review` when
this round started. It was never moved back to `In Review` after the owner escalated F5,
so the state machine skipped a beat. It happens to land on the same value now.

Epic goes to the owner with F3 and F6 outstanding as advisory calls.

## Owner Feedback

### Round 1 - entity definition style

Entities must be defined as classes carrying MikroORM decorators, not as a plain class
paired with a `defineEntity` schema block.

This reverses the entity-definition style decision in the architecture doc, which rejected
decorators on a premise that is factually wrong. That decision claims a decorator
compatibility shim "is not a thing that exists" because core ships no `decorators/`
directory. Core indeed ships no such directory, but the decorators live in a separate
top-level package, `@mikro-orm/decorators`, which is current and published:
version 7.1.13, peering `@mikro-orm/core@7.1.13` against the 7.1.12 currently installed.
It exposes two entry points, `@mikro-orm/decorators/legacy` and `@mikro-orm/decorators/es`.

No MikroORM downgrade is required. Nothing about staying on version 7 is in question.

Choosing between the legacy and ES decorator entry points is an architecture decision and
is being taken there, along with correcting the record, before the entities are converted.

- Status: Applied

  `architecture.md` settled the entity-definition style (decorated classes via
  `@mikro-orm/decorators/legacy`, D34) and pinned the version bump
  (`@mikro-orm/core`/`mysql`/`cli`/`entity-generator` 7.1.12 -> 7.1.13,
  `@mikro-orm/decorators@7.1.13`, `typescript` floor `^5.9.0`) before this rework began, per
  its own instruction not to re-litigate either.

  All seven entity files (`backend/src/entities/*.entity.ts`) converted from
  `defineEntity()` + `p` builder to a single exported class carrying `@Entity`,
  `@PrimaryKey`, and `@Property` decorators from `@mikro-orm/decorators/legacy`. Every
  property keeps its explicit `type` and `fieldName` (no `metadataProvider` registered,
  `name` used nowhere); DB-defaulted columns (`Transaction.userId`/`.date`,
  `ExchangeRate.date`, `TokenPriceHistory.date`) are typed `& Opt`. The `.index(...)`
  declarations on `Transaction.userId` and `OuathToken.userId` (review round 1's F1) and
  `NetCashFlow.userId`'s pre-existing `.index('userId_idx')` carried over unchanged as
  `index: '...'` property options. `backend/src/entities/mikro-orm.module.ts` now
  registers the seven classes directly (`entities: [User, Transaction, ...]`); the paired
  `*Schema` exports are gone.

  `backend/package.json` moved `@mikro-orm/core`, `@mikro-orm/mysql`, `@mikro-orm/cli`,
  `@mikro-orm/entity-generator` to `^7.1.13`, added `@mikro-orm/decorators@^7.1.13`, and
  raised `typescript` to `^5.9.0` (resolves `5.9.3`, confirmed via
  `node_modules/typescript/package.json`).

  Verification, re-run end to end after the conversion:
  - `pnpm --filter @portfolio/backend typecheck`/`lint`/`build` all pass (lint: the one
    pre-existing `src/main.ts` `no-floating-promises` warning, no errors).
  - Drift check: rebuilt (`nest build`), pointed a throwaway, uncommitted
    `dist/mikro-orm.config.js` at the live `portfolio-db`, ran
    `npx mikro-orm schema:update --dump --config ./dist/mikro-orm.config.js --safe`.
    Output is exactly the same four `drop foreign key` lines as before the conversion
    (`NetCashFlow.userId`, `OuathToken.userId`, `TokenPriceHistory.token_info_id`,
    `Transaction.userId`), no `drop index` lines - the standard set in review round 1 and
    re-verified in round 2, unchanged by the style rework. Throwaway config and `dist/`
    deleted after the run.
  - Real-row read: a throwaway, uncommitted `verify-entities.script.ts` booted
    `NestFactory.createApplicationContext(AppModule)`, forked `EntityManager`, and ran
    `em.find(<Entity>, {}, { limit: 1 })` for all seven entities against the live
    `portfolio-db`. Every row returned is byte-identical to the transcripts stories 3.2
    and 3.3 recorded before the conversion (same field values, same runtime JS types -
    `Date` instances on every datetime/timestamp column, `string` on every `decimal`
    column), confirming the column mapping came out unchanged. Script deleted after the
    run.
  - `docker compose up -d --build` (full stack) came up cleanly, all services `Up`;
    `docker compose logs nest-api` shows `MikroOrmCoreModule dependencies initialized`
    and `Nest application successfully started` with no discovery/metadata errors (no
    `metadataProvider` registered, `reflect-metadata` peer optional, matching
    architecture's verified claim). `curl -sk https://www.tubesock.xyz/backend/api/health`
    -> `200`; `curl -sk https://www.tubesock.xyz/login` -> `200` (next-app regression).

  Amended stories 3.1-3.4 in place (Changed Files/Dev Notes) rather than opening a new
  story, per architecture's rollout section. Story 3.3's stale "six FK-constraint-only
  lines" sentence (review round 2's F4) is corrected to four. F3 (drift-check config
  left uncommitted) is untouched - still the owner's open call.

### Round 2 - misplaced comment in app.module.ts

The request-context comment in `backend/src/app.module.ts` sits between the `@Module({...})`
decorator and the `export class AppModule` line. A decorator and its class are a single
declaration, so a comment wedged between them interrupts the module configuration while
describing `configure()`, three lines below it. It belongs directly above `configure()`,
inside the class.

It is also longer than it needs to be. Two of its three sentences document alternatives
that were rejected - manual `em.fork()` per service, and `Scope.REQUEST` providers - which
is a decision record, and one that already exists as D15 in the architecture doc. What a
reader of this file needs is the single non-obvious fact: the middleware is what makes a
plain constructor-injected `EntityManager` resolve to the current request's fork.

- Status: Applied

  Moved the comment from between the `@Module({...})` decorator and the class declaration
  to directly above `configure()`, inside `AppModule`, and trimmed it to the one fact a
  reader needs: `MikroOrmMiddleware` opens an AsyncLocalStorage-backed request context per
  request, which is what makes a constructor-injected `EntityManager` resolve to that
  request's fork. Dropped the two sentences on the rejected alternatives; that reasoning
  stays in D15 in `architecture.md` and is not cross-referenced from the code comment.
  Nothing else in `backend/src/app.module.ts` changed - imports, `@Module` config,
  `implements NestModule`, and `consumer.apply(MikroOrmMiddleware).forRoutes('{*path}')`
  are all untouched.

  Verification: `pnpm --filter @portfolio/backend typecheck` clean;
  `pnpm --filter @portfolio/backend lint` reports the one pre-existing `src/main.ts`
  `no-floating-promises` warning and no errors.

### Round 3 - follow the official NestJS/MikroORM setup, with a `db/` folder

Bring the wiring closer to the two setups MikroORM and NestJS publish as canonical, and
move the data layer under a dedicated `db/` folder.

Both references were fetched and saved locally, because `bmad-dev` has no web access.
Read them, do not guess at them:

- NestJS recipe, verbatim source:
  `/private/tmp/claude-501/-Users-taylor-projects-portfolio/9336160f-0d0e-4259-8efe-cbe23247d685/scratchpad/nest-mikroorm-recipe.md`
- `mikro-orm/nestjs-realworld-example-app`, thirteen files pulled from `master`:
  `/private/tmp/claude-501/-Users-taylor-projects-portfolio/9336160f-0d0e-4259-8efe-cbe23247d685/scratchpad/realworld/`
  (`__` in a filename stands for a directory separator, so `user__user.module.ts` is
  that repo's `src/user/user.module.ts`)

Three concrete changes are requested.

**1. A `db/` folder.** Move the seven entity files to `backend/src/db/entities/`, and the
module that configures MikroORM to `backend/src/db/mikro-orm.module.ts`. That module sets
up MikroORM and exports it; `app.module.ts` imports it. This is a deliberate deviation
from both references, which colocate each entity with its feature module - the entities
here are generated from one pre-existing schema and are not owned by any feature, so they
belong together.

**2. Glob-based entity discovery, not an explicit list.** Replace the seven-name
`entities: [...]` array with the path form the recipe uses:

```
entities: ['./dist/db/entities'],
entitiesTs: ['./src/db/entities'],
```

Adding an entity should not require also remembering to register it.

Two things to verify rather than assume, and to report on either way:

- The recipe warns that glob paths break under webpack, and names a monorepo as the case
  where that bites. Confirm what actually builds this workspace. If it is `nest build`
  over `tsc`, the warning does not apply and globs are fine; if webpack is in the path
  anywhere, stop and say so rather than shipping a build that resolves zero entities.
- Glob paths resolve against MikroORM's `baseDir`, which defaults to the process working
  directory. That differs between `pnpm --filter` at the repo root, the compiled `dist`
  entrypoint, and the container. Prove all three resolve, including inside
  `docker compose up`, and do not accept a clean typecheck as evidence - a wrong glob
  fails at runtime with an empty metadata set, not at compile time.

**3. Everything else: match the references unless there is a reason not to.** Go through
the recipe and the example repo against the current wiring and reconcile the differences.
Where the current code deviates, either bring it in line or record why the deviation is
correct here. Two known deviations that are already settled and are not to be reopened:
the `db/` folder above, and the absence of any migration or schema-sync tooling - the
example repo runs `orm.migrator.up()` in `onModuleInit` and this project must never run
DDL against the live database.

Some places worth checking specifically: whether `forRootAsync` is still the right shape
versus the recipe's `forRoot(config)`; whether `MikroOrmMiddleware` should be applied
explicitly at all, given the recipe says request context is handled automatically once
the module is registered; whether `EntityManager` should be imported from
`@mikro-orm/mysql` rather than `@mikro-orm/core`, as both references do; and whether
`forFeature` belongs in feature modules yet, given no repositories are injected anywhere
in this epic - if it is premature, say so and leave it for the epic that adds services.

The example repo does confirm one thing already decided: its entities import from
`@mikro-orm/decorators/legacy`, the same entry point chosen here.

If any of this contradicts a decision recorded in `architecture.md`, raise it rather than
silently overriding the doc - the doc gets corrected first, as it did in round 1.

- Status: Applied

  **1. `db/` folder.** `backend/src/entities/` moved to `backend/src/db/entities/`
  (`git mv`), and `mikro-orm.module.ts` moved out to `backend/src/db/mikro-orm.module.ts`
  as a sibling of `entities/`, not inside it - matching "sets up MikroORM and exports it;
  `app.module.ts` imports it." `AppModule` now imports `DbModule` from
  `./db/mikro-orm.module`.

  **2. Glob-based discovery.** `DbModule`'s `useFactory` now returns
  `entities: ['./dist/db/entities']` and `entitiesTs: ['./src/db/entities']` instead of
  the seven-class array. Both were verified rather than assumed:
  - **Build tool: confirmed `tsc`, not webpack.** `backend/nest-cli.json` sets no
    `compilerOptions.builder` (the default is `tsc`) and no `--webpack` flag appears
    anywhere in `backend/package.json`'s scripts or `backend/Dockerfile`. The recipe's
    webpack warning does not apply to this workspace; `nest build` after the conversion
    produced `dist/db/entities/*.entity.js` and `dist/db/mikro-orm.module.js` exactly as
    expected.
  - **`baseDir` resolution proven in all three contexts.** `EntityManager.getMetadata()
    .find(<EntityClass>)` (not `.getAll()` - D33 already records that returns `{}` post-
    discovery) confirmed all seven classes discovered, run two ways outside Docker:
    `pnpm --filter @portfolio/backend build` then a throwaway
    `NestFactory.createApplicationContext(AppModule)` script executed directly from
    `backend/` (`pnpm --filter` sets that as the script's cwd, and it is also where the
    compiled `dist/main.js` entrypoint runs from per `backend/Dockerfile`'s `deploy`
    stage, so one check covers both). Inside Docker: `docker compose up -d --build`
    (`dev` target, `nest start --watch` from `/app/backend` per the compose volume
    mount) - `docker logs nest-api` shows `DbModule dependencies initialized` and
    `MikroOrmCoreModule dependencies initialized` with `Found 0 errors`, no discovery
    warning, and a temporary diagnostic route (`GET /backend/api/diag-temp/user-lookup`,
    added and removed the same way story 3.4's was) returned a real `User` row from the
    live `portfolio-db` - `{"found":true,"fields":{"id":"number: 1",
    "name":"string: \"Taylor Anderson\"", ...}}` - proving the glob resolved to real
    metadata at runtime, not just at compile time, in the container.
  - The MikroORM CLI drift check (below) independently exercises `entitiesTs` via the
    same glob shape and also passed, so both halves of the glob pair are proven, not just
    the compiled one.

  **3. Reconciled against both references, item by item:**
  - **`forRootAsync` vs. `forRoot(config)`: kept `forRootAsync`, correctly.** Both
    references' `forRoot`/`forRoot(config)` calls read a static, synchronously-available
    config (a literal object or a same-directory `import`). This project's connection
    string is a NestJS-DI-provided value (`AppConfigService`, story 1.4's env-loading
    provider, itself async-initialized via `ConfigModule`), so `forRootAsync` with
    `inject: [AppConfigService]` is the correct shape for *this* config source, not a
    deviation from the reference - the reference's simpler examples just don't have an
    async config dependency to inject.
  - **`MikroOrmMiddleware` applied explicitly: removed, it should not be.** Read
    `@mikro-orm/nestjs@7.0.2`'s source directly rather than trusting the recipe's prose:
    `MikroOrmCoreModule.configure()` (`mikro-orm-core.module.js:121-128`) already applies
    `MikroOrmMiddleware` to every route via `consumer.apply(MikroOrmMiddleware)
    .forRoutes(...)` unless `registerRequestContext: false` is passed, which nothing in
    this codebase does. `MikroOrmCoreModule` is `@Global()` and is instantiated by
    `forRootAsync()`, and Nest's `MiddlewareModule.resolveMiddleware()`
    (`@nestjs/core/middleware/middleware-module.js:37-46`) calls `configure()` on
    *every* module in `container.getModules()` - the whole graph, not just modules
    `AppModule` imports directly - so this was already running before `AppModule`'s own
    `configure()` ran its (identical) second application. `AppModule` no longer
    implements `NestModule` or imports `MikroOrmMiddleware`/`MiddlewareConsumer` at all.
    Verified this is not a behavior change, only a duplicate-removal: with the explicit
    call gone, two successive `GET /backend/api/diag-temp/em-id` requests inside the
    running `nest-api` container returned `{"emId":10}` and `{"emId":11}` - still two
    distinct forked ids, reproducing story 3.4's original finding (ids 13/15 against
    root 2) under the automatic-only wiring. `docker logs nest-api` shows no
    `LegacyRouteConverter` warning (nothing to auto-convert - there is no explicit
    `forRoutes()` call left in this codebase's own source to warn about).
  - **`EntityManager` import point: not applicable yet, and the `Opt` type import moved
    anyway.** No file anywhere in `backend/src` injects `EntityManager` (no repository,
    no service exists in this epic) - the reference's point about importing the
    driver-specific `EntityManager` from `@mikro-orm/mysql` for DI-token resolution has
    nothing to attach to yet. It does apply going forward and is unaffected by this
    round: `db/mikro-orm.module.ts` already passes `driver: MySqlDriver` explicitly
    (story 3.1 AC B), which is what makes the driver-specific `SqlEntityManager` token
    resolvable the first time something does inject it. The one `@mikro-orm/core` import
    remaining in the entities (`import type { Opt } from '@mikro-orm/core'`, three
    files) was switched to `@mikro-orm/mysql` to match both references' style (the
    example repo's `user.entity.ts` imports `Opt` alongside `EntityRepository`/`wrap`
    from `@mikro-orm/mysql`, not `@mikro-orm/core`) - functionally identical (`mysql`
    re-exports all of `core` via `@mikro-orm/sql`), but it means every MikroORM import in
    this codebase now goes through the one driver package instead of two, so there is one
    fewer place to decide which package a given import should come from.
  - **`forFeature`: correctly still absent.** No repository is injected by anything in
    this epic (3.4 demonstrated the ORM-read convention with `em.getRepository()` called
    directly on the injected `EntityManager`, not via `forFeature`/`@InjectRepository()`).
    `forFeature` belongs in the first feature module that actually wants a typed
    `EntityRepository` injected, which is Epic 5's job, not this epic's - adding it here
    with nothing consuming it would be unexercised code.
  - **Everything else already matched or was intentionally different, unchanged by this
    round:** entities import from `@mikro-orm/decorators/legacy` (D34, confirmed against
    the example repo's own entities); no `orm.migrator.up()` / no migrations package
    (D14, FR-13 - the example repo's one call this project must never make); entities
    colocated in one `db/entities/` directory rather than per-feature (this round's own
    explicit, deliberate deviation, restated above).

  No contradiction with `architecture.md` surfaced. D15 records the decision to use
  `@mikro-orm/nestjs` + `MikroOrmMiddleware` over manual `em.fork()`/`Scope.REQUEST` - it
  does not say *where* the middleware must be applied, so removing the redundant explicit
  call in `AppModule` in favor of the automatic one `MikroOrmCoreModule` already performs
  is consistent with D15, not a reversal of it.

  Full verification re-run after all three changes:
  - `pnpm --filter @portfolio/backend typecheck` / `lint` / `build` - all clean (lint:
    the one pre-existing `src/main.ts` `no-floating-promises` warning, no errors).
  - `docker compose up -d --build` (full stack) - all services `Up`; `docker logs
    nest-api` shows `DbModule dependencies initialized`, `MikroOrmCoreModule
    dependencies initialized`, `Found 0 errors`, all routes mapped, `Nest application
    successfully started`, no discovery/metadata errors, no `LegacyRouteConverter`
    warning.
  - `curl -sk https://www.tubesock.xyz/backend/api/health` -> `200` `{"status":"ok"}`;
    `curl -sk https://www.tubesock.xyz/login` -> `200` (next-app regression).
  - Schema drift check re-run against the moved/glob-discovered entities (throwaway,
    uncommitted CLI config pointing `entities` at `./dist/db/entities`, `--safe`, deleted
    after the run): output unchanged - exactly the four `drop foreign key` lines
    (`NetCashFlow.userId`, `OuathToken.userId`, `TokenPriceHistory.token_info_id`,
    `Transaction.userId`), no `drop index` lines. The move and the glob did not disturb
    the epic's FR-12 evidence.
  - Temporary diagnostic controller (`diag-temp.controller.ts`, same one-off convention
    as story 3.4's): added, exercised (`em-id` twice, `user-lookup` once against the live
    `portfolio-db`), then deleted; `git status` confirms it is absent from the final
    diff.

### Round 4 - rename the db module, and cut the comments back

Two changes.

**1. Rename.** `backend/src/db/mikro-orm.module.ts` -> `backend/src/db/db.module.ts`. It
sits in `db/` and exports `DbModule`; naming it after the library it happens to configure
is the odd one out.

**2. Far too many comments.** This epic added a large volume of commentary across its
files. Cut it back hard.

The test for keeping a comment: does a reader who has the code in front of them still not
know something they need? If they would work it out from the code itself, delete it. If
it restates what the line does, delete it. If it records why an alternative was rejected,
delete it - that belongs in `architecture.md`, and mostly already is there.

Where a comment genuinely survives that test, it gets **two lines at most**. Not two
sentences wrapped across four lines - two lines.

Scope this to the files this epic touched, listed in `## Changed Files`. If the same
pattern is visible in files from earlier epics, do not edit them; say which ones, so it
can be handled as its own piece of work rather than smuggled into this diff.

- Status: Applied

  **1. Rename.** `git mv backend/src/db/mikro-orm.module.ts
  backend/src/db/db.module.ts`. Updated the one import site,
  `backend/src/app.module.ts`, from `./db/mikro-orm.module` to `./db/db.module`. No
  other source file referenced the old path (`grep` across `backend/src` confirms).

  **2. Comments cut.** Applied the two-line/genuinely-irrecoverable test file by file
  across every file this epic's Changed Files list names. Removed, entirely: every
  "relation deliberately not modeled" comment (seven occurrences, one per entity file) -
  that reasoning is the scalar-only decision already recorded in architecture.md, not
  something belonging in each file; the "varchar(N), not the default of 255" comments on
  `TokenInfo`/`User` (recoverable directly from the visible `length:` option); a
  redundant `Transaction.date` comment restating decorator options already on the line
  below it; and `db.module.ts`'s twelve-line block down to two, keeping only the
  DDL-safety fact (the entities/entitiesTs glob-shape rationale is now recoverable from
  the property names and this round's own record above, not something a reader of the
  module needs restated in it). Kept, trimmed to two lines or fewer: the DDL-safety
  comment in `db.module.ts`; the `OuathToken` misspelling note; the `unsigned: false`
  ORM-default-override notes (three files); the FLOAT-vs-DOUBLE column-type note in
  `transaction.entity.ts`; the schema.prisma-drift notes on `NetCashFlow.date`,
  `ExchangeRate.date`, and `TokenPriceHistory`'s composite PK/extra column; and the
  "externally assigned, not autoincrement" one-liners on `OuathToken.id` and
  `TokenInfo.token_id`. None of these restate a value already visible in the same
  decorator, and none argue for a rejected alternative.

  Verification: `pnpm --filter @portfolio/backend typecheck` clean;
  `pnpm --filter @portfolio/backend lint` reports only the one pre-existing
  `src/main.ts` `no-floating-promises` warning, no errors; `npx prettier --check
  backend/src/db` reports all files formatted. `pnpm --filter @portfolio/backend build`
  and `docker compose up -d --build` both confirmed below.

### Round 5 - property decorators always expand vertically

In the entity files, every property decorator's options object is written expanded, one
option per line, even when the whole thing would fit inside the 100-character print width:

```ts
@Property({
  type: 'string',
  fieldName: 'symbol',
  length: 45,
  nullable: true,
})
```

Not the collapsed form, regardless of length:

```ts
@Property({ type: 'string', fieldName: 'symbol', length: 45, nullable: true })
```

The columns are the schema contract, and a uniform shape makes them diffable and scannable
down the file. Whether one happens to fit on a line is not a reason for it to read
differently from its neighbours.

This applies to `@Property` and `@PrimaryKey` - every decorator that carries per-column
options. Leave `@Entity` as it is.

Prettier will not fight this: its object-literal heuristic preserves an expanded object
whenever there is a newline between the opening brace and the first key, so the formatter
keeps the vertical form rather than collapsing it back. Confirm that by running
`prettier --check` over the entity directory after the change rather than assuming it.

- Status: Applied

  Expanded every `@Property` and `@PrimaryKey` options object in the seven files under
  `backend/src/db/entities/` to one option per line, including the ones that already fit
  on a single line (`ExchangeRate.unit`/`.rate`, `NetCashFlow.date`, `OuathToken.id`,
  `TokenInfo.slug`/`.name`/`.rank`, `TokenPriceHistory.token_info_id`/`.timeFrame`,
  `Transaction.coinName`/`.product`/`.side`/`.size`/`.unit`/`.price`/`.fee`/`.total`/
  `.notes`, `User.password`). `@Entity` decorators and all comments are unchanged. No
  option value, key, property, or import changed - only the formatting of the decorator
  argument.

  Verified the mapping did not shift, not just that it compiles: read all 46 properties
  back against the pre-edit values before running anything, then re-ran the schema drift
  check against the live `portfolio-db` (throwaway, uncommitted CLI config pointing
  `entities` at `./dist/db/entities`, run inside the running `nest-api` container so it
  could reach the DB host, `--safe`, deleted after the run):
  ```
  alter table `NetCashFlow` drop foreign key `userId`;
  alter table `OuathToken` drop foreign key `OuathToken_userId_fkey`;
  alter table `TokenPriceHistory` drop foreign key `TokenPriceHistory_ibfk_1`;
  alter table `Transaction` drop foreign key `Transaction_userId_fkey`;
  ```
  Exactly the four `drop foreign key` lines, no `drop index` lines - unchanged from every
  prior round's floor, confirming none of the 46 mechanical edits shifted a `fieldName`,
  `type`, `length`, `precision`/`scale`, `index`, or `unique` value.

  `npx prettier --check backend/src/db/entities` reports all seven files formatted - the
  formatter accepts the always-expanded form and does not want to collapse any of them
  back. `pnpm --filter @portfolio/backend typecheck` clean; `pnpm --filter @portfolio/backend
  lint` reports only the one pre-existing `src/main.ts` `no-floating-promises` warning, no
  errors.
