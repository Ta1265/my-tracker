# Story 3.1: MikroORM installed and configured against the existing MySQL 5.7 database

Status: Done

## Context

Epic 3 maps MikroORM onto the database as it stands, without ever generating or
applying DDL (FR-13). This story is the foundation the rest of the epic builds on: get
MikroORM 7 connected to the live `portfolio-db` MySQL 5.7 instance through the
`AppConfigService` provider story 1.4 built, with the migrations package structurally
absent, and run the one-off entity generator against the real schema so stories 3.2 and
3.3 have accurate raw material to hand-tune rather than writing entities from
`schema.prisma` (`frontend/src/server/db/schema.prisma`) blind. No entities are
hand-tuned or committed in this story - that is 3.2 and 3.3. No EntityManager-by-DI
pattern is established here either - that is 3.4.

Architecture D33 is binding: **MikroORM 7 has no decorators.** `@Entity`, `@Property`,
`@PrimaryKey`, `@ManyToOne`, `@Unique`, `@Index`, `@CreateRequestContext` are all
`undefined` on `@mikro-orm/core@7.1.11`. The only entity API is `defineEntity()` /
`EntitySchema` with the `p` property builder, and `@mikro-orm/entity-generator@7.1.11`
emits exactly that shape - do not draft from any v6-era decorator example.

## Acceptance Criteria

### A. Dependencies - migrations package never installed

- [x] `backend/package.json` gains dependencies `@mikro-orm/core@^7.1.11`,
      `@mikro-orm/nestjs@^7.0.2`, `@mikro-orm/mysql@^7.1.11` (the SQL driver package -
      this is where the schema generator and connection pooling live).
- [x] `backend/package.json` gains devDependencies `@mikro-orm/cli@^7.1.11` (needed to
      run the generator now and the `schema:update --dump` drift check in story 3.3) and
      `@mikro-orm/entity-generator@^7.1.11` (needed for this story's one-off run only).
- [x] `@mikro-orm/migrations` is **not** added anywhere in `backend/package.json`, now or
      ever (D14 - the strong form of FR-13: a missing package cannot be invoked by
      accident, unlike a config flag). Verify: `grep -c '@mikro-orm/migrations'
      backend/package.json` returns `0`.

### B. Connection wired through `AppConfigService`, no schema sync

- [x] `backend/src/entities/mikro-orm.module.ts` wraps `MikroOrmModule.forRootAsync()`
      from `@mikro-orm/nestjs`, injecting `AppConfigService` (story 1.4) for the
      connection string - no direct `process.env` read, matching every other provider in
      this codebase.
- [x] The config passes **`driver: MySqlDriver`** explicitly (imported from
      `@mikro-orm/mysql`). This is required, not optional: `MikroOrmModule.forRoot()`
      only registers the driver-specific `EntityManager` DI token
      (`SqlEntityManager`, which is what `@mikro-orm/mysql` exports as `EntityManager`)
      when it can construct the driver from the options - omitting it fails at bootstrap
      with `Nest can't resolve dependencies` the first time anything injects
      `EntityManager`.
- [x] `clientUrl` is set from `appConfigService.databaseUrl` (the existing
      `DATABASE_URL` getter from story 1.4 - `mysql://root:root@portfolio-db:3306/PORTFOLIO`
      in `defaults.env`). No new env var is introduced by this story.
- [x] `entities: []` for now - populated by stories 3.2 and 3.3. `discovery` options are
      left at their defaults, **except `warnWhenNoEntities: false`**: MikroORM 7 hard-
      throws `Error: No entities found, please use 'entities' option` at bootstrap
      otherwise (`Configuration.validateOptions`, entities.length === 0 &&
      discovery.warnWhenNoEntities). This is a discovery-time validation guard, not a
      schema-sync flag - it has no effect on any DDL and is unrelated to FR-13/D14.
      Everything else under `discovery` stays at its default.
- [x] No code anywhere calls `orm.schema.createSchema()`, `.updateSchema()`,
      `.refreshDatabase()`, `.ensureDatabase()`, or any other schema-mutating method.
      `MikroOrmModule.forRootAsync()`'s options do not set `autoLoadEntities` combined
      with any schema-sync flag. This is FR-13's structural guarantee; the absent
      migrations package (section A) is its strong form, this is its explicit form.
- [x] `AppModule` imports the new `MikroOrmModule` (via the wrapping module) alongside
      `AppConfigModule`.

### C. One-off entity generator run, raw output captured as evidence

- [x] Run `@mikro-orm/entity-generator` **once**, against the real, running
      `portfolio-db` (via `docker compose up -d portfolio-db` or an equivalent live
      connection - not a fixture or a fresh empty database), with
      `namingStrategy: EntityCaseNamingStrategy` and
      `entityGenerator: { scalarPropertiesForRelations: 'always' }` (architecture: the
      default naming strategy produces broken output on this schema - e.g. `close_price`
      silently becomes a `closePrice` property - and `scalarPropertiesForRelations` is
      what gives stories 3.2/3.3 the scalar FK column to hand-tune from, alongside the
      relation property they will drop).
- [x] The raw, **untuned** output is captured verbatim - one file per generated entity -
      under `docs/bmad/nestjs-migration/mikroorm-generator-raw/` (docs-only, same
      untracked convention as Epic 2's inventory documents). This is evidence of what the
      generator actually produced before any hand-tuning, not a deliverable to be edited
      in place.
- [x] Alongside the raw output, record observed database facts the generator gets wrong
      on this schema, for stories 3.2/3.3 to resolve without re-deriving them - see
      `docs/bmad/nestjs-migration/mikroorm-generator-raw/OBSERVED-FACTS.md`. Two facts
      came out differently from what this story's Context assumed, recorded there in
      full: this local `portfolio-db` container's live `TokenPriceHistory` table
      actually has a real four-column composite `PRIMARY KEY
      (token_info_id, date, close_price, timeFrame)` (not "no real primary key"), and
      `NetCashFlow.date` is a live `datetime` column (not `date`) with primary key
      `(date, userId)`, confirmed by `SHOW CREATE TABLE` on the running container -
      this environment's schema has drifted from `schema.prisma` (extra
      `TokenPriceHistorycol`/`timeFrame` columns), which is the most likely explanation.
      The relation-plus-scalar pairing (`Transaction.tokenInfoId`,
      `TokenPriceHistory.tokenInfo`/`tokenInfoId`) is confirmed exactly as expected.

### D. Connection verified from the running backend container

- [x] `docker compose up -d --build nest-api` (depends on `portfolio-db` and `redis` per
      `docker-compose.yml:77-79`, unchanged) boots the backend with the new MikroORM
      module wired in, and `docker compose logs nest-api` shows `@mikro-orm/nestjs`'s own
      successful-connection log line, with no error connecting to `portfolio-db:3306`.
      Bootstrap alone doesn't fully prove the pool actually reaches MySQL (the driver's
      pool creation is not eager), so this was independently confirmed by running the
      entity generator (section C) with the same `clientUrl` shape against the same
      container and calling `orm.connect()` + `orm.isConnected()` first, which returned
      `true` before generating.
- [x] `GET /backend/api/health` (through nginx, over local HTTPS, unchanged from story
      1.5) still returns `200` - MikroORM connecting does not touch the liveness check
      itself (that stays DB-free per story 1.4's own note).
- [x] `pnpm --filter @portfolio/backend build`, `typecheck`, and `lint` all still pass.

## Technical Notes

### Why entities are deferred to 3.2/3.3

This story's job is connectivity and the one-off generation pass, not hand-tuned
entities. Keeping `entities: []` here means 3.1's acceptance is checkable independent of
any single entity's correctness, and 3.2/3.3 each own exactly the entities the PRD lists
under them with no overlap.

### `defineEntity` shape (for reference when reviewing the generator's raw output)

```ts
import { defineEntity, p } from '@mikro-orm/core';

export class Transaction {
  id!: number;
  token_info_id!: number;
}

export const TransactionSchema = defineEntity({
  class: Transaction,
  tableName: 'Transaction',
  properties: {
    id: p.integer().fieldName('id').primary(),
    token_info_id: p.integer().fieldName('token_info_id'),
  },
});
```

`MikroOrmModule.forRoot({ entities: [...] })` takes the schema objects (`*Schema`);
`em.find(Transaction, ...)` and repositories take the class.

### The one silent trap in the API

**Use `.fieldName()`, never `.name()`.** `PropertyOptions.name` is documented as an
alias for `fieldName`, but MikroORM only promotes `name` → `fieldName` when the value
differs from the property key. Under `EntityCaseNamingStrategy`, the generator's own
default output can produce `coinName: p.string().name('coinName')`, which is a **no-op**
- `fieldName` stays unset, the underscore naming strategy fills it in, and the property
silently maps to a nonexistent `coin_name` column. This surfaces as
`ER_BAD_FIELD_ERROR: Unknown column 't0.coin_name'` only once a query actually reaches
that column, not at generation time or at `select *` hydration. When reviewing the raw
generator output, note every `.name(...)` call for 3.2/3.3 to convert to `.fieldName(...)`.

### Renamed APIs worth knowing before poking at the generator or the connection

`orm.schema` replaces the old `orm.getSchemaGenerator()`. `getMetadata().getAll()`
returns `{}` and `.has(name)` returns `false` even for fully discovered entities - use
`.get(name)`, `.getByClassName(name)`, or `.find(EntityClass)` if any diagnostic code
needs to inspect discovered metadata.

### `@mikro-orm/core` is ESM-only

No top-level `await` anywhere in `backend/src` (already true since story 1.4; this story
does not change that constraint, just makes it load-bearing for the first time since
`@mikro-orm/core@7.1.11` is `"type": "module"` and loaded via Node's `require(esm)`
support under the backend's CommonJS build).

## Out of Scope

- Any hand-tuned, committed entity file - stories 3.2 (`User`, `Transaction`,
  `TokenInfo`) and 3.3 (`TokenPriceHistory`, `ExchangeRate`, `NetCashFlow`,
  `OuathToken`).
- `MikroOrmMiddleware`, request-scoped EntityManager forking, and the raw-vs-ORM query
  convention - story 3.4.
- The `mikro-orm schema:update --dump` drift check - story 3.3.
- Any write to `portfolio-db` beyond what the generator's introspection and the
  connection check perform (both read-only).

## Dev Notes

### `moduleResolution` had to change alongside adding MikroORM

`@mikro-orm/core@7.1.12` is a pure ESM package with no `main`/`types` field, only a
package.json `exports` map. `backend/tsconfig.json`'s prior settings (`module:
commonjs`, no explicit `moduleResolution`, so TS defaults to the legacy `node10`
resolver) don't read `exports` maps at all, which broke type-checking two different
ways: first, resolving `@mikro-orm/sql`'s internal `@mikro-orm/core/schema` subpath
import produced a structurally different (and incompatible) view of
`SqlSchemaGenerator`, so passing `driver: MySqlDriver` to `MikroOrmModule.forRootAsync`
failed to type-check at all. Fixed by setting `module: nodenext` (which implies
`moduleResolution: nodenext`, honors `exports`, and is per-file CJS/ESM aware based on
the nearest `package.json#type` - `backend/package.json` has none, so every existing
`.ts` file keeps emitting CommonJS exactly as before; verified via `dist/main.js`
starting with `"use strict"` + `require(...)` after `nest build`). This also resolved
the second failure mode on its own: TS's `node16`/`nodenext` resolvers know Node 22+
supports `require()` of ESM packages (this workspace pins Node `>=24 <25`), so importing
`@mikro-orm/nestjs`/`@mikro-orm/mysql` from a CommonJS file no longer raises TS1479. No
other backend file changed behavior under `nodenext` - the switch only changes how
`exports` maps and CJS/ESM interop are resolved at type-check/build time, not what gets
emitted.

### `discovery.warnWhenNoEntities: false` was required, not optional

With `entities: []` and MikroORM 7's own discovery defaults, bootstrap throws `Error: No
entities found, please use 'entities' option` (`Configuration.validateOptions`) before
the app can start at all. This is a discovery-time validation guard warning that nothing
was found to discover - unrelated to schema generation/sync (FR-13/D14) - so it was set
to `false` explicitly in `backend/src/entities/mikro-orm.module.ts`. Story 3.2 removes
the need for this the moment real entities are registered; leaving it in place until
then is harmless since it only suppresses a message, never runs any SQL.

### Entity generator run

Run via a throwaway Node script (not committed - written to a scratch directory,
executed from `backend/` so package resolution worked, then deleted), connecting to
`portfolio-db` via the host's mapped `3306` port with the same `clientUrl` shape the app
uses, calling `MikroORM.init()` with `driver: MySqlDriver`, `namingStrategy:
EntityCaseNamingStrategy`, `entityGenerator: { scalarPropertiesForRelations: 'always',
save: true, path: <mikroorm-generator-raw dir> }`, then `orm.entityGenerator.generate()`.
Output and observed facts (including two live-schema differences from this story's own
Context assumptions) are under
`docs/bmad/nestjs-migration/mikroorm-generator-raw/` (untracked, not part of `git add`
per the epic's docs-only convention - see that directory's `OBSERVED-FACTS.md`).

### Changed Files

+ backend/src/db/db.module.ts                `DbModule` (originally `EntitiesModule` at `backend/src/entities/mikro-orm.module.ts`) wrapping `MikroOrmModule.forRootAsync()`, wired to `AppConfigService`, no entities/schema-sync yet; moved and renamed by the epic's owner-feedback round 3 `db/`-folder rework, then renamed `mikro-orm.module.ts` -> `db.module.ts` by round 4 (see epic file) - this story's own connection-wiring content is unchanged by either move
~ backend/src/app.module.ts                  imports `DbModule` (originally `EntitiesModule`) alongside `AppConfigModule`
~ backend/package.json                       adds `@mikro-orm/core`, `@mikro-orm/nestjs`, `@mikro-orm/mysql` deps and `@mikro-orm/cli`, `@mikro-orm/entity-generator` devDeps; never `@mikro-orm/migrations`
~ backend/tsconfig.json                      `module: nodenext` (was `commonjs` with implicit legacy resolution) so `exports`-map-only ESM packages like `@mikro-orm/core` type-check correctly
~ pnpm-lock.yaml                             lockfile update from the above dependency additions, later re-resolved to 7.1.12 (F5 fix, see Post-story update)

### Post-story update (owner feedback, entity definition style)

The epic-wide decorator conversion (see the epic file's Owner Feedback round 1) initially
moved `@mikro-orm/core`/`mysql`/`cli`/`entity-generator` from `^7.1.12` to `^7.1.13` and
added `@mikro-orm/decorators@^7.1.13`, raising `typescript` to `^5.9.0` in the same
change - see story 3.2's Post-story update and the epic file for the full record. This
story's own scope (connection wiring, `entities: []`, the one-off generator run) is
unaffected: no entity is declared here, and `mikro-orm.module.ts`'s `driver`/`clientUrl`
wiring is unchanged by the style conversion.

That 7.1.13 bump was reverted by the epic's F5 fix (see the epic file's Round 3 F5
entry): `@mikro-orm/decorators@7.1.12` exists and peers `@mikro-orm/core@7.1.12` exactly,
so the bump to 7.1.13 was never necessary and had forced a `minimumReleaseAgeExclude`
cooldown waiver for seven same-day-published tarballs. All five affected
`backend/package.json` entries are now pinned to the exact string `7.1.12`, and
`pnpm-workspace.yaml` carries no waiver. `typescript@^5.9.0` is untouched by this
revert - it holds independently of the MikroORM version.

### Post-story update (owner feedback round 3, `db/` folder and glob discovery)

`backend/src/entities/mikro-orm.module.ts` moved to `backend/src/db/mikro-orm.module.ts`
(`git mv`) and its exported class renamed `EntitiesModule` -> `DbModule`, per the epic
file's Owner Feedback round 3 ("follow the official NestJS/MikroORM setup, with a `db/`
folder"). This story's own scope - the `AppConfigService`-driven `clientUrl`, the
explicit `driver: MySqlDriver`, `forRootAsync` (kept over the reference's `forRoot(config)`
since this project's config source is DI-injected, not a static import) - is unchanged by
the move; only the file's location and class name changed. See the epic file's Round 3
update for the full reconciliation against both references and the three-context glob
verification.

### Post-story update (owner feedback round 4, rename to `db.module.ts`)

`backend/src/db/mikro-orm.module.ts` renamed to `backend/src/db/db.module.ts` (`git mv`);
`AppModule`'s import updated from `./db/mikro-orm.module` to `./db/db.module`. The
exported class name, `DbModule`, is unchanged - only the filename, which was still named
after the library rather than the module. This story's connection wiring is unaffected.

### Verification

- `grep -c '@mikro-orm/migrations' backend/package.json` → `0`.
- `pnpm --filter @portfolio/backend typecheck` → passes, no errors.
- `pnpm --filter @portfolio/backend build` → passes (`nest build`), no errors.
- `pnpm --filter @portfolio/backend lint` → passes with the one pre-existing warning in
  `src/main.ts` (unrelated floating-promise warning predating this story), no errors.

F5 fix re-verification (exact 7.1.12 pin, waiver removal):
- `npm view '@mikro-orm/decorators@7.1.12' peerDependencies` →
  `{ '@mikro-orm/core': '7.1.12', 'reflect-metadata': '^0.1.0 || ^0.2.0' }`, confirming
  7.1.12 was a viable pin before touching `package.json`.
- `pnpm clean --lockfile && pnpm install` → completes with 0 supply-chain policy
  violations and no `minimumReleaseAgeExclude` written to `pnpm-workspace.yaml`.
- `grep minimumReleaseAgeExclude pnpm-workspace.yaml` → no match.
- `backend/node_modules/@mikro-orm/{core,decorators,mysql,cli,entity-generator}/package.json`
  each report `"version": "7.1.12"`.
- `pnpm --filter @portfolio/backend typecheck && lint && build` → all pass (lint: the
  one pre-existing `src/main.ts` warning, no errors).
- `docker compose up -d --build` → full stack up; `docker logs nest-api` shows
  `MikroOrmCoreModule dependencies initialized` and `Nest application successfully
  started`, all routes mapped, no discovery/metadata errors.
- `docker exec nest-api curl -s http://localhost:3001/backend/api/health` →
  `{"status":"ok"}` / `200`.
- Drift check re-run (throwaway, uncommitted config against the live `PORTFOLIO`
  database, `--safe`, deleted after): output unchanged from prior rounds - exactly the
  four `drop foreign key` lines, no `drop index` lines.
- `docker compose up -d --build nest-api` → rebuilt and started; `docker compose logs
  nest-api` shows `MikroOrmCoreModule dependencies initialized` and
  `Nest application successfully started` with no MikroORM/MySQL connection errors.
- `curl -sk -o /dev/null -w '%{http_code}' https://localhost/backend/api/health` → `200`.
- Entity generator run (section C) connected live (`orm.isConnected()` → `true`) and
  produced 8 files (7 domain tables + Prisma's own `_prisma_migrations`) under
  `docs/bmad/nestjs-migration/mikroorm-generator-raw/`, confirming end-to-end
  connectivity independent of the NestJS bootstrap log line.
