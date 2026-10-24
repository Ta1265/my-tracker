# Story 3.2: Entities for `User`, `Transaction`, and `TokenInfo`

Status: Done

## Context

Story 3.1 (done first) connected MikroORM to `portfolio-db` and captured the raw
entity-generator output under `docs/bmad/nestjs-migration/mikroorm-generator-raw/`. This
story hand-tunes that raw output into the first three committed entities, seeded from
the generator but owned by hand from here on (D12) - the generator is never run again
against these three tables. It also **sets the pattern** every later entity in this epic
(3.3) and every entity-touching story in Epics 4-5 follows: property style, primary key
declaration, and how a foreign-key column is represented. Get this story's shape right
and 3.3 is a mechanical application of it.

`frontend/src/server/db/schema.prisma` is the schema-as-documented reference; the live
database is authoritative where the two disagree (architecture: "the database is
authoritative, not `schema.prisma`").

## Acceptance Criteria

### A. The pattern this story establishes (apply identically in 3.3)

- [x] **Entities are scalar-only - no MikroORM relations (`ManyToOne`, `Ref<T>`, etc.)
      anywhere.** Foreign keys are plain scalar columns, named and typed exactly as they
      are in the database (`token_info_id: number`, `userId: number`), matching D13's
      "property naming mirrors the database exactly" and sidestepping the JSON-shape
      hazard architecture flags: a `Ref<TokenInfo>` property would serialize differently
      from the plain FK column FR-3 pins, and none of the epic's `EntityRepository`
      usage (D16 - transaction insert/delete, user lookup, token-info finds) needs
      MikroORM-level relation loading. Where the raw generator output (3.1) emitted a
      relation property (`tokenInfo: Ref<TokenInfo>`) alongside the scalar FK per
      `scalarPropertiesForRelations: 'always'`, drop the relation property and keep only
      the scalar.
- [x] **Every property gets an explicit `.fieldName()` call, even when it matches the
      property name.** No naming strategy is relied on for anything - this is what makes
      3.1's `.name()`-vs-`.fieldName()` trap moot for entities written from this story
      forward.
- [x] **One file per entity** under `backend/src/entities/`, named
      `<entity>.entity.ts` (e.g. `user.entity.ts`), exporting both the plain class
      (`export class User { ... }`) and the `defineEntity()` schema
      (`export const UserSchema = defineEntity({ class: User, tableName: 'User', ... })`).
      Register each new `*Schema` in `MikroOrmModule`'s `entities: []` array (3.1's empty
      array, now populated).

### B. `User` entity

- [x] `backend/src/entities/user.entity.ts` - table `User`. Columns, per
      `schema.prisma:51-61` and the raw generator output: `id` (int, primary,
      auto-increment - MikroORM's `p.integer().fieldName('id').primary()`; no
      `autoincrement()` call needed for reads/writes this epic performs, but leave a
      comment if the generator's raw output declared one, so a later story doesn't
      silently drop it), `name` (string, nullable), `email` (string, unique), `password`
      (string), `username` (string, unique), `image` (string, nullable).
- [x] `OauthTokens`, `Transaction`, and `NetCashFlow` back-relations from
      `schema.prisma:58-60` are **not** represented on this entity at all, per section A.

### C. `Transaction` entity

- [x] `backend/src/entities/transaction.entity.ts` - table `Transaction`. Columns per
      `schema.prisma:26-42`: `id` (int, primary, auto-increment), `userId` (int),
      `coinName` (string), `product` (string), `date` (datetime), `side` (string),
      `size` (float - MySQL `float`, not `double`; use `p.float()`, not `p.double()`),
      `unit` (string), `price` (float), `fee` (float), `total` (float), `notes`
      (string), `token_info_id` (int, scalar FK, per section A - no `TokenInfo`
      relation).
- [x] The `user` (→ `User`) and `TokenInfo` relations from `schema.prisma:39,41` are
      **not** represented, per section A.

### D. `TokenInfo` entity

- [x] `backend/src/entities/token-info.entity.ts` - table `TokenInfo`. Columns per
      `schema.prisma:17-25`: `token_id` (int, primary - **not** auto-increment; this is
      an externally-assigned id, e.g. a CoinGecko token id, confirm against the raw
      generator output and a real row rather than assuming), `symbol` (string),
      `slug` (string), `name` (string), `rank` (int).
- [x] The `Transaction` and `TokenPriceHistory` back-relations from
      `schema.prisma:23-24` are **not** represented, per section A.

### E. Verified by reading real rows

- [x] For each of the three entities, write a short throwaway script or REPL session
      (not committed - same one-off-and-discard convention as story 1.4's env-precedence
      checks) that boots `NestFactory.createApplicationContext(AppModule)`, resolves
      `EntityManager`, and reads at least one real row via
      `em.getRepository(<Entity>).findOne({})` or `em.find(<Entity>, {}, { limit: 1 })`.
      Confirm every field is present, non-`undefined`, and of the expected runtime JS
      type (this is the first place the architecture's "check the runtime JS type of
      every field, not just its value" guidance applies - record what you actually saw,
      not what was expected).
- [x] Paste the transcript (query issued, row(s) returned, field types observed) into Dev
      Notes for all three entities.
- [x] `pnpm --filter @portfolio/backend build`, `typecheck`, and `lint` all pass with the
      three new entities registered in `MikroOrmModule`.

## Technical Notes

### `Transaction.size` and the `float` vs `double` trap

`schema.prisma:35` declares `size Float @db.Float` - Prisma's `Float` type defaults to
MySQL `double` unless `@db.Float` is present, and it is here. MikroORM's `p.float()`
maps to MySQL `FLOAT`; using `p.float64()`/`p.double()` here would be wrong. Same applies
to every other `@db.Float` column on this entity (`price`, `fee`, `total`).

### `TokenInfo.token_id` is not auto-increment

Unlike `User.id` and `Transaction.id`, `TokenInfo.token_id` has no `@default(autoincrement())`
in `schema.prisma:18` - it is assigned by whatever inserts the row (almost certainly an
external token id from the price provider). Do not add `.autoincrement()` to this
property; confirm this against the raw generator output from 3.1.

### Reference: the `defineEntity` shape (from 3.1, repeated here since this is the
first story that writes one for real)

```ts
import { defineEntity, p } from '@mikro-orm/core';

export class User {
  id!: number;
  name?: string;
  email!: string;
  password!: string;
  username!: string;
  image?: string;
}

export const UserSchema = defineEntity({
  class: User,
  tableName: 'User',
  properties: {
    id: p.integer().fieldName('id').primary(),
    name: p.string().fieldName('name').nullable(),
    email: p.string().fieldName('email').unique(),
    password: p.string().fieldName('password'),
    username: p.string().fieldName('username').unique(),
    image: p.string().fieldName('image').nullable(),
  },
});
```

## Out of Scope

- `TokenPriceHistory`, `ExchangeRate`, `NetCashFlow`, `OuathToken` entities - story 3.3.
- The `EntityManager`-by-DI pattern for real domain services, `MikroOrmMiddleware`, and
  the raw/aggregate query convention - story 3.4. This story's verification script is a
  one-off, not the established pattern.
- Any relation/join modeling - deliberately out of scope per section A, for this story
  and this epic generally.
- Writing to any of these tables - read-only verification only.

## Dev Notes

`TokenInfo.symbol`, `slug`, `name`, and `rank` are declared nullable, and
`Transaction.token_info_id` is declared nullable, following the raw generator output
against the live database rather than `schema.prisma`'s non-optional declarations (the
live database is authoritative per architecture). `Transaction.token_info_id` and
`TokenInfo.token_id` keep their literal snake_case database column names as the
property key itself (not camelCased), per D13 and section A's example
(`token_info_id: number`).

### Post-story update (owner feedback, entity definition style)

The owner reversed the entity-definition style architecture originally specified: entities
are now decorated classes (`@Entity`/`@PrimaryKey`/`@Property` from
`@mikro-orm/decorators/legacy`), not a plain class paired with a `defineEntity()` schema
object. Architecture's D33/D34 record the reversal and the forced `/legacy`-over-`/es`
choice; see the epic file's Owner Feedback round 1 for the full record and rollout.

`user.entity.ts`, `transaction.entity.ts`, and `token-info.entity.ts` were converted:
the paired `class X` / `const XSchema = defineEntity(...)` collapsed to one exported class
carrying the decorators, with every `p.<type>().fieldName(...).<option>()` call
transcribed to the equivalent decorator option (`type`, `fieldName`, `nullable`, `unique`,
`length`, `default`, `unsigned`, `autoincrement`) one-to-one - no column mapping changed.
`Transaction.userId` and `Transaction.date`, both DB-defaulted, are now typed `& Opt`
(imported from `@mikro-orm/core`) per architecture's decorator-style requirement, since
optionality no longer lives in a separate schema object. `mikro-orm.module.ts` registers
the three classes directly instead of the `*Schema` objects.

`backend/package.json` moved `@mikro-orm/core`, `@mikro-orm/mysql`, `@mikro-orm/cli`,
`@mikro-orm/entity-generator` from `^7.1.12` to `^7.1.13` (MikroORM pins those peers to an
exact version, and `@mikro-orm/decorators@7.1.13` requires it) and added
`@mikro-orm/decorators@^7.1.13`; `typescript` raised from `^5.7.3` to `^5.9.0` (TS <=5.8
cannot compile an ESM-only `@mikro-orm/core` import from CJS under `module: nodenext`).

Re-verified after conversion (full seven-entity re-run, since this story's three entities
share a module with story 3.3's four): `typecheck`/`lint`/`build` all pass; the
`mikro-orm schema:update --dump --safe` drift check against the live `portfolio-db`
still produces exactly the same four `drop foreign key` lines as before the conversion,
no `drop index` lines; a throwaway `verify-entities.script.ts` re-ran
`em.find(<Entity>, {}, { limit: 1 })` for `User`, `Transaction`, and `TokenInfo` and
returned rows byte-identical to the transcript below (same values, same runtime types) -
see the epic file's Owner Feedback round 1 entry for the full command/output record.

### Post-3.2 update (from story 3.3)

Story 3.3's full-epic drift check (its own AC E, deferred here at the time since only
3.2's three entities existed) found these three entities did not produce an empty
`mikro-orm schema:update --dump` against the live database: PK columns needed
`.unsigned(false)` (and `User.id`/`Transaction.id` needed `.autoincrement()`), several
`varchar` columns needed explicit lengths matching the live table (`User` at 191,
`TokenInfo` at 45, both narrower than `p.string()`'s 255 default), `Transaction.date`
needed a length/default matching the live `datetime(3) DEFAULT CURRENT_TIMESTAMP(3)`
column, `Transaction.userId` needed a default matching the live `DEFAULT '1'`, and the
unique constraints needed explicit names matching the live Prisma-generated ones. Fixed
directly in `user.entity.ts`, `transaction.entity.ts`, and `token-info.entity.ts` by
story 3.3 - see that story's Dev Notes for the full reconciliation and drift-check
evidence.

### Post-3.2 update (epic review F5 fix)

The `7.1.12 -> 7.1.13` bump below was reverted: `@mikro-orm/decorators@7.1.12` exists
and peers `@mikro-orm/core@7.1.12` exactly, so 7.1.13 was never required, and moving to
it had forced a `minimumReleaseAgeExclude` cooldown waiver in `pnpm-workspace.yaml` for
seven tarballs published the same day as the install. All five `@mikro-orm/*` entries in
`backend/package.json` are now pinned to the exact string `7.1.12` (not `^7.1.12` - that
range still resolves to 7.1.13), and the waiver block is gone. `typescript@^5.9.0` is
unaffected and stands as before. See the epic file's Round 3 F5 entry and story 3.1's
Post-story update for the full fix record and re-verification.

### Post-3.2 update (owner feedback round 3, `db/` folder and glob discovery)

`user.entity.ts`, `transaction.entity.ts`, and `token-info.entity.ts` moved from
`backend/src/entities/` to `backend/src/db/entities/` (`git mv`), alongside the other
four Epic 3 entities and the renamed `mikro-orm.module.ts` (-> `DbModule`, also moved to
`backend/src/db/`). No column mapping changed. This story's `Opt` import (only present on
`Transaction.userId`/`.date`) moved from `@mikro-orm/core` to `@mikro-orm/mysql` to match
both references cited in the epic's round 3 feedback. See the epic file's Round 3 update
for the full reconciliation and verification (glob resolution proven in three contexts,
schema drift check re-run unchanged).

### Changed Files

+ backend/src/db/entities/user.entity.ts       `User` entity - decorated class (`@Entity`/`@PrimaryKey`/`@Property`) - id, name, email, password, username, image
+ backend/src/db/entities/transaction.entity.ts `Transaction` entity - decorated class, scalar-only, FK `token_info_id` kept as plain column, `userId`/`date` typed `& Opt`
+ backend/src/db/entities/token-info.entity.ts  `TokenInfo` entity - decorated class, `token_id` PK, not auto-increment
~ backend/src/db/db.module.ts                  registers the three entity classes in `entities: []`; drops the now-unneeded `discovery.warnWhenNoEntities` override; later registers classes directly instead of `*Schema` objects (owner feedback, decorator conversion); later still, moved to `db/` and switched to glob discovery (owner feedback round 3); later still, renamed `mikro-orm.module.ts` -> `db.module.ts` (owner feedback round 4)
~ backend/package.json                         `@mikro-orm/core`/`mysql`/`cli`/`entity-generator` 7.1.12 -> 7.1.13 -> back to exact `7.1.12`, adds `@mikro-orm/decorators` at exact `7.1.12`, `typescript` `^5.7.3` -> `^5.9.0` (owner feedback, decorator conversion; version pin corrected by epic review F5 fix)

### Verification

- `pnpm --filter @portfolio/backend build` - passed (`nest build`, no errors).
- `pnpm --filter @portfolio/backend typecheck` - passed (`tsc --noEmit -p tsconfig.json`, no errors).
- `pnpm --filter @portfolio/backend lint` - passed with the repo's one pre-existing
  warning in `src/main.ts` (`no-floating-promises` on `bootstrap()`), unrelated to this
  story; no errors.
- Read one real row per entity via a throwaway script (`backend/verify-entities.script.ts`,
  written, run, and deleted - not committed), booting
  `NestFactory.createApplicationContext(AppModule)`, resolving a forked `EntityManager`
  (`.fork()` was required - MikroORM disallows global-context repository calls outside a
  request scope), and calling `em.find(<Entity>, {}, { limit: 1 })` against the live
  `portfolio-db` container (`mysql://root:root@127.0.0.1:3306/PORTFOLIO`, the host-mapped
  port of the same container the backend connects to at `portfolio-db:3306`). Observed
  output:

  ```
  User row: {
    id: 'number: 1',
    name: 'string: "Taylor Anderson"',
    email: 'string: "taylor21035@gmail.com"',
    password: 'string: "$2b$10$fnR0Sx2Z1EJoZWaaF9qMWeXy83Zyb5ISiQN6kGPxfR5A2b1VDCXcK"',
    username: 'string: "Taylor"',
    image: 'null: null'
  }
  Transaction row: {
    id: 'number: 674',
    userId: 'number: 1',
    coinName: 'string: "Ankr"',
    product: 'string: "ANKR-USD"',
    date: 'Date: "2021-03-26T04:48:25.409Z"',
    side: 'string: "SELL"',
    size: 'number: 24',
    unit: 'string: "ANKR"',
    price: 'number: 0.12055',
    fee: 'number: 0.0101262',
    total: 'number: 2.88307',
    notes: 'string: "CB-Pro"',
    token_info_id: 'number: 1313'
  }
  TokenInfo row: {
    token_id: 'number: 1',
    symbol: 'string: "BTC"',
    slug: 'string: "bitcoin"',
    name: 'string: "Bitcoin"',
    rank: 'number: 1'
  }
  ```

  Every field is present and non-`undefined`. Runtime types match expectations:
  integers as `number`, `date` as a real `Date` instance, all strings as `string`,
  `User.image` and (on other rows, not this one) nullable `TokenInfo`/`Transaction`
  columns surface as JS `null` rather than `undefined` when the DB value is `NULL`.
