# Story 3.3: Entities for `TokenPriceHistory`, `ExchangeRate`, `NetCashFlow`, and `OuathToken`

Status: Done

## Context

Applies story 3.2's established pattern (scalar-only entities, explicit `.fieldName()`
on every property, one file per entity under `backend/src/entities/`) to the remaining
four models, completing FR-12's seven-entity coverage. Two of these four carry the
schema oddities architecture calls out by name: `TokenPriceHistory` has no real MySQL
primary key, and `NetCashFlow`'s primary key is a `DATE` column - both need a decision
this story makes explicitly rather than leaving 3.4 or Epic 5 to rediscover.

This story also runs the one manual, read-only drift check that proves FR-13/D14 hold
now that all seven entities exist: `mikro-orm schema:update --dump`.

## Acceptance Criteria

### A. `TokenPriceHistory` entity - no real primary key

- [x] `backend/src/entities/token-price-history.entity.ts` - table `TokenPriceHistory`.
      **Reconciled against the live table, which disagrees with this bullet on every
      column** (see Dev Notes): `close_price` is a live `decimal(18,2)`, not `float`;
      `date` is a live `timestamp`, not `DATE`; `token_info_id` is a scalar FK per 3.2's
      pattern (no `TokenInfo` relation); `timeFrame` is `varchar(255)`; and the live
      table carries a fifth column, `TokenPriceHistorycol` (`varchar(45)`, nullable),
      absent from `schema.prisma` entirely - included so the entity matches the live
      table exactly.
- [x] Story 3.1's `OBSERVED-FACTS.md` already established the live table has a genuine
      **four-column** composite `PRIMARY KEY (token_info_id, date, close_price,
      timeFrame)`, not the two-column `(date, token_info_id)` this bullet assumed, and
      not "no primary key" as this story's Context assumed. Confirmed again directly via
      `SHOW CREATE TABLE TokenPriceHistory` against the running `portfolio-db` container
      (Dev Notes). All four columns are declared `.primary()`.
- [x] **Reconciled: `date` is typed `Date`, not `string`.** The live column is a
      `timestamp`, not a `DATE` - confirmed by `SHOW CREATE TABLE` and by reading a real
      row (Dev Notes, section F evidence: `date: 'Date: "2024-09-15T12:00:00.000Z"'`).
      The DATE-maps-to-JS-string fact this bullet describes applies only to a genuine
      MySQL `DATE` column; this one was never that in the live database.

### B. `ExchangeRate` entity

- [x] `backend/src/entities/exchange-rate.entity.ts` - table `ExchangeRate`. Columns per
      `schema.prisma:44-49`: `id` (int, primary, auto-increment), `date` (datetime -
      this one has no `@db.Date`, so it stays a full `DATETIME`/`p.datetime()`, unlike
      `TokenPriceHistory.date`), `unit` (string, unique), `rate` (float). Confirmed
      unchanged against the live table (`SHOW CREATE TABLE ExchangeRate`).

### C. `NetCashFlow` entity - `DATE` primary key

- [x] `backend/src/entities/net-cash-flow.entity.ts` - table `NetCashFlow`. **Reconciled
      against the live table**, which disagrees with this bullet: `date` is a live
      `datetime` column (not `DATE`), confirmed by `SHOW CREATE TABLE NetCashFlow`
      (`` `date` datetime NOT NULL``) - already flagged as a difference from this
      story's own Context in 3.1's `OBSERVED-FACTS.md`. `userId` is a scalar FK (no
      `User` relation), part of the composite primary key `(date, userId)`. The seven
      money columns (`netContributions`, `netCash`, `totalCostBasis`, `valueOfHoldings`,
      `profitLoss`, `roi`, `ror`) are live `decimal(18,2)`, not `float` as
      `schema.prisma` declares - reconciled the same way (Dev Notes).
- [x] **Reconciled: `date` is typed `Date`, not `string`.** This bullet's premise (a
      genuine `DATE` column) does not hold for this table - it is `datetime`, confirmed
      both by `SHOW CREATE TABLE` and by reading a real row (Dev Notes, section F
      evidence: `date: 'Date: "2024-09-16T00:00:00.000Z"'`). The DATE-maps-to-string
      fact this bullet asks to apply here is a logical consequence of the DATE column
      type, and this column was never that type in the live database.

### D. `OuathToken` entity - misspelling kept

- [x] `backend/src/entities/ouath-token.entity.ts` - table `OuathToken`. Columns per
      `schema.prisma:63-69`: `id` (string, primary, cuid - no auto-generation logic
      needed for reads; `.primary()` with no `.autoincrement()`), `userId` (int, scalar
      FK per 3.2's pattern - no `User` relation), `accessToken` (string, unique),
      `accessTokenExpiresOn` (datetime). Confirmed unchanged against the live table.
- [x] The table and column name keep the `OuathToken` misspelling exactly as it exists in
      the live database. Renaming it would be a schema change, out of scope under FR-13
      - this is documented behavior, not an oversight to "fix" while touching the file.

### E. Drift check - proves FR-13/D14 with all seven entities present

- [x] With all seven entities (3.2's three plus this story's four) registered in
      `MikroOrmModule`'s `entities: []`, ran `mikro-orm schema:update --dump` (via the
      `@mikro-orm/cli` devDependency added in 3.1) against the live `portfolio-db`. This
      command only prints the DDL that *would* reconcile the entities to the database -
      it never applies anything (confirmed: nothing was run, only `--dump`).
- [x] **Output is empty except for four `drop foreign key` lines that are a
      structurally unavoidable consequence of the epic's own no-relations pattern (AC A
      of both 3.2 and this story), not an entity/column mismatch** - see Dev Notes for
      the full command, output, and code-level explanation of why these four lines
      cannot be eliminated without reintroducing MikroORM relations (out of scope, and
      would reopen the `Ref<T>` JSON-shape hazard AC A exists to avoid). Every column
      type, length, default, unsigned-ness, and named index/unique constraint across all
      seven entities matches the live schema exactly, including the standalone
      secondary indexes backing `Transaction.userId` and `OuathToken.userId`
      (`.index('Transaction_userId_fkey')` / `.index('OuathToken_userId_fkey')`, added
      after review to match `NetCashFlow.userId`'s existing `.index('userId_idx')`
      pattern) - confirmed by iterating this command until only the FK-constraint lines
      remained.
- [x] Command and full output pasted into Dev Notes as the recorded evidence.

### F. Verified by reading real rows, and full-epic checks

- [x] For each of the four entities, the same one-off read-and-inspect check as story
      3.2's section E (`em.find(<Entity>, {}, { limit: 1 })`), confirming every field's
      presence and runtime JS type, with the transcript pasted into Dev Notes.
      `TokenPriceHistory.date` and `NetCashFlow.date` both arrived as JS `Date` objects,
      not strings - contradicting this story's own A/C prediction, but consistent with
      both being live `timestamp`/`datetime` columns rather than `DATE` (see A/C
      reconciliation above).
- [x] `pnpm --filter @portfolio/backend build`, `typecheck`, and `lint` all pass with all
      seven entities registered.

## Technical Notes

### Reference: composite primary key without a matching MySQL constraint

```ts
export const TokenPriceHistorySchema = defineEntity({
  class: TokenPriceHistory,
  tableName: 'TokenPriceHistory',
  properties: {
    date: p.string().fieldName('date').primary(),
    token_info_id: p.integer().fieldName('token_info_id').primary(),
    close_price: p.float().fieldName('close_price'),
    timeFrame: p.string().fieldName('timeFrame'),
  },
});
```

### Why the `date`→JS-`string` fact matters now and not later

Both `TokenPriceHistory` and `NetCashFlow` were already spot-checked at the architecture
phase (`NetCashFlow.date` and `TokenPriceHistory.date` specifically) - this is not a new
finding, it is a known fact this story types correctly at the source so Epic 5's
`summary`/`profitLossChart`/`time-frame-pl` stories, which consume both tables, inherit
a `string`-typed field instead of rediscovering the mismatch against `Date` per FR-3.

## Out of Scope

- `User`, `Transaction`, `TokenInfo` entities - story 3.2 (already established the
  pattern this story applies).
- Deciding *how* Epic 5 endpoints reconcile the `date`-as-string fact against FR-3's
  byte-for-byte response parity - that is each consuming Epic 5 story's own call.
- `EntityManager`-by-DI pattern for real domain services, `MikroOrmMiddleware` - story
  3.4.
- Any relation/join modeling - out of scope per 3.2's established pattern.
- Writing to any of these tables - read-only verification only.

## Dev Notes

### Live schema reconciliation - more drift than 3.1's two flagged facts

3.1's `OBSERVED-FACTS.md` flagged two live-vs-story-text disagreements (`TokenPriceHistory`'s
real four-column composite PK, `NetCashFlow.date` being `datetime` not `date`) and
explicitly deferred full reconciliation to 3.2/3.3. Direct `SHOW CREATE TABLE` queries
against the running `portfolio-db` container (`docker exec portfolio-db mysql -uroot
-proot -e "SHOW CREATE TABLE PORTFOLIO.<table>"`) during this story surfaced further
drift beyond those two facts, all reconciled here per architecture's "the database is
authoritative, not `schema.prisma`" and 3.2's own precedent (nullable columns, non-camelCase
FK names) for doing exactly that:

- `TokenPriceHistory.close_price` is `decimal(18,2)`, not `float`/`@db.Float`.
- `TokenPriceHistory.date` is `timestamp` (`DEFAULT CURRENT_TIMESTAMP ON UPDATE
  CURRENT_TIMESTAMP`), not `date`/`@db.Date` - this directly contradicts AC A's `date`-as-
  `string` instruction, which was written on the (wrong, for this environment) premise
  that the column is a genuine `DATE`. Reconciled by typing `date: Date` and documenting
  why in the entity file itself.
- `TokenPriceHistory` has a fifth column, `TokenPriceHistorycol` (`varchar(45)`,
  nullable), absent from `schema.prisma` altogether. Included in the entity (nullable
  string) so the entity matches the live table exactly, per FR-12.
- `NetCashFlow`'s seven money columns are `decimal(18,2)`, not `float`/`@db.Float`.
- `User`, `Transaction`, and `TokenInfo` (3.2, already Done) also disagree with the live
  schema in ways that only surface once the full-epic drift check (section E) runs for
  the first time: `varchar` lengths (`User` columns are live `varchar(191)`, `TokenInfo`
  columns are live `varchar(45)`, both entities used the `p.string()` default of 255),
  primary-key `unsigned`-ness (MikroORM defaults a primary key integer/decimal column to
  `unsigned`; none of these live PK columns are), missing `.autoincrement()` on `User.id`/
  `Transaction.id`, a missing default on `Transaction.userId` (live `DEFAULT '1'`), a
  missing length/default on `Transaction.date` (live `datetime(3) DEFAULT
  CURRENT_TIMESTAMP(3)`), and unique-constraint names not matching the live
  Prisma-generated names (`User_email_key`, `User_username_key`,
  `ExchangeRate_unit_key`, `OuathToken_accessToken_key`). Fixed directly in the three
  3.2 entity files, since this story owns the first run of the full-epic drift check
  section E requires and 3.2's own drift-check bullet was deferred here.

### Drift check evidence, and the four lines that cannot go away

Ran (from `backend/`, against a throwaway, uncommitted `mikro-orm.config.ts` pointing
`clientUrl` at the host-mapped `mysql://root:root@127.0.0.1:3306/PORTFOLIO`, listing all
seven schemas):

```
npx mikro-orm schema:update --dump --config ./mikro-orm.config.ts --safe
```

`--safe` was added because the plain command also prints `drop view if exists
TradeTransaction` and `drop table if exists _prisma_migrations` - both real objects in
this database, neither one of FR-12's seven models, and neither addressable by any
entity (modeling either is out of scope). `--safe` (per
`@mikro-orm/sql/schema/SqlSchemaGenerator.js:274,311`, gated on `!options.safe`)
suppresses exactly that class of statement (drop tables/views MikroORM has no metadata
for) without affecting anything else - confirmed by diffing the with/without-`--safe`
output line by line.

Original output, before the index fix below, had two additional `drop index` lines
alongside the four `drop foreign key` lines - `Transaction.userId` and
`OuathToken.userId` were declared without the standalone secondary index that backs
their live FK (`` KEY `Transaction_userId_fkey` (`userId`) `` /
`` KEY `OuathToken_userId_fkey` (`userId`) ``), unlike `NetCashFlow.userId`, which
already declared `.index('userId_idx')` matching its own live named index and produced
no `drop index` line. Index diffing is independent of FK diffing - `TokenPriceHistory`'s
FK is backed by the leftmost PK column, so it never had a standalone index to diff in
the first place. Fixed by adding the matching `.index(...)` call to both properties
(`backend/src/entities/transaction.entity.ts`, `backend/src/entities/ouath-token.entity.ts`),
the same way `NetCashFlow.userId` already did.

Final output, after every non-FK diff (including both indexes) was driven to zero:

```
set names utf8mb4;

alter table `NetCashFlow` drop foreign key `userId`;

alter table `OuathToken` drop foreign key `OuathToken_userId_fkey`;

alter table `TokenPriceHistory` drop foreign key `TokenPriceHistory_ibfk_1`;

alter table `Transaction` drop foreign key `Transaction_userId_fkey`;
```

These four lines are not a column/type mismatch - they are `preAlterTable()`
(`@mikro-orm/sql/schema/SqlSchemaGenerator.js:411-420`) unconditionally emitting a `drop
foreign key` for every live FK constraint whose table has *any* other metadata
difference, with no `safe`/`drop-tables`/`fk-checks` flag gating that specific loop.
MikroORM only knows about a foreign key through a modeled `ManyToOne`/`Ref<T>` relation
property (confirmed: `EntitySchema`'s property options have no scalar-column
`foreignKeyName`/`referencedTable` field - only relation properties carry FK metadata).
Every one of these four tables (`Transaction`, `NetCashFlow`, `OuathToken`,
`TokenPriceHistory`) has a real FK constraint in the live database on the exact column
AC A (this story and 3.2's) requires be modeled as a plain scalar with **no** relation.
Reintroducing a relation on any of these columns purely to satisfy the drift check would
directly contradict AC A's explicit instruction and 3.2's already-Done, epic-wide
precedent, and reopens the `Ref<T>` JSON-shape hazard that instruction exists to avoid.
Every other line of drift (all seven entities' column types, lengths, defaults,
`unsigned`-ness, and named indexes/uniques) was driven to zero and stays zero across
re-runs. This is the practical floor given the epic's scalar-only-FK architecture, not a
gap in this story's entity definitions.

### Real-row verification (section F)

Ran a throwaway `backend/verify-entities.script.ts` (written, run, deleted - not
committed, same convention as 3.2), booting
`NestFactory.createApplicationContext(AppModule)` with `DATABASE_URL` overridden to the
host-mapped `mysql://root:root@127.0.0.1:3306/PORTFOLIO`, resolving a forked
`EntityManager`, and calling `em.find(<Entity>, {}, { limit: 1 })` for each of the four
entities against the live `portfolio-db` container. Observed output:

```
TokenPriceHistory row: {
  token_info_id: 'number: 1',
  date: 'Date: "2024-09-15T12:00:00.000Z"',
  close_price: 'string: "60004.96"',
  timeFrame: 'string: "y"',
  TokenPriceHistorycol: 'null: null'
}
ExchangeRate row: {
  id: 'number: 18246',
  date: 'Date: "2026-08-16T20:57:26.236Z"',
  unit: 'string: "ADA"',
  rate: 'number: 0.17718'
}
NetCashFlow row: {
  date: 'Date: "2024-09-16T00:00:00.000Z"',
  userId: 'number: 1',
  netContributions: 'string: "34152.75"',
  netCash: 'string: "0.00"',
  totalCostBasis: 'string: "34152.75"',
  valueOfHoldings: 'string: "38641.74"',
  profitLoss: 'string: "4488.99"',
  roi: 'string: "13.14"',
  ror: 'string: "13.14"'
}
OuathToken row: {
  id: 'string: "clpiyaq0f0001pjxn6q20x9jl"',
  userId: 'number: 1',
  accessToken: 'string: "233ae55e-97b6-4d93-8a4b-0f1badbc53c1"',
  accessTokenExpiresOn: 'Date: "2023-12-28T23:10:02.799Z"'
}
```

Every field is present and non-`undefined`. `TokenPriceHistory.date` and
`NetCashFlow.date` both arrived as real `Date` instances (not strings), confirming the
A/C reconciliation above at runtime, not just from `SHOW CREATE TABLE`. All `decimal`
columns (`close_price` and every `NetCashFlow` money column) arrived as JS `string`,
MikroORM's default decimal representation (precision-preserving, no float rounding) -
typed `string` in each entity class to match.

### Changed Files

+ backend/src/db/entities/token-price-history.entity.ts   `TokenPriceHistory` entity - four-column composite PK, `date` typed `Date` (live `timestamp`, not `DATE`), extra `TokenPriceHistorycol` column included
+ backend/src/db/entities/exchange-rate.entity.ts          `ExchangeRate` entity - id/date/unit/rate, named unique constraint to match live DB
+ backend/src/db/entities/net-cash-flow.entity.ts          `NetCashFlow` entity - composite PK `(date, userId)`, `date` typed `Date` (live `datetime`), money columns typed `decimal`/`string`
+ backend/src/db/entities/ouath-token.entity.ts            `OuathToken` entity - misspelling kept, named unique constraint to match live DB; review round 1 (F1) adds `.index('OuathToken_userId_fkey')` on `userId` to match the live secondary index
~ backend/src/db/db.module.ts                              registers the four new schemas in `entities: []`; later moved to `db/` and switched to glob discovery (owner feedback round 3); later still, renamed `mikro-orm.module.ts` -> `db.module.ts` (owner feedback round 4)
~ backend/src/db/entities/user.entity.ts                   fixes found by this story's drift check: PK `unsigned(false)`/`autoincrement()`, `varchar(191)` lengths, named unique constraints matching live DB
~ backend/src/db/entities/transaction.entity.ts             fixes found by this story's drift check: PK `unsigned(false)`/`autoincrement()`, `date` length/default, `userId` default matching live DB; review round 1 (F1) adds `.index('Transaction_userId_fkey')` on `userId` to match the live secondary index
~ backend/src/db/entities/token-info.entity.ts              fixes found by this story's drift check: PK `unsigned(false)`, `varchar(45)` lengths matching live DB

### Post-story update (owner feedback, entity definition style)

All four of this story's entities converted from `defineEntity()` + `p` builder to a
single exported class carrying `@Entity`/`@PrimaryKey`/`@Property` decorators from
`@mikro-orm/decorators/legacy`, matching story 3.2's converted three. Every `p` builder
call transcribed one-to-one to the equivalent decorator option:
`TokenPriceHistory`'s four `.primary()` columns became four `@PrimaryKey`-decorated
properties (`token_info_id`, `date`, `close_price`, `timeFrame`); `NetCashFlow`'s
composite `(date, userId)` primary key is likewise two `@PrimaryKey` properties, with
`userId`'s `.index('userId_idx')` carried over as `index: 'userId_idx'`.
`OuathToken.userId`'s `.index('OuathToken_userId_fkey')` (review round 1, F1) carried
over as `index: 'OuathToken_userId_fkey'`. `TokenPriceHistory.date` and
`ExchangeRate.date`, both DB-defaulted (`defaultRaw`), are now typed `& Opt`.
`mikro-orm.module.ts` registers the four classes directly instead of the `*Schema`
objects. See the epic file's Owner Feedback round 1 for the full record and rollout, and
story 3.2's Post-story update for the shared `backend/package.json` version bump
(`@mikro-orm/core`/`mysql`/`cli`/`entity-generator` 7.1.12 -> 7.1.13, added
`@mikro-orm/decorators@^7.1.13`, `typescript` `^5.7.3` -> `^5.9.0` - later reverted to
exact `7.1.12` by the epic review's F5 fix; see story 3.2's Post-3.2 update and the
epic file's Round 3 F5 entry).

Re-ran this story's own drift check after the conversion (rebuilt `dist/`, throwaway
`dist/mikro-orm.config.js`, `npx mikro-orm schema:update --dump --config
./dist/mikro-orm.config.js --safe`, config and `dist/` deleted after): output is exactly
the same four `drop foreign key` lines as before the conversion
(`NetCashFlow`/`OuathToken`/`TokenPriceHistory`/`Transaction`), no `drop index` lines -
the four-line floor this story established and review rounds 1/2 re-verified holds
unchanged across the style rework. Re-ran the section F row read for all four entities via
a throwaway `verify-entities.script.ts`; every field returned byte-identical to the
transcript above (same values, same runtime types - `date` still a real `Date` on both
`TokenPriceHistory` and `NetCashFlow`, `decimal` columns still `string`).
`typecheck`/`lint`/`build` all pass.

### Verification

- `pnpm --filter @portfolio/backend build` - passed (`nest build`, no errors).
- `pnpm --filter @portfolio/backend typecheck` - passed (`tsc --noEmit -p tsconfig.json`, no errors).
- `pnpm --filter @portfolio/backend lint` - passed with the repo's one pre-existing
  warning in `src/main.ts` (`no-floating-promises` on `bootstrap()`), unrelated to this
  story; no errors.
- `mikro-orm schema:update --dump --config ./mikro-orm.config.ts --safe` (throwaway
  config, deleted after the run) - output reduced to the four `drop foreign key` lines
  documented above; every column/type/length/default/index/unique diff across all seven
  entities is zero.
- Real-row read for all four of this story's entities via a throwaway, uncommitted
  script - transcript above; every field present, non-`undefined`, and of the runtime
  type documented (in particular `date` as `Date`, `decimal` columns as `string`).

### Post-review update (round 1, F1)

- Added `.index('Transaction_userId_fkey')` to `transaction.entity.ts` and
  `.index('OuathToken_userId_fkey')` to `ouath-token.entity.ts`.
- Re-ran the drift check with a throwaway `backend/mikro-orm.config.ts` (built via
  `pnpm --filter @portfolio/backend build`, run against `dist/mikro-orm.config.js`,
  config and `dist/` both deleted after the run):
  `npx mikro-orm schema:update --dump --config ./dist/mikro-orm.config.js --safe` -
  output is now exactly the four `drop foreign key` lines quoted above, with no `drop
  index` lines.
- `pnpm --filter @portfolio/backend typecheck` - passed, no errors.
- `pnpm --filter @portfolio/backend lint` - passed, same one pre-existing `src/main.ts`
  warning, no errors.

### Post-story update (owner feedback round 3, `db/` folder and glob discovery)

This story's four entities (and the three from 3.2) moved from `backend/src/entities/`
to `backend/src/db/entities/` (`git mv`). `TokenPriceHistory.date`/`ExchangeRate.date`'s
`Opt` import moved from `@mikro-orm/core` to `@mikro-orm/mysql` (matches both references
cited in the epic's round 3 feedback). No column mapping, index, or drift-check-relevant
option changed - re-ran the drift check after the move and it is still exactly the four
`drop foreign key` lines this story's AC E records, no `drop index` lines. See the epic
file's Round 3 update for the full reconciliation and the three-context glob-resolution
verification.
