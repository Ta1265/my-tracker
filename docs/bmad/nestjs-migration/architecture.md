<!--
Owned by: bmad-architect
Read by: bmad-sm

Technical design only. Every decision here should trace back to a requirement in
prd.md - if it doesn't, it doesn't belong here.
-->

# Architecture: NestJS Backend Migration

## Findings that amend the PRD - read this first

Five things surfaced during investigation that the brief and PRD state incorrectly or
omit. They are recorded here because the Architect cannot edit `prd.md`. **F1 to F3 must
be folded into story acceptance criteria by the Scrum Master. F4 and F5 are different in
kind: each is a requirement that no longer says what the owner has decided, so both must
be routed to `bmad-pm` for an edit to `prd.md` rather than absorbed into a story.**

### F1 - `src/middleware.ts` is an unlisted session consumer, and it is Edge-only

The brief (line 82) and PRD (FR-8) both state that `src/app/page.tsx` and
`src/app/login/page.tsx` are the only non-API server-side session consumers. **This is
wrong.** `src/middleware.ts` wraps `withAuth` from `next-auth/middleware` and gates
`/stats`, `/stats/:path*`, and `/product/:path*` on the NextAuth cookie.

Consequence: after the Epic 7.1 auth flip, a browser holding only a Nest-issued session
is redirected away from `/stats` by middleware that still only understands NextAuth.
**This is a cutover blocker, not a polish item.**

The version fact that makes this unavoidable: this repo is on **Next.js 14.0.1**, where
middleware runs exclusively on the Edge runtime. The `runtime: 'nodejs'` opt-out for
middleware did not arrive until Next 15.2 and is experimental there. There is no escape
hatch on 14.0.1.

A related misconception worth killing in writing, because a future reader will reach for
it: **"Edge" here is a Next.js *runtime*, not a hosting location.** Deploying to plain
EC2 behind nginx does not make middleware run in Node. Next executes middleware inside an
edge-runtime sandbox regardless of where the process lives. What *is* true, and what this
design depends on, is that Next 14's sandbox binds its `crypto` global to Node's
`webcrypto` (verified in
`node_modules/next/dist/compiled/@edge-runtime/primitives/crypto.js.text.js`), so the
sandbox's cryptographic *capabilities* are the host Node's capabilities even though its
*API surface* is Web-standard only.

**SM actions:** middleware must be inside the Epic 6.2 auth seam, and "middleware
correctly gates `/stats` and `/product/*` on a Nest-issued session, and flipping the
config back restores NextAuth gating" must be an Epic 7.1 acceptance criterion.

### F2 - the two `formatUSD` copies are behaviorally different; 5.7 must not unify them

Story 5.7 asks for the duplicated `formatUSD` to be "reconciled." Investigation shows
they are genuinely different functions, so **the correct resolution is keep-both-and-
document, not unify.**

- `src/server/helpers/format-usd.ts` branches on `Math.abs(value) < 10`: below 10 it
  formats with `maximumFractionDigits: 2`, at or above 10 with `maximumFractionDigits: 0`.
  It also supports a `wrapIfNegative` flag that parenthesizes negatives.
- `src/app/api/product/[product]/route.ts:7` is a plain
  `toLocaleString('en-US', { style: 'currency', currency: 'USD' })` with default
  precision and no threshold and no negative wrapping.

For a value of `1234.56` the shared helper yields `"$1,235"` and the product-route copy
yields `"$1,234.56"`. Unifying them silently breaks FR-3 on whichever endpoint loses.

**SM action:** story 5.7's acceptance must say two distinct formatters ship in the
backend - `formatUSD` and `formatUsdPrecise` - with the behavioral difference recorded.

### F3 - two of today's Prometheus metrics are registered but never emitted

`src/server/metrics.ts` registers `http_requests_total` and `http_request_duration_ms`,
but nothing in `src/` ever increments or observes them. `src/middleware.ts` explains why
in a comment - prom-client cannot run on Edge, so the plan was to instrument each route
handler individually, and that instrumentation was never written.

Consequence for FR-16 ("emits at minimum the equivalents of the metrics registered
today"): these two have no existing values to be at parity *with*. The backend gets them
properly via a Nest interceptor, which makes the backend's metrics strictly better than
the frontend's.

**SM action:** story 5.9's acceptance should record these as an **additive divergence,
not a parity item**, so nobody spends time hunting for the frontend series to match.

### F4 - NFR-2 now covers type checking only; lint gates nothing

NFR-2 reads "`backend/` is type-checked and linted ... and a failing check fails the
build. This is non-negotiable for the backend." It binds lint and types together in one
sentence. **The owner has decided that lint fails no build anywhere** - not in the Docker
images, not in CI - on the principle that an image build should produce an artifact, not
run a quality gate. Type checking still gates, because `nest build` runs `tsc` and
`packages/shared`'s build *is* `tsc`, so a type error still fails the backend image
outright.

The surviving half of NFR-2 is therefore real and enforced; the other half is now false as
written. See D40 for the full decision and for what it supersedes in story 1.6.

**PM action:** amend NFR-2 to cover type checking only, and state that lint is a developer
and editor tool with no build-failing behavior. Story 1.6's frontend deliverable
(recorded error counts, deferral rationale) is unaffected and stays as written; only its
backend lint-enforcement half is superseded.

**Resolved, and NFR-2 went one step further than this asked.** The amended text also voids
the paragraph that preserved *build-failing correctness enforcement generally*, because the
OpenAPI staleness check that paragraph rested on no longer exists (FR-21, superseded by
FR-26). **Type checking is now the only thing that fails a backend image build.**

### F5 - GR-6's grep matches the Orval mutator, which is the epic's own deliverable

GR-6 states its test mechanically: "grep the frontend for `fetch(` and `axios`, and every
surviving hit must target something outside the spec - today that is exactly the
crypto.com price API in `frontend/src/_hooks/useStorePriceHistory.ts:14`, plus anything
under `src/app/api/` and `src/server/`."

That enumeration is complete for the frontend as it stands and becomes wrong the moment
Epic 10 lands. **Orval does not perform HTTP itself when a custom mutator is configured -
the mutator is the HTTP call**, and FR-25 requires a custom mutator, because the seam that
rewrites a spec path onto its Next.js equivalent has nowhere else to live (D54). So
`frontend/src/api/http-client.ts` contains a hand-written `fetch(`, it targets every
endpoint in the backend's OpenAPI document, and it is the file the epic exists to produce.

Run as written, GR-6's grep fails on story 10.6 - the acceptance criterion that is meant
to certify the epic is the thing that reports it broken. This is not a violation to design
around and not a reason to weaken the rule: **one** hand-written client is exactly what
GR-6 wants, and the mutator is it. The rule needs the exemption named, not loosened.

The mutator is also the reason the grep must keep matching `axios` as well as `fetch(`:
per D58 the mutator is fetch-based, so an `axios` hit anywhere under `frontend/src`
outside `src/server/helpers/` remains a genuine violation.

**PM action:** amend GR-6's enumeration to name `frontend/src/api/http-client.ts` as the
single permitted in-spec hit, worded so it is one named file rather than a category -
"the Orval mutator, and no other file" - and state that a second hand-written client
appearing anywhere is a violation even if it is also called a mutator. The generated
output itself (`frontend/src/api/generated.ts`) needs no exemption: it contains no
`fetch(` or `axios` at all, only calls into the mutator.

**Resolved.** GR-6 now names the mutator as its single exception, and pins its definition
of "a spec'd endpoint" to the live `/backend/docs-json` and `frontend/src/api/generated.ts`
rather than to the deleted `backend/openapi.json`.

---

## Overview

The repo becomes a pnpm workspace with `frontend/` (today's Next.js app, moved wholesale
and otherwise unchanged), `backend/` (a new NestJS 11 service), and `packages/shared` (a
deliberately tiny package holding only the session claim contract - types and constants,
no runtime dependencies). Repo-wide concerns stay at root.

The backend is reachable at the **same origin** as the frontend, behind the existing
nginx, under the path prefix `/backend`. Nest's global prefix is `/backend/api`, so every
path *after* the prefix is character-for-character identical to the existing Next route.
That makes the Epic 6/7 cutover a single string flip from `''` to `'/backend'` in one
place, and it means no CORS exists anywhere in this design.

NestJS owns authentication. It verifies credentials against the existing `User` table and
bcrypt hashes, then issues a **stateless ES256-signed JWT** in an httpOnly cookie named
`portfolio_session`. Nest holds the P-256 private key and is the only signer. The Next
frontend holds only the public key and verifies locally - in server components and, per
F1, in Edge middleware - with no network hop back to Nest.

The data layer is MikroORM 7 mapped onto the unchanged MySQL 5.7 schema, with the
migration toolchain deliberately not installed so DDL cannot be generated even by
accident. Prisma remains the sole schema owner, living on in `frontend/`.

The frontend's TypeScript view of every response is **generated** from a committed
snapshot of the backend's OpenAPI document, never hand-declared beside it. Generation runs
locally in Nest's preview mode with no database and no running service; both artifacts are
committed; and the two **production** Docker builds each re-derive their half of the chain
and fail if the committed copy does not match. **Nothing is added to CI** - see D39. Lint,
by contrast, fails no build anywhere in this repo - see D40.

**Epic 10 widens that from types to the whole client, and as it shipped it also replaced
the pipeline.** Orval generates the frontend's models *and* its TanStack Query hooks, and
the only hand-written HTTP code left in `frontend/src` outside the GR-1 files is a single
mutator that every generated operation calls. That mutator is also where the coexistence
seam lives: one build-time value decides whether a call lands on the Next.js route or on
Nest. See "The generated API client as it shipped".

> **Read the two paragraphs above as history from here on.** Three rounds of owner
> feedback during Epic 10 deleted the committed snapshot, the generator script, and both
> staleness checks. What ships is `frontend/orval.config.ts` reading the backend's **live**
> Swagger JSON at `http://localhost:3002/backend/docs-json`, plus one `spec:generate`
> script in `frontend/package.json`. `frontend/src/api/generated.ts` is committed and
> **nothing verifies it is current** - that is the developer's responsibility at commit
> time (FR-26, superseding FR-21). Type checking is now the only thing that fails a
> backend image build. See "The generated API client as it shipped" and D60 to D63.

Nothing in `frontend/src/app/api/` or `frontend/src/server/` is deleted, gutted, or
rewritten (GR-1). The two stacks run side by side against the same database and the same
Redis for the entire initiative, and the frontend can be pointed back at the old routes
by configuration alone (NFR-5).

**One qualification, now done.** GR-1 protects what was under those two
directories **when the initiative started**. `frontend/src/auth/session.ts` and
`frontend/src/auth/serverSession.ts` were created *by* this initiative - Epic 4 and story
6.2, under `frontend/src/server/` - and Epic 12 moved both into `frontend/src/auth/`,
because they are the frontend's half of the auth seam and outlive the migration rather
than dying with it, while `frontend/src/server/` is the folder Epic 8 empties. Every file
GR-1 was written for keeps its path and its contents, `src/server/auth.ts` included.
**Story 12.2 has landed, so this document cites both files at their post-move paths** -
see D64.

---

## Structure

### Workspace layout

```
/                          repo root - workspace-wide concerns only
  pnpm-workspace.yaml      packages: frontend, backend, packages/*
                           plus injectWorkspacePackages: true - see D26c,
                           it must be present before the first install
  pnpm-lock.yaml           single lockfile for the whole workspace
  package.json            private - after Epic 10, packageManager only
  tsconfig.base.json       deliberately thin - see below
  prettier.config.mjs      shared, the one config both sides agree on
  docker-compose.yml
  defaults.env / override.env
  nginx/  monitoring/  docs/  .claude/
  setup_local_https.sh

  frontend/                today's tree, moved (Epic 1.2), contents unchanged
    src/  public/  types/
    src/api/               Epic 10 - generated.ts (Orval output, committed)
                           and http-client.ts (the mutator, FR-25's seam)
    orval.config.ts        Epic 10 - reads the live Swagger JSON at
                           http://localhost:3002/backend/docs-json, writes
                           src/api/generated.ts; frontend-owned - see D61
    next.config.js  tailwind.config.ts  postcss.config.js
    tsconfig.json  .eslintrc.cjs  Dockerfile
    package.json           keeps the "prisma": { "schema": ... } pointer,
                           and owns the orval devDependency + spec:generate

  backend/                 new NestJS 11 service
    src/
    tsconfig.json  eslint.config.mjs  Dockerfile
    package.json

  packages/shared/         session claim contract only - types and constants,
                           no runtime dependencies
    src/  package.json  tsconfig.json
```

The precise root-vs-`frontend/` inventory is story 1.1's deliverable and is not
pre-empted here; the above is the shape it should produce.

**Shared config: root files, not config packages.** `tsconfig.base.json` carries only
`strict`, `esModuleInterop`, `skipLibCheck` and is extended by relative path. It is thin
on purpose - the two packages genuinely need different compilers (frontend: `noEmit`,
`jsx: preserve`, `moduleResolution: bundler`, `target: es5`; backend:
`experimentalDecorators`, `emitDecoratorMetadata`, `module: commonjs`, `target: ES2022`,
real emit). The base exists to stop `strict` drifting, not to unify things that are not
alike.

**Lint is per-package with no shared base.** The frontend keeps `eslint-config-next` and
its existing `.eslintrc.cjs`; the backend gets its own `@typescript-eslint` config. The
React ruleset and a decorator-heavy Nest ruleset disagree in ways that are not worth
mediating, and there is no shared base to make them agree on.

> **Amended by D40.** This paragraph previously ended "the backend build fails on lint or
> type errors, the frontend keeps its `next.config.js` suppression." The first half is no
> longer true: **lint fails no build in this repo.** What still gates the backend image is
> type checking, because `nest build` runs `tsc`. The frontend's `next.config.js`
> suppression is unchanged and still a recorded deferral to story 8.5.

### Backend module map

Controllers are thin - parse, delegate, respond. All business logic lives in injectable
per-domain services (NFR-1). Story 2.2 produces the authoritative endpoint-to-module
assignment; this is the module set it should land on.

```
backend/src/
  main.ts                     bootstrap, global prefix, Winston logger, Swagger, cookies
  app.module.ts

  config/                     ConfigModule - injectable typed config (story 1.4)
  common/
    clock/                    Clock interface + SystemClock (story 4.2)
    time-frame/               TimeFrameService - TimeFrame code -> date range
    formatting/               pure functions: formatUSD, formatUsdPrecise,
                              formatPercent, formatFixed  (NOT providers - see below)
    filters/                  global exception filter (story 4.3) + carve-outs
    interceptors/             http metrics interceptor
    swagger/                  @FormattedValue composed decorator, shared response docs
    cls/                      nestjs-cls setup - request id for logging only

  openapi/                    GLOBAL_PREFIX + DocumentBuilder config shared by main.ts
                              and the snapshot generator, plus the generator itself
                              (Epic 9)

  auth/                       login, logout, session; guard; JwtSigner; BcryptVerifier
  transactions/               POST /transaction/add, DELETE /transaction/:id
  summary/                    /summary/coins, /portfolio, /:unit, /profitLossChart(/:tf)
  stats/                      /stats/:unit
  product/                    /product/:product
  exchange-rates/             /exchange-rates/:timeFrame/:coinName, /unit/:unit
  price-history/              /price-history/check, /price-history/set
  time-frame-pl/              /time-frame-coins-pl/:tf, /time-frame-total-pl/:tf
  token-info/                 /token-info/:userId, /token-info/search/:searchTerm
  metrics/                    /metrics, METRICS_SECRET bearer guard
  redis/                      injectable Redis provider (story 5.2)
  entities/                   MikroORM entities (Epic 3)
```

### How NFR-1 is satisfied structurally

The three ambient dependencies the brief names as "painful to unpick later" are handled
as follows.

- **EntityManager** - arrives by constructor injection via `@mikro-orm/nestjs`. No domain
  service ever imports a module-level ORM singleton the way `src/server/db/db.ts` does
  today. A unit test constructs the service with a different EM and nothing else changes.
- **Current user / session** - passed **explicitly as a parameter** from controller into
  service. It never arrives ambiently. A service method that needs a user takes a
  `userId: number` argument; it does not reach into request context to find one.
- **Clock** - a `Clock` interface exposing `now(): Date`, injected. `TimeFrameService`
  takes the clock and converts a TimeFrame code into a date range, which collapses the
  duplicated arithmetic at `dbService.ts:250-271` and `dbService.ts:372-392` into one
  tested-in-future place. No `new Date()`, `Date.now()`, or `dayjs()` appears inside
  domain logic.

**One deliberate carve-out from NFR-1, recorded so it does not read as an oversight:**
the formatting helpers in `common/formatting/` are **plain exported pure functions,
imported directly**, not an injectable `FormattingService`. NFR-1's DI requirement is
aimed at *ambient, stateful* collaborators. `formatUSD(n): string` has no state, no I/O,
and no clock; it is already trivially unit-testable as a direct import, and wrapping it
in a provider would make every call site worse for no testability gain. If a formatter
ever needs a locale or timezone - both of which are ambient - it graduates to an
injectable at that point.

**A second apparent inconsistency, stated outright so it does not look accidental:**
request-id correlation *is* ambient, via `nestjs-cls`, while the current user is *not*.
The rule is: telemetry metadata may be ambient; anything domain logic **branches on** is
a parameter. Logging a request id is the former. Deciding whose transactions to return is
the latter.

---

## Data Layer

No schema change, no data migration, no engine change, no touching
`frontend/src/server/db/migrations/` (FR-13). MikroORM is mapped onto the database as it
stands; the database is authoritative, not `schema.prisma`.

### Entity definition style: decorated classes, `@mikro-orm/decorators/legacy`

> **Reversal, recorded openly.** This document previously specified `defineEntity()` +
> the `p` property builder, and Epic 3 was built and reviewed against that. The stated
> justification was that "MikroORM 7 has no decorators at all." **That justification was
> factually wrong.** Decorators were not removed in v7; they were *moved out of core into
> their own package*. The observation the old text rested on - that `Entity`, `Property`,
> `PrimaryKey`, `ManyToOne`, `Unique`, `Index`, and `CreateRequestContext` are all
> `undefined` on `@mikro-orm/core` - is correct and re-verified on the installed 7.1.12.
> The conclusion drawn from it was not. The owner has chosen decorators; the seven Epic 3
> entities get converted in place. The empirical findings from the original spike that do
> not depend on the error are preserved below, and one of them turns out to apply to the
> decorator style too.

Decorators live in **`@mikro-orm/decorators`**, a separate top-level package introduced
for v7 (upstream PR
[#7011](https://github.com/mikro-orm/mikro-orm/pull/7011); the
[v6-to-v7 upgrade guide](https://mikro-orm.io/docs/upgrading-v6-to-v7) states plainly
that "the decorators are now available in the `@mikro-orm/decorators` package, so you
need to install it explicitly"). It ships two entry points, `./legacy` and `./es`.
**This project uses `@mikro-orm/decorators/legacy`** - see D34 for why the choice is
forced rather than preferred.

**Version alignment is not optional.** MikroORM pins its intra-package peers to an exact
version, not a range: `@mikro-orm/decorators@7.1.13` declares
`peerDependencies: { '@mikro-orm/core': '7.1.13' }`, and `@mikro-orm/mysql@7.1.13` and
`@mikro-orm/entity-generator@7.1.13` do the same. The backend is on 7.1.12 today, so
adding decorators means moving `core`, `mysql`, `cli`, and `entity-generator` to 7.1.13
in the same change. `@mikro-orm/nestjs@7.0.2` peers on `^7.0.0` and is unaffected.

Abridged from the real `Transaction` entity, and verified to produce column types and DDL
identical to the `defineEntity` version it replaces:

```ts
import { Entity, PrimaryKey, Property } from '@mikro-orm/decorators/legacy';
import { Opt } from '@mikro-orm/core';

@Entity({ tableName: 'Transaction' })
export class Transaction {
  @PrimaryKey({ type: 'integer', fieldName: 'id', unsigned: false, autoincrement: true })
  id!: number;

  @Property({ type: 'integer', fieldName: 'userId', default: 1, index: 'Transaction_userId_fkey' })
  userId!: number & Opt;

  @Property({ type: 'string', fieldName: 'coinName' })
  coinName!: string;

  @Property({ type: 'datetime', fieldName: 'date', length: 3, defaultRaw: 'current_timestamp(3)' })
  date!: Date & Opt;

  @Property({ type: 'float', fieldName: 'size' })
  size!: number;

  @Property({ type: 'integer', fieldName: 'token_info_id', nullable: true })
  token_info_id?: number;
}
```

Every `p` builder call has a direct option equivalent, so the conversion is transcription:
`.primary()`/`.autoincrement()`/`.unsigned(false)` become `@PrimaryKey` options,
`.nullable()` becomes `nullable: true`, `.default(1)` and `.defaultRaw(...)` and
`.length(3)` and `.index('...')` keep their names. Checked end to end: the block above
resolves to `int` / `int` / `varchar(255)` / `datetime(3)` / `float` / `int` with the
declared column names, and emits the same `create table` and named index as today.

The decorated class is the only exported symbol. `MikroOrmModule.forRoot({ entities:
[Transaction, ...] })`, `em.find(Transaction, ...)`, and `EntityRepository<Transaction>`
all take it. The paired `class Transaction` / `const TransactionSchema` export that the
`defineEntity` style forced goes away, along with the `*Schema` imports in
`src/entities/mikro-orm.module.ts`.

**One thing the collapse costs, and it is easy to miss.** With `defineEntity`, the
optionality of a defaulted column lived in the schema object and the plain class stayed a
plain class. With decorators there is only the class, so a column the database defaults
(`userId`, `date`) has to be marked `& Opt` for `em.create()` and `em.persist()` to treat
it as optional. Omit it and the entity still reads correctly - the break only shows up as
a spurious "missing required property" type error at the one insert site in Epic 5's
transaction domain. Mark it during the conversion, not when it bites.

**Every property carries an explicit `type` (or `columnType`), and no
`metadataProvider` is registered.** Verified: with an explicit `type` on every property,
discovery resolves with no metadata provider configured at all, and
`@mikro-orm/decorators` declares its `reflect-metadata` peer as optional. The alternative
is to import `ReflectMetadataProvider` from the `/legacy` entry and let MikroORM read
`design:type` from `emitDecoratorMetadata`. Rejected: it makes correct column typing
depend on a compiler flag that exists for Nest's DI rather than for the ORM, and
reflected `design:type` cannot express the distinctions this schema turns on anyway -
`float` vs `double`, `decimal` precision, `varchar` length, MySQL `DATE` vs `DATETIME`.
D13 already demands that level of explicitness. The failure mode if a `type` is forgotten
is loud and immediate, not silent:
`Please provide either 'type' or 'entity' attribute in Entity.property`.

**The `name`-vs-`fieldName` trap survives the style change. Use `fieldName`, never
`name`.** This was the sharpest finding of the original spike and it was not
`defineEntity`-specific. `PropertyOptions.name` is documented as an alias for
`fieldName`, but `EntitySchema.renameCompositeOptions` only promotes `name` to
`fieldName` when the two differ (`EntitySchema.js:407`). Re-verified in the decorator
style on 7.1.13: `@Property({ name: 'coinName' }) coinName!: string` resolves to
`fieldNames: ['coin_name']` - the option is silently discarded and the underscore naming
strategy fills in a column that does not exist. `select *` hydration hides this; it
surfaces only once a column name reaches the SQL, as
`ER_BAD_FIELD_ERROR: Unknown column 't0.coin_name'`. `fieldName` is unconditional and
always correct. In the same run, `@Property({ fieldName: 'token_info_id' })` and
`@Property({ fieldName: 'coinName' })` both mapped 1:1, and `orm.schema` emitted the
expected DDL against the declared column names.

Two v7 API facts that will otherwise waste story time, both still true and both
style-independent:

- The schema generator is **`orm.schema`**, not `orm.getSchemaGenerator()`.
- **`getMetadata().getAll()` returns a `Map` keyed by the entity class**, not an object
  keyed by entity name. That is the mechanism behind the original observation that it
  "returns `{}`": `Object.keys()` on a `Map` is `[]`, and `.has('Transaction')` is
  `false` because the keys are constructors, not strings. `.get(name)`,
  `.getByClassName(name)`, and `.find(EntityClass)` all return real post-discovery
  metadata with resolved `fieldNames`. An FR-12 completeness check written as
  `Object.keys(getAll())` would silently pass on nothing; write it as
  `[...getAll().values()]` or per-entity via `.get()`. Note that `.get()` is typed
  `EntityName<T>`, so passing a bare string needs a cast even though it works at runtime.

### Entity creation: generate once as a seed, then own the output

Run `@mikro-orm/entity-generator` **once**, against the live MySQL 5.7 database, during
story 3.1. Review its output, hand-tune it, commit the tuned result as source of truth,
and then never run the generator again - not in CI, not from a package script.

The reason to generate rather than hand-write is that the DB holds facts that
`schema.prisma` does not make obvious, and hand-writing would get them subtly wrong:
`Float @db.Float` is MySQL `float`, not `double`; `NetCashFlow` uses a `DATE` column as
its primary key; `TokenPriceHistory` declares no `@id` at all in Prisma, only a composite
unique on `(date, token_info_id)`, so what MySQL actually has there must be *observed*.
The reason not to keep regenerating is that generated output is verbose and unidiomatic,
and treating it as a regenerable artifact means every hand refinement gets destroyed on
the next run.

Capture the raw generator output verbatim in story 3.1 as evidence of what the database
actually contains, before any tuning. Stories 3.2 and 3.3 then verify each entity by
reading real rows.

**Run the generator with `entityDefinition: 'decorators'`, `decorators: 'legacy'`,
`scalarTypeInDecorator: true`, and `namingStrategy: EntityCaseNamingStrategy`.**
`GenerateOptions` in `@mikro-orm/core@7.1.13` carries
`entityDefinition?: 'decorators' | 'defineEntity' | 'entitySchema'` and
`decorators?: 'es' | 'legacy'`, so the generator emits the chosen style directly and D12's
seed-then-own strategy is unaffected by the reversal. `scalarTypeInDecorator` puts the
explicit `type` in the decorator options rather than leaning on reflection, which is what
the section above requires.

The naming strategy still matters. Under the default strategy the generator camelCases
and underscores its way to output that is further from D13 (`close_price` becomes a
`closePrice` property). With `EntityCaseNamingStrategy` the property keys match the
columns. Note that the decorator emitter writes `fieldName` **only where the column
differs from what the naming strategy would derive** (`SourceFile.js:784`), so D13's
"explicit on every property" is still a hand-tuning step, not something the generator
gives you. What it does not do is emit the poisoned `name` option - that mapping is
specific to the `defineEntity` emitter (`DefineEntitySourceFile.js:128`), which is why
the trap above is now a review rule rather than a mechanical conversion task.

Two things the generator gets wrong on this schema, both already-known risk areas:
it derives relation properties (`token_info_id` becomes a `tokenInfo` property typed
`Ref<TokenInfo>`, which breaks D13 and would change the JSON shape FR-3 pins), and it
**invents a primary key for `TokenPriceHistory`**, which has none in MySQL - it emitted
a composite `['date', 'tokenInfo']` under one config and a bare `'date'` under another.
Story 3.1 owns resolving both against observed database facts, not generator output.
`entityGenerator: { scalarPropertiesForRelations: 'always' }` emits the scalar FK column
alongside the relation, which is a useful starting point for the D13-compliant form.

**Property naming mirrors the database exactly.** `token_info_id` stays `token_info_id`;
`coinName` stays `coinName`. Every property carries an explicit `fieldName` and no naming
strategy is relied on for anything. Two reasons: some of these names flow straight
through into JSON responses that FR-3 pins byte-for-byte, and the owner already knows
these names. A camelCase naming strategy would be prettier and would add a translation
layer to hold in your head in exchange for nothing.

`OuathToken` keeps its misspelling. Renaming it would be a schema change under FR-13. It
gets an entity per FR-12 and carries no behavior.

### Keeping MikroORM away from DDL

A config flag is the weak version of this guarantee. The strong version:
**`@mikro-orm/migrations` is never installed in `backend/` at all.** If the package is
absent, `mikro-orm migration:create` cannot be run by accident regardless of what any
config file says. Prisma remains the sole DDL owner and continues to live in `frontend/`
with its existing `package.json` schema pointer.

One diagnostic is permitted and encouraged: **`mikro-orm schema:update --dump`** as a
manual, never-applied drift check in story 3.3. It prints the DDL that *would* reconcile
the entities to the live database and touches nothing. Empty output is the cheapest
possible proof that FR-12 holds.

Confirmed to still work on v7 with `@mikro-orm/migrations` absent: the schema generator
lives in the SQL driver package, needs no extension registration, and is reachable in
code as `await orm.schema.getUpdateSchemaSQL({ safe: true })` if the story prefers a
script over the CLI. Only the CLI itself (`@mikro-orm/cli`, which does publish a 7.1.11)
is an extra dev dependency.

### Request context, identity map, and EM forking

MikroORM's EntityManager keeps an **identity map** (a cache of entities loaded through
it) and a **unit of work** (pending changes flushed together). A single EM shared across
all HTTP requests means that cache grows without bound, and - far worse - request A's
unflushed changes get written to the database by request B's `flush()`. The fix is a
per-request child EM, called a *fork*.

**Decision: `@mikro-orm/nestjs` with its `MikroOrmMiddleware`.** The middleware
establishes an AsyncLocalStorage-backed `RequestContext` per request, so an injected
`EntityManager` transparently resolves to that request's fork. Domain services carry no
fork bookkeeping and receive the EM by constructor injection, which is exactly what
NFR-1 asks for.

Rejected: manual `em.fork()` in every service (boilerplate that will eventually be
omitted in one place, and the resulting bug is a cross-request data leak that is
extremely hard to see), and Nest request-scoped providers (`Scope.REQUEST` is contagious
- every controller and transitive dependency becomes request-scoped, with real
instantiation cost - and buys nothing over AsyncLocalStorage here).

Unaffected by v7 - `@mikro-orm/nestjs@7.0.2` still exports `MikroOrmMiddleware`, and a
Nest 11 app built with `module: commonjs` was verified end to end against the real MySQL
5.7 schema: two successive requests got EM ids 5 and 7, both distinct from the root EM's
id 2. **One required detail:** `MikroOrmModule.forRoot()` must be passed an explicit
`driver: MySqlDriver`. The module only registers the driver-specific EM class as a DI
token when it can construct the driver from the options (`mikro-orm-core.module.js:86`),
and without it, injecting `EntityManager` from `@mikro-orm/mysql` (which is
`SqlEntityManager`) fails at bootstrap with `Nest can't resolve dependencies`. Injecting
the core `EntityManager` would work, but loses the driver's SQL-specific typing.

**`@mikro-orm/core` is ESM-only** (`"type": "module"`, no CommonJS build), and so is
`@mikro-orm/decorators`. The CommonJS Nest build consumes both through Node's
`require(esm)` support, which is why the Node 24 floor in D26 is load-bearing beyond
`engines`. This works and was verified with a real `tsc` emit, with one constraint:
**no top-level `await` anywhere in backend source**, since `require(esm)` cannot load a
module that has any. Bootstrap stays inside an `async function bootstrap()`, which is
Nest's default shape anyway.

**A second, less obvious floor: TypeScript 5.8 or newer.** The backend moved to
`module: nodenext` in story 3.1 and has no `"type": "module"`, so its files are CommonJS.
Importing an ESM-only package from a CommonJS file under `nodenext` is
`TS1479: ... cannot be imported with 'require'` on TypeScript 5.7 and earlier; 5.8 taught
the compiler about Node's `require(esm)` and the error went away. Reproduced both ways
while verifying the decorator style. The backend resolves `typescript@5.9.3` today, so
this holds, but the `^5.7.3` range in `backend/package.json` **permits an install that
does not compile**. Story 3.1 should raise that floor to `^5.9.0`.

### Porting `dbService.ts` - a deliberate split

`dbService.ts` is roughly fifteen `$queryRaw` calls, many with nested subqueries and
aggregates. Very little of it is entity-shaped. The port splits by query character:

- **Verbatim into `em.getConnection().execute()`** for the gnarly aggregate queries -
  the portfolio and summary rollups, the exchange-rate `MAX(date)` subqueries, the
  time-frame P/L computations. For these, the SQL *is* the contract that FR-3 pins.
  Rewriting them while simultaneously proving byte-for-byte parity would be two risky
  changes stacked on each other.
- **ORM / `EntityRepository`** for the simple ones - transaction insert and delete,
  user lookup by username, token-info finds and search, exchange-rate finds. This is
  where an ORM earns its keep, and it is where the MikroORM learning objective actually
  gets exercised.

**Named risk - raw deserialization drift.** Prisma's `$queryRaw` and MikroORM's raw
`execute()` do not deserialize MySQL types identically. `COUNT(*)` can arrive as a
`BigInt`; decimal and float columns can arrive as strings under one driver and numbers
under the other. Serialized into JSON, a `BigInt` throws and a numeric string renders as
`"123.45"` instead of `123.45`. This is a silent FR-3 parity break that compiles cleanly
and only surfaces in NFR-4's per-domain diff. **Every Epic 5 story must check the runtime
JS type of every field it returns, not just its value.** Where drift is found, coerce at
the repository boundary and record the coercion in the story.

**One instance of this is already confirmed, ahead of Epic 5.** MikroORM 7 maps a MySQL
`DATE` column to a JS **string** (`'2026-01-01'`), where Prisma returns a `Date` that
serializes to `'2026-01-01T00:00:00.000Z'`. This hits `NetCashFlow.date` - a `DATE`
primary key - and `TokenPriceHistory.date`. Story 3.2 or 3.3 should decide the coercion
once, at the entity or repository boundary, rather than leaving each Epic 5 story to
rediscover it. On the reassuring side, the same probe found `COUNT(*)` arriving as a JS
`number` (not `BigInt`) and `float` columns as numbers (not strings) through
`em.getConnection().execute()`, so the two loudest predicted failure modes did not
reproduce on MySQL 5.7. That is a spot check on one table, not a clearance.

---

## Integration Points

### Session design

The full decision set, with FR/NFR traceability.

| Aspect | Decision | Traces to |
| --- | --- | --- |
| Topology | Same origin, path prefix `/backend`, Nest global prefix `/backend/api` | NFR-3, FR-19 |
| Token | Stateless JWT, no server-side session store | FR-13, FR-8 |
| Algorithm | **ES256** (ECDSA P-256 / SHA-256), asymmetric | FR-6, ownership model |
| Library | Nest signs and verifies with `@nestjs/jwt`; Next verifies with `jose` - see below | FR-8, F1 |
| Transport | httpOnly cookie `portfolio_session`, `Secure`, `SameSite=Lax`, `Path=/` | FR-8 |
| Lifetime | Single token, `exp` = 8h or 30d from the injected clock, cookie `Max-Age` matched | FR-7 |
| Expiry style | Non-sliding - `exp` fixed at sign-in, never extended | FR-3 parity with today |
| Logout | Cookie clear only; `jti` claim carried for future revocation | FR-10 |
| Session read in Next | Local verification with the public key, no network hop | FR-8, F1 |
| CORS | None. Does not exist in this design. | consequence of topology |

**Why asymmetric at all.** The reason is concrete rather than theoretical: the entire
point of this initiative is that **NestJS owns the session**. With HS256 the verify key
*is* the sign key, so giving Next what it needs to verify would also give it what it
needs to issue - partially dissolving the very boundary the migration exists to draw.
Next must be able to verify and must not be able to mint.

Recorded honestly: on a single-host Compose stack where both containers read the same
`defaults.env` / `override.env` pair, this separation is **partly architectural hygiene
rather than a hard security boundary** - an attacker with the host has both files. It is
kept because it is nearly free and because it makes the ownership model true in the code
rather than only in the documentation.

**Why ES256 specifically.** ES256 is ECDSA over P-256 with SHA-256. Alongside RS256 it is
the most widely deployed asymmetric JWT algorithm and what most modern OIDC providers
sign with, so it is the boring, well-trodden choice for a load-bearing auth path - which
is what this is. EdDSA / Ed25519 was considered and rejected: it was not part of the
original WebCrypto specification and runtime support for it is more variable, which is
exactly the wrong property for code that gates every page navigation through Edge
middleware. ES256 has been in WebCrypto from the start and is universally supported,
including in the Edge runtime.

**Library split: the backend uses `@nestjs/jwt`, the frontend uses `jose`.** ES256 keeps
both halves available, so the idiomatic option holds on each side. Each side therefore has
its own verify implementation - the backend's inside `SessionService`, the frontend's in
`frontend/src/auth/session.ts` - and that duplication is forced by the runtime, not
chosen. Epic 12 relocated that file from `frontend/src/server/` (D64); nothing about the
split moved with it.

- **Backend signs and verifies with `@nestjs/jwt`.** Verified from source: `@nestjs/jwt@11.0.2`
  depends on `jsonwebtoken@9.0.3`, whose signing backend `jwa@2.0.0` enumerates its
  supported algorithms as
  `"HS256", "HS384", "HS512", "RS256", "RS384", "RS512", "PS256", "PS384", "PS512", "ES256", "ES384", "ES512" and "none"`.
  ES256 is on that list. This keeps the Nest-idiomatic, DI-friendly module on the backend
  side, which is on the learning path for this initiative.
- **Frontend verifies with `jose`, and this is forced by the runtime, not by the
  algorithm.** Stating the reasoning explicitly so a future reader does not try to
  "simplify" by swapping in `jsonwebtoken`: per F1, `src/middleware.ts` runs in the Edge
  sandbox, which exposes Web-standard globals only and has no `node:crypto` module.
  `jsonwebtoken` is built on `node:crypto` and cannot load there at all. `jose` is
  runtime-agnostic and uses WebCrypto on that path. **This would still be true if the
  algorithm were HS256.**

**Preventing drift between the two libraries.** The algorithm name, the cookie name, and
the claim type are declared once, in `packages/shared`, and imported by both sides. The
verifying code itself is **not** shared - each side verifies with its own library, for the
runtime reason above - so the shared constants are what keep the two implementations
agreeing. Both pin `algorithms: ['ES256']` explicitly rather than accepting whatever the
token's own header claims - without that pin, a token header is attacker-controlled input
and an algorithm-confusion downgrade becomes possible. **Never verify with the algorithm
list left open.**

**`jose` version pin: `6.2.9`** - the current major. An earlier draft pinned `5.10.0`
because jose 6 targets Node 20+ and the frontend was then on Node 18; D26e removed that
constraint. jose is declared in `frontend/package.json` and nowhere else - the backend
signs with `@nestjs/jwt` and `packages/shared` has no runtime dependencies at all - so
this pin constrains the frontend only.

**Key handling, concretely.**

- **Generation** - a one-off openssl invocation, documented as a snippet in the README;
  keys are never committed. Verified working:
  ```
  openssl ecparam -name prime256v1 -genkey -noout -out es256.key
  openssl pkcs8 -topk8 -nocrypt -in es256.key -out es256-private.pem   # PKCS#8
  openssl ec -in es256.key -pubout -out es256-public.pem               # SPKI
  ```
- **Format - JWK, not PEM.** Both keys are converted to JWK for storage. A JWK serializes
  to a single line of JSON with no embedded newlines, which is what lets it survive
  `defaults.env` / `override.env` and Docker Compose `env_file` intact. PEM's
  `-----BEGIN-----` block with hard line breaks does not survive that path without
  escaping, and escaped-newline env values are a well-known source of failures that
  reproduce only inside the container. The backend converts its JWK back to a `KeyObject`
  at bootstrap for `@nestjs/jwt`; the frontend imports its JWK with `jose.importJWK`, or
  directly via `crypto.subtle.importKey('jwk', ..., { name: 'ECDSA', namedCurve: 'P-256' })`
  on the Edge path.
- **Env vars** - `SESSION_PRIVATE_KEY_JWK` holds the P-256 private JWK and is supplied
  **only** to the `nest-api` container. `SESSION_PUBLIC_KEY_JWK` holds the public JWK and
  is supplied to both containers. **The public key being readable by the frontend is
  fine, and is the point** - it is public by construction, and its presence there is what
  makes local verification possible without handing over the ability to issue.
- **Runtime support.** ECDSA P-256 is part of the original WebCrypto specification and is
  supported by Node's WebCrypto (verified on the local Node build) and by the Edge
  runtime. Per F1, Next 14.0.1's edge sandbox binds `crypto` to Node's `webcrypto`, so
  middleware inherits the host Node's ECDSA support. **Verified end to end on the real
  framework version:** a Next 14.0.1 Edge middleware running on Node 24 completed an
  ECDSA P-256 sign-and-verify through the sandbox's WebCrypto. Both packages run Node 24,
  and ES256 is supported on every Node line in any form of support, so this holds across
  the scheduled base-image bumps noted under Deployment.
- **One check not executed at design time.** End-to-end cross-library interop -
  `@nestjs/jwt` signing a token that `jose` then verifies through a WebCrypto
  `CryptoKey` - was not run during this phase. Every component of it is independently
  confirmed (jwa lists ES256; openssl produces the keys; ECDSA P-256 is standard
  WebCrypto), and ES256 is a fully specified interoperable JWS algorithm, so this is
  expected to be uneventful. **Story 4.8 must demonstrate it explicitly rather than
  assume it**, including from the Edge middleware path and not only from a server
  component.

**Claims.** Mirrors what NextAuth packs today (`src/server/auth.ts:82-96`) so the flip is
shape-preserving:

```
{ sub: <userId>, username, email, name, rememberMe, jti, iat, exp }
```

`jti` is included from day one even though nothing reads it. It costs a few bytes and it
means a Redis denylist can be added later without a token-format change or a forced
re-login for everyone. That is cheap insurance against the one real weakness of the
stateless design.

**The session shape callers see (FR-9)** is produced by an explicit whitelist mapper, not
by spreading the claims:

```
{ isAuthenticated: true, user: { id, username, email, name } }
```

`rememberMe`, `jti`, `iat`, and `exp` never leave the backend, exactly as
`src/server/auth.ts:115-132` whitelists today.

**Why Next verifies locally rather than calling `GET /auth/session`.** Local verification
with the public key costs no network hop per render, and - decisively, per F1 - Edge
middleware runs on every matched navigation, where an HTTP call to Nest would add latency
to every page transition and couple page rendering to backend availability. Nest's
`GET /backend/api/auth/session` endpoint still exists (stories 2.4, 4.6) as the canonical
FR-9 shape and as the client-side replacement for `useSession`. This is precisely why
`packages/shared` exists: because both sides read the same token independently, the
**claim contract** - the payload type, the algorithm name, the cookie name - is a
genuinely shared *concern* rather than a shared shape of code. The verification code is
not shared; each runtime has its own (see the library split above).

**Why not a refresh-token pair**, recorded so it does not resurface: it is the modern
default, but it needs a refresh endpoint, rotation, a concurrent-refresh race, and a
revocation store - and it does not match FR-7's semantics, where `rememberMe` controls
*how long you stay logged in*, not access-token lifetime. A single token whose `exp` is
8h or 30d is a direct mirror of `src/server/auth.ts:103` and satisfies the requirement as
written.

### `packages/shared` - scope and build

Contents, and nothing else:

- `SessionClaims` - the JWT payload type.
- `SessionUser` / `Session` - the FR-9 whitelisted shape.
- `SESSION_ALGORITHM` (`'ES256'`) and `SESSION_COOKIE_NAME` (`'portfolio_session'`) as
  exported constants, so the two signing/verifying libraries cannot drift apart on either.

**One entry point, and zero runtime dependencies.** The package root exports only types
and constants, and imports nothing. Both sides import that root; neither pulls anything
transitive from it.

**The verify helper is not here - it lives in `frontend/src/auth/session.ts`.** An
earlier draft of this document put a `jose`-based `verifySessionToken` in the shared
package behind a `./verify` subpath. It was moved during Epic 4's review, on the owner's
decision, because it had exactly one consumer: the backend verifies through its own
`SessionService` using `@nestjs/jwt` and never imported it. A single-consumer module in a
shared package is a shared *shape of code*, not a shared concern, and it was the only
thing forcing a runtime dependency and a second entry point into a package that otherwise
needs neither. `jose` is now a direct dependency of `frontend/` alone. Nothing about the
runtime design changed: the frontend still verifies locally with the public key in Edge
middleware and server components, and the ES256 pin is still explicit on both sides.

**Its exact path changed; the fact that it is frontend-owned did not.** Epic
12 moved it to `frontend/src/auth/`, beside the rest of the auth seam (D64). It is cited as
`frontend/src/auth/session.ts` throughout this document; what this section asserts - that
the verify helper is outside `packages/shared` - holds on both sides of the move.

Explicitly **not** in it: response DTOs. Those carry `@ApiProperty` decorators and
`@nestjs/swagger` imports, so sharing them would drag Nest into the frontend bundle, and
retyping a dozen React Query hooks against them is exactly the frontend refactor the PRD
forbids (out-of-scope list; success criterion 10).

**It gets a small `tsc` build** (`main`/`types` pointing at `dist/`). The zero-build
alternative - raw TS consumed via `transpilePackages` in Next and tsconfig paths in Nest
- sounds simpler but is fiddly on the Nest side, where `tsc` resists emitting from
outside `rootDir`. Five lines of build config makes the package boring, which is what
infrastructure should be.

### The generated response-type pipeline (FR-20 to FR-23, NFR-6)

> **This whole section is superseded. It is kept because Epic 9's shipped stories cite
> it.** Epic 10 first replaced what happened *after* the snapshot - `openapi-typescript`,
> `frontend/types/api.d.ts` and the hand-written `frontend/types/contracts.ts` all left the
> repo and Orval took their place. Then three rounds of owner feedback inside Epic 10
> removed the snapshot pipeline itself: `backend/openapi.json` and
> `scripts/generate-api-contract.mjs` are deleted, the three `spec:*` scripts collapsed to
> one, and **no staleness check exists anywhere**. So preview-mode generation, the
> pretty-printed snapshot, `--check`, `--only=`, `spec:watch`, and the two-link enforcement
> geometry all describe a repo that no longer exists.
>
> What survives from this section, still live and still load-bearing: **the shared
> `DocumentBuilder` configuration and `GLOBAL_PREFIX` in `backend/src/openapi/`** (D36),
> because the live `/backend/docs-json` Orval now reads is served through `main.ts` and its
> paths carry the global prefix; and **`TimeFrame` as a generated enum** (D42), which is a
> backend-source decision independent of who generates what from it. Read
> "The generated API client as it shipped" for what is true now. D35, D37, D39, D45, D47,
> D55 and D56 carry the same marker.

Epic 9 makes the backend's OpenAPI document the only place a response shape is written
down. Three files carry the whole design, two of them generated and committed:

| Path | Produced by | Edited by hand? | After Epic 10 |
| --- | --- | --- | --- |
| `backend/openapi.json` | preview-mode generation from `backend/dist` | **Never** | **Deleted** (Epic 10 fix round) |
| `frontend/types/api.d.ts` | `openapi-typescript` over that snapshot | **Never** | Deleted (story 10.3) |
| `frontend/types/contracts.ts` | a person | Yes - it is aliases only | Deleted (story 10.6) |
| `frontend/src/api/generated.ts` | Orval over the **live** `/backend/docs-json` | **Never** | New |
| `frontend/src/api/http-client.ts` | a person | Yes - it is the mutator | New |

Both generated files carry a header comment naming the command that produces them.

#### Producing the snapshot without a database (NFR-6)

**The document is built in Nest's preview mode, from the compiled `dist`, and written to
`backend/openapi.json`.** Preview mode (`NestFactory.create(AppModule, { preview: true })`)
registers every module and controller but instantiates no providers, so nothing opens a
MySQL connection, nothing reads Redis, and no configuration validation runs. Generation
from `dist` rather than from `src` means the pipeline needs no TypeScript loader at all -
`nest build` has already produced JavaScript, and the generator is a plain `node` process.

Verified end to end against the real backend on this branch, not reasoned about:

- With `DATABASE_URL` pointed at a dead port (`127.0.0.1:1`), generation **succeeded** and
  emitted all 22 paths and 19 component schemas. With **no environment variables set at
  all**, it also succeeded - preview mode never instantiates `AppConfigService`, so its
  validation never runs.
- Two consecutive runs on unchanged source produced **byte-identical** output (45,641
  bytes), which is the precondition story 9.2 names for the FR-21 diff to mean anything.
- `openapi-typescript@7.13.0` over that snapshot emitted a 1,355-line `api.d.ts` with no
  warnings, including the arbitrary-key map of `time-frame-coins-pl` as
  `{ [key: string]: components["schemas"]["TimeFrameCoinsPlEntryDto"] }`.

**`SWAGGER_ENABLED` is not consulted.** NFR-6 warns that the flag gates document
construction in `main.ts` and that the generator must not silently emit an empty document
when it is off. The generator does not go through `main.ts` at all, so the flag is
structurally incapable of reaching it. That is the reason to prefer a separate entry point
over an "export the document on boot" hook, and it is worth stating rather than leaving as
a happy accident.

#### One DocumentBuilder configuration, imported twice

`main.ts` and the generator must not drift, or the committed snapshot documents an API
that differs from the one Swagger UI serves - and the drift would be invisible, because
each side would be internally consistent. **`backend/src/openapi/` exports the
`DocumentBuilder` configuration and the `GLOBAL_PREFIX` string; `main.ts` and the
generator both import them.** Neither value is written twice anywhere.

The global prefix has to be in there with the config. `SwaggerModule.setup()` is
independent of `setGlobalPrefix`, but the *paths in the document are not* - they are
prefixed. Confirmed in the verification run above: the generator only produced
`/backend/api/summary/coins` because it called `setGlobalPrefix('backend/api')` before
`createDocument`. Omit that line and every path in the snapshot loses its prefix while the
running service keeps it, which is exactly the silent divergence the shared module exists
to prevent.

#### The snapshot is pretty-printed JSON

`JSON.stringify(document, null, 2)` with a trailing newline, not minified. The snapshot's
whole job is to be diffed - by the FR-21 check, and by a human reading the diff in a
review to see which field changed. A single-line 45KB file makes both useless. The cost is
file size in a repo where nothing is size-sensitive.

#### Consumers import named aliases, not index expressions

> **Superseded by Epic 10 (D38, D50).** Orval emits named model types and named operations
> directly, so there is no namespace to index and nothing left for an alias file to do.
> `contracts.ts` is deleted in story 10.6. The *rule* the section exists for survives
> intact and is now enforced by the generator rather than by a human writing aliases:
> **a contract is never renamed in transit.** D50 carries it forward as the operationId
> naming convention.

`openapi-typescript` emits one nested namespace, so the type of a summary response is
`components['schemas']['CoinSummaryResponseDto']` and the type of the time-frame P/L map -
which has no component schema of its own, being an inline `additionalProperties` object -
is a five-level index into `paths`. Spreading those expressions across fifteen call sites
would be worse to read than the hand-declared types being replaced, which would undercut
the point.

`frontend/types/contracts.ts` is a hand-written alias surface, one line per shape:

```ts
import type { components, paths } from './api';

export type CoinSummaryResponseDto = components['schemas']['CoinSummaryResponseDto'];
export type TimeFrameCoinsPlResponseDto =
  paths['/backend/api/time-frame-coins-pl/{timeFrame}']['get']['responses'][200]['content']['application/json'];
```

Two rules make this safe rather than a second hand-maintained copy:

- **An alias declares no structure.** It resolves to the generated type or it fails to
  compile. Renaming a DTO field cannot survive here; deleting a DTO breaks the alias
  immediately.
- **The alias name is the DTO name, verbatim.** `CoinSummaryResponseDto`, not
  `CoinSummary` and not the old `CoinSummaryResp`. One grep finds the backend class, the
  schema, the alias, and every consumer. Renaming in transit is exactly the habit FR-20
  exists to end.

#### Scripts, and where they live

The pipeline crosses both packages, so it is owned by the workspace root rather than by
either side. `openapi-typescript` is a **root** devDependency; the frontend gains no
dependency at all, because `api.d.ts` is a declaration file with no runtime import.

> **Superseded by Epic 10 as shipped.** `orval` did briefly take that root devDependency
> slot, and `openapi-typescript` is gone. But the pipeline no longer crosses both packages:
> its input is a URL, so nothing at the root has a claim on it. `orval`, `orval.config.ts`
> and the single `spec:generate` script all live in `frontend/`, and the root
> `package.json` now holds only `packageManager`. `spec:check` and `spec:watch` do not
> exist. See D61. **The frontend's one dependency note still holds**: the generated hooks
> import from `@tanstack/react-query`, which `frontend/package.json` already declares at
> `^5.62.0` - and after the config move that declaration is also what decides which
> react-query API surface Orval emits (D61).

| Script (root) - **all three superseded; one `spec:generate` in `frontend/` replaces them** | Does |
| --- | --- |
| `pnpm spec:generate` | build backend, write `openapi.json`, write `api.d.ts` |
| `pnpm spec:check` | the same, but writes nothing and exits non-zero if either file on disk differs |
| `pnpm spec:watch` | the same as `spec:generate`, on every change under `backend/src` |

All three run **one** script file. `spec:check` is that script with `--check`, and
`spec:watch` is that script behind `node --watch-path=backend/src`. There is no second
generation path that could behave differently from the one whose output gets committed.

The script has **two independently runnable halves**, selected with `--only`:

| Invocation | Reads | Produces or checks |
| --- | --- | --- |
| `--only=spec` | `backend/dist` | `backend/openapi.json` |
| `--only=types` | `backend/openapi.json` | `frontend/types/api.d.ts` |

> **Superseded by Epic 10 as shipped (D56).** There is no script file, no `--only` split
> and no `--check`. `scripts/generate-api-contract.mjs` is deleted. The whole toolchain is
> `frontend/orval.config.ts` invoked by one script,
> `"spec:generate": "orval --config orval.config.ts"` in `frontend/package.json`. The
> constraint this subsection existed to protect - that the frontend half must run with no
> `backend/dist` and no backend source present - is moot, because nothing generates
> anything inside an image any more.

Default is both, in that order, which is what the three root scripts use. The split exists
because the enforcement points each hold only half the repo - see "Where the staleness
check runs" below. **`--only=types` must not touch `backend/dist` or import anything from
`backend/`**, or it cannot run in the frontend image; the backend tree is not there. That
is a hard constraint on how the script is written, not an incidental property.

**`--check` compares generated bytes against the file on disk. It does not shell out to
git.** This is a change from an earlier draft that used `git diff --exit-code`, and the
reason is that the check now also runs inside Docker builds, where the root
`.dockerignore` excludes `.git` from every build context - a git-based comparison is structurally
impossible there. One comparison mechanism everywhere beats two that can disagree.

The cost is worth stating: on the host, `spec:check` now passes against a *regenerated but
uncommitted* working tree, where the git version would have failed. That is acceptable
because the gate that actually blocks anything is the image build, and **a Docker build
context is the working tree, not the commit** - so the image check tests exactly the bytes
`--check` compares. `git status` covers the remaining gap and the CI that would have
checked the commit does not exist by decision.

Failure output names the offending path and instructs the reader to run `pnpm
spec:generate` and commit the result, which is story 9.4's stated acceptance.

#### Watch mode runs on the host, and needs no second compiler

> **Superseded by Epic 10 as shipped (D45).** There is no `spec:watch`. Orval's `--watch`
> watches files and its input is a URL, and a watcher pointed at the backend's live spec
> would race the backend's own hot-reload. Regeneration is a deliberate two-step act:
> `docker compose up -d nest-api`, then
> `pnpm --filter @portfolio/frontend spec:generate`. Nothing prevents drift and nothing
> detects it - see D63 for what carries that risk instead.

The dev container mounts `./backend/src:/app/backend/src` and nothing else. Both generated
artifacts live outside that path - one at `backend/openapi.json`, one under
`frontend/types/` - so anything generated inside the container cannot reach the working
tree the developer commits from. **The watcher therefore runs on the host, and Compose is
unchanged.**

The container was considered properly and loses on more than the mount count. The backend
image contains no frontend tree at all - `backend/Dockerfile` copies `backend/`,
`packages/shared`, and the root manifests - so making the container the home for the
watcher means bind-mounting a slice of `frontend/` into the backend container purely so a
watcher can write there. Single-file bind mounts also break when the writing process
replaces the file rather than truncating it, which is what a temp-file-and-rename
generator does, so the mounts would have to be directories, which means relocating
`openapi.json` into a directory that exists only to be mountable. That is a lot of
structure to avoid running a command on the host.

The remaining question was whether to watch **source** or the **emitted `dist`**. Watching
`dist` is attractive inside the container, where `nest start:dev` is already compiling on
every change, so a `dist` watcher would ride a compile that is happening anyway. On the
host that advantage evaporates: nothing is compiling there, so a `dist` watcher needs its
own `nest build --watch` running alongside it - two processes, a concurrency runner
dependency, and an orphaned compiler after every Ctrl-C.

**A full `nest build` on this backend takes 1.9 seconds** (measured, warm), and preview-mode
generation about a second more. At that cost the incremental compile buys nothing worth a
second process, so the watcher rebuilds from scratch each time:

```
"spec:watch": "node --watch-path=backend/src scripts/generate-api-contract.mjs"
```

`node --watch-path` is built into Node 24 and needs no dependency - verified standalone on
this machine, re-running the script on a change under the watched path. It coalesces
rapid changes, so a multi-file save produces one regeneration. Because the watched script
*is* `spec:generate`, watch mode and the committed output cannot diverge.

**No `ts-node` and no `tsx` anywhere in this design.** `ts-node` type-checks by default
and fails on `src/auth/current-user.decorator.ts:7`, where `req.user` comes from the
`express-request.d.ts` global augmentation that `ts-node` does not load because nothing
imports it. `tsx` would very likely sidestep that - esbuild strips types without checking
them - but it was **not verified** here, and the `dist`-based design removes the question
entirely rather than answering it. If a source-based watcher is ever wanted, that
verification is the first step, not an assumption.

#### `TimeFrame` becomes a generated enum

Story 9.1 asks whether `TimeFrame` stays hand-declared as a request-side type or becomes
generated. **It becomes generated.** A `TIME_FRAMES` const in backend source is the single
declaration:

```ts
export const TIME_FRAMES = ['h', 'd', 'w', 'm', '3m', '6m', 'y', 'all'] as const;
```

applied as `@ApiParam({ name: 'timeFrame', enum: TIME_FRAMES, enumName: 'TimeFrame' })`.
`enumName` is what makes `@nestjs/swagger` emit a reusable `TimeFrame` component schema
and `$ref` it from each site, instead of inlining eight string literals four times over;
`openapi-typescript` then emits it as a named union that `frontend/types/contracts.ts`
aliases like any other shape. (After Epic 10, Orval emits the same named union directly and
there is no alias step - see D52, which pins `enumGenerationType: 'union'` precisely so that
call sites keep passing the string literals they pass today.) Without `enumName` the values would still be correct and the
frontend would still get a union, but there would be no single named type to import.

The four path params are `exchange-rates.controller.ts:9`,
`time-frame-total-pl.controller.ts:14`, `time-frame-coins-pl.controller.ts:26`, and
`summary.controller.ts:72`. The first three carry `example: '24h'`, which is not a member
of the union at all; the fourth already documents `'all'` correctly. All four are fixed in
the same edit, and the enum makes the wrong example unrepresentable rather than merely
corrected.

**Three further sites carry the same defect and belong in the same story.** They are not
in the PRD's list because it enumerated `@ApiParam` decorators only:

- `summary.controller.ts:48` - the `@ApiQuery` for `?timeFrame=`, the FR-4 twin of the
  path-param form and the variant the frontend actually calls
  (`Summary/TotalChart/Layout.tsx`). Documenting one form as an enum and its duplicate as
  a free string would be a contradiction inside one controller.
- `price-history/dto/set-price-history-request.dto.ts:16` - `timeFrame`, `example: '24h'`.
- `price-history/dto/price-history-check-response.dto.ts:9` - `timeFramesNeeded`,
  `example: ['24h', '7d']`.

The price-history pair are demonstrably `TimeFrame` values, not a different vocabulary
that happens to look similar: `frontend/src/app/api/price-history/check/route.ts:8`
declares `const timeFrames: TimeFrame[] = ['h', 'd', 'w', 'm', '3m', '6m', 'y', 'all']`,
and `useStorePriceHistory.ts` feeds each returned value straight back into `POST
/price-history/set`. Both get `enum: TIME_FRAMES, enumName: 'TimeFrame'` -
`isArray: true` on the response field.

#### `packages/shared` shrinks by deletion, not by migration (FR-22)

`Session` and `SessionUser` in `packages/shared/src/index.ts` have **zero consumers today**
- grep finds no import of either in `backend/src`, `frontend/src`, or the package itself.
Story 9.7 therefore deletes them outright; there is no consumer to move onto a generated
type first. What remains is `SessionClaims`, `SESSION_ALGORITHM`, and `SESSION_COOKIE_NAME`,
which is exactly FR-22's boundary.

The shape those two types described still exists and is still generated - it is the
`LoginResponseDto` that `GET /auth/session` returns - so nothing is lost. The reasoning
goes into the package's own source per story 9.7: what stays has no HTTP representation to
generate from.

### The generated API client as it shipped (FR-24, FR-25, FR-26, GR-6, GR-7)

Orval generates the frontend's whole API client from the backend's **live** OpenAPI
document. After Epic 10, no hand-written file sits between a backend DTO and the component
that renders it, and exactly one hand-written file - the mutator - performs HTTP.

The whole toolchain is two things: `frontend/orval.config.ts`, and
`"spec:generate": "orval --config orval.config.ts"` in `frontend/package.json`. There is
no generator script, no committed spec, and no check of any kind.

#### Files, and who writes them

| Path | Written by | Committed |
| --- | --- | --- |
| `frontend/orval.config.ts` | a person, once | yes |
| `frontend/src/api/generated.ts` | Orval | yes, never edited |
| `frontend/src/api/http-client.ts` | a person - the mutator, and the FR-25 seam | yes |

The generated client lives under `frontend/src/`, not under `frontend/types/`, because it
is runtime code rather than a declaration file: `generated.ts` exports functions and hooks
that ship in the bundle. Putting it beside the mutator it imports also makes the emitted
import specifier `./http-client`, which is the shortest and most stable form.
`frontend/types/` keeps `global.d.ts` and `react-table-config.d.ts` and loses the two Epic
9 files.

`mode: 'single'` - one file, not a `tags-split` directory tree. Twenty-two operations and
nineteen schemas is a small surface, and a directory whose file boundaries mirror
controller tags is structure to keep in step with the backend for no navigational gain.

#### Regenerating requires the stack up

Orval's input is a URL, so generation is not offline and not automatic (FR-26, NFR-6 as
narrowed):

```
docker compose up -d nest-api
pnpm --filter @portfolio/frontend spec:generate
```

`nest-api` publishes `127.0.0.1:3002:3001` in `docker-compose.yml` for exactly this
reason - see D27. `SWAGGER_ENABLED` must be on, which it is by default; it is the same
flag Swagger UI needs, and the document does not exist without it.

**Any story that changes a DTO regenerates and commits `generated.ts` in that same story.**
Nothing catches the omission - not a build, not a script, not CI - and the failure mode is
a renamed field that compiles clean and renders `undefined`. That is FR-26's discipline and
it is the deliberate cost of D62.

#### The configuration

```ts
// frontend/orval.config.ts - paths are relative to this file, not to the cwd
import { defineConfig } from 'orval';

export default defineConfig({
  portfolio: {
    input: { target: 'http://localhost:3002/backend/docs-json' },
    output: {
      mode: 'single',
      target: './src/api/generated.ts',
      client: 'react-query',
      httpClient: 'fetch',
      clean: false,
      tsconfig: './tsconfig.json',
      formatter: 'prettier',
      override: {
        mutator: { path: './src/api/http-client.ts', name: 'httpClient' },
        enumGenerationType: 'union',
        fetch: { includeHttpResponseReturnType: false },
      },
    },
  },
});
```

**The input is a URL - the live Swagger JSON, never a file on disk.** Host 3001 is
Grafana's, so `nest-api`'s loopback mapping publishes 3002 (D27).

**The config file lives in `frontend/`, and that is a correctness requirement, not
tidiness** - Orval resolves the `@tanstack/react-query` version it generates for from the
*nearest package.json to the config*. See D61.

These settings are load-bearing and are argued in D49 to D63. Three come with a failure
mode sharp enough to state here as well:

- **`clean: false`, and it must stay false.** `output.clean` deletes the target's directory
  before writing. The mutator is a sibling of the generated file in that same directory, so
  turning `clean` on deletes hand-written source - verified during the spike, where a run
  with `clean: true` removed `http-client.ts` outright. It is a reasonable default for a
  directory Orval wholly owns, and this is not one.
- **`tsconfig: './tsconfig.json'`, and it forces `frontend/tsconfig.json`'s `target` to
  stay at `es2017` or above.** Orval reads the mutator through esbuild, and the named
  tsconfig configures that transpile. `frontend/tsconfig.json` was `es5`, and esbuild
  **cannot downlevel `async`/`const` to es5** - it fails outright with five
  `Transforming ... to the configured target environment ("es5") is not supported yet`
  errors, verified in both directions. The target was bumped to `es2017`, which is safe
  because it is typecheck-only: `noEmit` is set, Next 14 compiles with SWC and never reads
  it, and no other tsconfig extends this one. **Dropping it back to `es5` breaks
  generation**, which is the non-obvious coupling to remember.
- **`formatter: 'prettier'`, and the output path is *not* in `.prettierignore`.** The two
  go together: the ignore entry would suppress the formatter Orval runs. `prettier: false`,
  which earlier drafts of this document printed, is not a field of orval 8.26's
  `OutputOptions` at all - it was a silently ignored no-op. See D53, reversed.
`frontend/.eslintignore` still lists the generated output. Lint has nothing to say about a
machine-written file, and that entry costs nothing.

#### Operation names are declared, not derived

`@nestjs/swagger` derives an operationId from the controller class and method -
`SummaryController_getCoins` - and every one of the 22 current operations carries a name of
that shape today. Orval turns that into `useSummaryControllerGetCoins()`, which names a
backend implementation detail at a frontend call site and changes if the controller class
is ever renamed.

**Every controller method therefore carries an explicit
`@ApiOperation({ operationId: '...' })`**, landed in story 10.1 before anything is
generated. The name is fixed in the spec itself, so Swagger UI, `/backend/docs-json`, the
generated client, and every consumer all agree, and D38's property survives the deletion of the file that used to carry it: **one
grep finds the controller method, the operationId, and every call site.**

The convention, so that story 10.1 applies a rule across all 22 rather than inventing
names one at a time:

1. **camelCase, and never contains the controller class name or a read's HTTP verb.**
2. **A read is named for what it returns**, using the response DTO's noun, pluralized when
   the response is an array: `CoinSummaryResponseDto[]` becomes `coinSummaries`,
   `PortfolioSummaryResponseDto` becomes `portfolioSummary`. This is what makes
   `/summary/coins` come out as `useCoinSummaries()` rather than `useSummaryCoins()`.
3. **A write is named verb-first for what it does**: `login`, `addTransaction`,
   `deleteTransaction`, `setPriceHistory`.
4. **Where two operations return the same shape, the parameter that distinguishes them is
   appended as `By<Param>`**: `coinSummaries` and `coinSummariesByUnit`,
   `profitLossChart` and `profitLossChartByTimeFrame`. The bare name goes to the variant
   the frontend actually calls today.
5. **Where the response has no DTO noun** - a bare string, or the arbitrary-key map - the
   path supplies the name: `exchangeRatesByUnit`, `timeFrameCoinsPl`.
6. **Where a hook already exists in the frontend, the generated name must read as its
   replacement.** `useCoinSummaries` and `useTimeFrameCoinsPl` are the same words the
   call sites already use, so adoption is a swapped import rather than a renaming exercise.

Orval emits, per operation, a function named for the operationId and a hook named
`use` + PascalCase of it. All 22:

| Method and spec path | `operationId` | Orval emits |
| --- | --- | --- |
| GET `/health` | `health` | `health()`, `useHealth()` |
| POST `/auth/login` | `login` | `login()`, `useLogin()` |
| POST `/auth/logout` | `logout` | `logout()`, `useLogout()` |
| GET `/auth/session` | `authSession` | `authSession()`, `useAuthSession()` |
| POST `/transaction/add` | `addTransaction` | `addTransaction()`, `useAddTransaction()` |
| DELETE `/transaction/{id}` | `deleteTransaction` | `deleteTransaction()`, `useDeleteTransaction()` |
| GET `/summary/coins` | `coinSummaries` | `coinSummaries()`, `useCoinSummaries()` |
| GET `/summary/portfolio` | `portfolioSummary` | `portfolioSummary()`, `usePortfolioSummary()` |
| GET `/summary/profitLossChart` | `profitLossChart` | `profitLossChart()`, `useProfitLossChart()` |
| GET `/summary/profitLossChart/{timeFrame}` | `profitLossChartByTimeFrame` | `useProfitLossChartByTimeFrame()` |
| GET `/summary/{unit}` | `coinSummariesByUnit` | `useCoinSummariesByUnit()` |
| GET `/stats/{unit}` | `statsByUnit` | `useStatsByUnit()` |
| GET `/product/{product}` | `productTransactions` | `useProductTransactions()` |
| GET `/exchange-rates/{timeFrame}/{coinName}` | `coinPriceHistory` | `useCoinPriceHistory()` |
| GET `/exchange-rates/unit/{unit}` | `exchangeRatesByUnit` | `useExchangeRatesByUnit()` |
| GET `/price-history/check` | `priceHistoryCheck` | `usePriceHistoryCheck()` |
| POST `/price-history/set` | `setPriceHistory` | `useSetPriceHistory()` |
| GET `/time-frame-coins-pl/{timeFrame}` | `timeFrameCoinsPl` | `useTimeFrameCoinsPl()` |
| GET `/time-frame-total-pl/{timeFrame}` | `timeFrameTotalPl` | `useTimeFrameTotalPl()` |
| GET `/token-info/{userId}` | `tokenInfoSync` | `useTokenInfoSync()` |
| GET `/token-info/search/{searchTerm}` | `tokenInfoSearch` | `useTokenInfoSearch()` |
| GET `/metrics` | `metrics` | `useMetrics()` |

Two entries in that table are deliberate rather than mechanical, and both would otherwise
be re-litigated in a story.

- **`authSession`, not `session`.** `session` would emit `useSession`, which is the name of
  `next-auth/react`'s own hook - live in `LoginClient.tsx` and the nav components, and
  required by FR-11 to keep working until Epic 7 flips story 6.2's seam. Two different
  `useSession` imports coexisting during the exact window where the question "which session
  system is this?" is the one that matters is a confusion a generated name should not
  create.
- **`coinPriceHistory`, not `priceHistory`.** The operation lives under `/exchange-rates/`
  but returns `PriceHistoryResponseDto`, and `/price-history/check` is a different operation
  in a different controller. Rule 2 would collide the two; the coin qualifier separates them
  and matches the existing `useFetchCoinPriceHistory` call site.

#### The mutator, and the FR-25 seam

`frontend/src/api/http-client.ts` exports one function that every generated operation
calls. It does three things and nothing else: it maps the spec path onto the origin in
force, it performs the request, and it converts a non-2xx response into a thrown error.

**The seam cannot be Orval's `baseUrl`.** Verified during the spike, and it is the finding
the whole seam design turns on: `output.baseUrl` **prepends** a string to the spec path and
has no ability to remove one. The spec's paths carry the backend's global prefix
(`/backend/api/summary/coins`) while the frontend today calls `/api/summary/coins`, so
during coexistence the seam must *strip* `/backend`, which `baseUrl` structurally cannot
do. The mutator receives the URL before the request is made and can, which is why FR-25
names a mutator and why there is no simpler option hiding behind it.

**The mapping is one string operation, because the two surfaces are path-equivalent.**
Checked route by route across all 17 data routes - the 19 of FR-1 minus the two auth routes
that story 10.2 excludes - and every one of them satisfies
`spec path === '/backend' + Next.js path`, with identical path parameters, identical query
parameters, and identical request bodies. There is no per-route table to maintain and no
exception to special-case; story 10.2 re-runs the check and records it, but it is expected
to confirm rather than discover.

So:

| `NEXT_PUBLIC_API_TARGET` | Mutator does | Live from |
| --- | --- | --- |
| `legacy` (**default**) | strips the leading `/backend`, leaving `/api/...` | Epic 10 |
| `nest` | passes the path through unchanged | Epic 7's flip |

Both are same-origin relative paths, so no origin is configured anywhere and CORS still
does not exist in this design. The value is `NEXT_PUBLIC_*` and therefore inlined at Next
build time, which makes the flip a container rebuild - accepted, and already reasoned
through under D32, which this seam inherits rather than reopens.

**Responses are bare bodies; the mutator throws.** `includeHttpResponseReturnType: false`,
so a generated operation resolves to the response body itself rather than to a
`{ data, status, headers }` envelope. React Query's own contract is that `queryFn` returns
the data and rejects on failure, so this is the shape the twelve existing hooks already
have; the envelope would make every adopted call site read `.data` where it reads the value
today, which is a component edit GR-7 forbids for no benefit.

The consequence, named so story 10.6 is not surprised by it: **two call sites currently
branch on a status code inside `.then`, and they move to the `.catch` branch they already
have.**

- `AddTransaction.tsx:161` checks `resp.status !== 200` and throws
  `` `Failed to add transaction. \nError: ${(await resp.json()).error}` ``, which its
  existing `.catch` turns into a toast. For that toast text to be unchanged, **the mutator
  must lift the error body's `error` field into the message of the `Error` it throws.**
  That is a hard requirement on the mutator, not a nicety - it is the one place an error
  body is user-visible today. It works on both sides of the seam without a branch: the
  Next.js route returns `{ error: 'Missing required fields' }` and friends, and FR-5 pins
  the Nest filter to the same `error` key.
- `app/product/page.tsx:17` checks `resp.status === 204` and logs success. On the bare-body
  shape the operation resolves with `undefined` on 204 and rejects otherwise, so the log
  becomes unconditional in `.then` and the existing `.catch` handles the failure.

Neither is a restructure: both keep their promise chain, their handler, and their place in
the component.

**The mutator uses `fetch`, not `axios`.** `axios` is a frontend dependency today but is
imported only by `src/server/helpers/get-exchange-rates.ts` and
`update-price-history.ts`, both GR-1 files. Keeping it out of the mutator means GR-6's
grep for `axios` stays a pure violation detector - any hit under `frontend/src` outside
those two files is genuinely wrong - and it keeps the client on the API Next instruments
and patches. It also adds no bundle weight for a client that makes 22 same-origin JSON
calls.

#### There is no staleness check, and none may be added

Stated as a positive design property rather than left as an absence, because the absence is
the decision (FR-26, D62). **Nothing verifies that `frontend/src/api/generated.ts` matches
the backend** - not `backend/Dockerfile`, not `frontend/Dockerfile`, not a script, not a
git hook, and not CI, which is separately ruled out. The owner has ruled this explicitly
and repeatedly. A story that reintroduces a check in any form is invalid, however it is
dressed up.

What replaces it is discipline plus two weaker nets that exist anyway:

- **The client is committed**, so a contract change arrives as a reviewable diff to the
  function that performs the call, not as a difference between two build logs (D46, still
  true and now the main defence).
- **`frontend/typecheck`** catches a consumer reading a field the regenerated client no
  longer has - but only once the frontend type-checks at all, which is D41's standing
  deferral. Until then, a regenerated client with a renamed field is caught by eye or not
  at all.

Determinism still matters and is still measured: two consecutive `spec:generate` runs
against an unchanged live spec produce byte-identical output, with the Prettier formatter
in the pipeline. Without that property, "regenerate and commit" would produce noise diffs
and stop being reviewable, which is the one thing the design does rest on.

#### Adoption, and what it may not do

GR-7 is the rule and it needs no elaboration except on one point that decides four stories:
**a call site that is already a `useQuery` takes the hook; a call site that is not takes
the operation function.** The generated operation function is a plain `Promise`-returning
call, so a `useEffect` with a bare `fetch` becomes a `useEffect` calling the operation, a
click handler becomes a click handler calling the operation, and no state is hoisted and no
component is split. The four sites GR-7 names - `useGetTokenList.ts:23`,
`useFetchCurrentPrice.ts:17`, `AddTransaction.tsx:161`, `app/product/page.tsx:17` - are
exactly the operation-function cases, and `useStorePriceHistory.ts` is the mixed one, where
the two price-history calls become operations and the crypto.com call at line 14 stays a
hand-written `fetch` because it is not in the spec.

#### One request DTO is wrong and is fixed before generation

`TransactionAddRequestDto` declares a `unit` property. The endpoint does not take one:
`frontend/src/app/api/transaction/add/route.ts` destructures the body without it and
writes `unit: tokenInfo.symbol` from the `token_id` lookup, and `AddTransaction.tsx:161`
does not send it. It is deleted in story 10.1, alongside the `operationId` work and before anything is
generated from the spec, so the first Orval output is already correct. Left in place it
would surface as an optional field on the generated request model that no caller can
meaningfully fill, which is the sort of thing that gets filled in anyway a year later.

### Coexistence and flip-back (FR-11, NFR-5)

Both cookies may be present in the browser simultaneously. They have different names
(`portfolio_session` vs `next-auth.session-token`) and different keys, so neither system
can accept the other's token even by accident - which is what keeps the Epic 7 flip-back
honest.

The Epic 6.2 seam decides which to read from a single config value, in all three
consumers: server components, Edge middleware (F1), and the client. **Flipping the flag
forces a re-login.** Translating a live session from one system into the other would mean
one system minting credentials it cannot verify, which is a genuinely bad idea for the
convenience of not typing a password on a personal app.

### Error shaping and its two carve-outs (FR-5)

The global exception filter from story 4.3 shapes errors uniformly - `401` with
`{ error: 'Unauthorized' }` for session failures, and consistent bodies elsewhere. It has
**two documented carve-outs**, both of which a uniformly-JSONifying filter would break:

1. **`GET /metrics` returns `403` with the plain-text body `Forbidden`** on a bad token
   (`src/app/api/metrics/route.ts:12`). Not JSON. Not `{ statusCode, message }`.
2. **`GET /exchange-rates/unit/:unit` returns a bare JSON string on both paths** - the
   formatted rate on success and `"Exchange rate not found"` with status `404` on failure
   (`src/app/api/exchange-rates/unit/[unit]/route.ts:9-13`).

The filter is pass-through for responses that already carry an explicit body. These two
are named here so story 4.3 designs for them rather than discovering them in Epic 5.

### Request validation - a knowing divergence

Request DTOs use `class-validator` with a global `ValidationPipe` configured
**permissively**: `whitelist: true`, `forbidNonWhitelisted: false`, type coercion
enabled, and **no new business rules**. This is more validation than today's routes
perform - `POST /transaction/add` currently trusts its body entirely - so it is a
deliberate divergence rather than parity, recorded here and to be re-stated in story 2.3.
It is kept permissive precisely so it cannot reject a request the old route accepted,
which would surface as an Epic 7 regression rather than as a validation improvement.

FR-3 constrains *responses* and says nothing about requests, so this is in bounds.

### Logging (FR-17)

**Winston, bound as Nest's app `LoggerService`** via `app.useLogger()`, not Nest's
built-in logger with a JSON transport bolted on. The reason is dashboard compatibility:
the emitted JSON must keep `service: 'portfolio'` and the same field set as
`src/server/logger.ts` so the existing Grafana dashboards need no edits.

Note a name collision worth being aware of: Alloy derives a Loki stream label called
`service` from the Compose service name (`monitoring/alloy-config.alloy`), which is a
*different* `service` from Winston's in-body field. Keeping Winston's value identical to
today's (`'portfolio'`) means dashboard filters on the body field keep matching, and
per-container separation comes from the `container_name` label instead.

Request correlation (story 4.1) uses `nestjs-cls` to carry a request id into every log
line. First consumers are the auth failure paths that `src/server/auth.ts:156,165` logs
today (`Auth Error`, `Invalid password attempt`).

### Metrics (FR-16)

Same metric names and same label names as `src/server/metrics.ts`. The two services are
distinguished by Prometheus's `job` label, not by renaming metrics - renaming would break
the existing dashboards, and two `job`s on one metric name is exactly what that label is
for.

`monitoring/prometheus.yml` gains a second scrape config: `job_name: nestjs-backend`,
target `nest-api:3001`, `metrics_path: /backend/api/metrics`, same bearer credential from
`METRICS_SECRET`. Both services are scraped for the whole initiative.

Per F3, `http_requests_total` and `http_request_duration_ms` are implemented properly in
the backend via a Nest interceptor and are an additive divergence, not a parity item.

### Redis (FR-18)

An injectable `ioredis` provider, landing in story 5.2 with exchange rates as its first
consumer. Key naming is identical to today's -
`time-frame-pl-{timeFrame}-coinName-{coin}`, lowercased on both segments as
`src/app/api/price-history/check/route.ts:22` does - so the old and new stacks share
cache state harmlessly for the whole coexistence window. `redis_cache_results_total`
keeps its existing labels.

### Time and timezone

`dayjs` in the backend, not `moment`. Both are already dependencies of the current app,
so neither is new knowledge, but moment is in maintenance mode and the backend is a fresh
package with no migration cost to pay.

**Named parity risk - timezone.** `NetCashFlow.date` and `TokenPriceHistory.date` are
MySQL `DATE` columns, not `DATETIME`, and time-frame boundaries are computed from the
current time. If the backend container's timezone differs from `next-app`'s effective
timezone, the `h`, `d`, and `w` boundaries shift by hours and parity fails in a way that
looks like a query bug rather than a configuration one. **`TZ=UTC` is pinned explicitly
on the `nest-api` container, and next-app's effective timezone is verified to match
during story 3.4**, with the result recorded.

---

## Deployment

### Package manager and Docker

**pnpm is pinned to 11.22.0.** This became available only once the frontend moved to Node
24: `pnpm@11` declares `engines.node >= 22.13`, which Node 18 could not satisfy, and
splitting the pnpm version per image is not an option - one workspace has one lockfile,
and one lockfile has one writer.

Pinned via `corepack` through a `packageManager` field in the root `package.json`, so the
version is reproducible and does not depend on what is installed on the host. A single
`pnpm-lock.yaml` at the repo root, committed.

Two things verified on pnpm 11.22.0 specifically, because the Docker design below depends
on them:

- **Plain `pnpm deploy` works, with `injectWorkspacePackages: true` set in
  `pnpm-workspace.yaml` before the first install.** No deprecated flag is involved. See
  D26c - this reverses an earlier decision to use `pnpm deploy --legacy`.
- **`lockfileVersion` is `'9.0'`** - identical to pnpm 10. See the correction under D26a:
  the two majors share a lockfile format, so this was never the migration hazard it
  appeared to be.

**Node versions are pinned in code, not only in this document.** Both packages carry
`"engines": { "node": ">=24 <25" }`, and a **single `.nvmrc` at the repo root** containing
`24` covers the whole workspace - one runtime means one file, with no per-package
override to drift. Without these, the base image in a Dockerfile is the only record of
the intended runtime, and a host-side `pnpm install` silently runs on whatever the
developer happens to have.

Both images build with the **repo root as the build context**, which workspace dependency
resolution requires. Everything below was verified by building a miniature version of
this exact workspace shape (`frontend`, `backend`, `packages/shared` with a build step,
one root lockfile) rather than reasoned about. The mechanics were first verified against
pnpm 10.34.5, then re-verified on the pinned 11.22.0 under Node 24 - including a full
`docker build` of the miniature backend image that runs. Story 1.3 should implement this,
not rediscover it.

#### Every workspace manifest goes into every image - and omitting one fails silently

The single most important mechanic, and the one with the nastiest failure mode.

A Dockerfile for the backend must copy **`package.json` from every workspace member** -
root, `backend/`, `frontend/`, and `packages/shared/` - not just the backend's own. The
same is true in reverse for the frontend image.

The expected failure mode is a loud error. **It is not.** With only `backend/package.json`
present, `pnpm install --frozen-lockfile --filter @portfolio/backend...` **exits 0 and
reports success**, having created `backend/node_modules/@portfolio/shared` as a
**dangling symlink** pointing at a `packages/shared` directory that does not exist in the
image. The build passes, the image is published, and the failure surfaces at container
start as `MODULE_NOT_FOUND`. Verified directly: the symlink was created, `test -e`
reported it unresolvable, and `require.resolve` threw.

With the complete manifest set present the same command reports
`Scope: 2 of 4 workspace projects`, links `@portfolio/shared` correctly, and - because of
the `--filter` - does not create `frontend/node_modules` at all. The `...` suffix on the
filter is load-bearing: it means "this package **and its workspace dependencies**", which
is what pulls `packages/shared` into scope.

Layer ordering for both images:

```dockerfile
# 1. workspace skeleton - changes rarely, caches well
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY backend/package.json          ./backend/
COPY frontend/package.json         ./frontend/
COPY packages/shared/package.json  ./packages/shared/

# 2. install - the expensive layer
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter @portfolio/backend...

# 3. source - changes constantly, must come after the install
COPY packages/shared ./packages/shared
COPY backend         ./backend
```

The frontend image is identical with `--filter @portfolio/frontend...` and its own source
copy. A BuildKit cache mount on the pnpm store keeps re-installs fast without baking the
store into a layer.

#### `packages/shared` must be built before anything consumes it

`packages/shared` has a `tsc` build (decision D25), and **`pnpm deploy` copies whatever is
on disk** - it does not run builds. Verified: deploying with `packages/shared/dist`
absent **exits 0** and produces a deploy output containing `package.json` but no `dist/`,
which is the same silent-success-then-runtime-failure shape as the manifest problem.

Ordering within each image, after the source copy:

```dockerfile
RUN pnpm --filter @portfolio/shared build     # must precede the app build
RUN pnpm --filter @portfolio/backend build
```

**Each image builds `packages/shared` independently.** It is a `tsc` run over a handful of
type declarations and two constants - cheap enough that sharing the artifact between
two images via a common base stage would add coupling and a build-ordering constraint for
no meaningful time saving. The two images stay independently buildable, which matters
more here than a second of build time.

#### `pnpm deploy` needs `injectWorkspacePackages: true`, set before the first install

The production stage uses `pnpm deploy --filter` to emit a self-contained directory
holding only that package's production closure. Because the deployed package depends on a
workspace package (`packages/shared`), the plain invocation fails on pnpm 10 **and** 11
unless the workspace opts in:

```
ERR_PNPM_DEPLOY_NONINJECTED_WORKSPACE  By default, starting from pnpm v10, we only deploy
from workspaces that have "inject-workspace-packages=true" set
```

**The fix is one line in `pnpm-workspace.yaml`, written when story 1.3 creates the file:**

```yaml
packages:
  - frontend
  - backend
  - packages/*
injectWorkspacePackages: true
```

with an unflagged deploy in both production stages:

```dockerfile
RUN pnpm deploy --filter @portfolio/backend --prod /app/deploy
```

Verified end to end, including a real `node:24-bookworm` Docker build of the miniature
workspace with corepack-pinned pnpm 11.22.0: the deploy output contains `dist/`,
`node_modules/ms`, and `@portfolio/shared` injected into the output's own `.pnpm` store
(along with shared's *own* transitive dependencies), and the resulting image runs.

**The ordering is the whole trick, and it is a story-1.3 constraint.** The setting is
recorded inside the lockfile under `settings:`. If it is added to a workspace whose
lockfile predates it, every `--frozen-lockfile` install - plain and `--filter` alike -
fails with `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH` (reproduced deliberately). That is a
*migration* failure, not a property of the setting. This workspace is created from
scratch, so writing the line into `pnpm-workspace.yaml` **before the first
`pnpm install`** means the lockfile is born with `injectWorkspacePackages: true` in its
`settings:` block and frozen installs pass from the very first one. Verified: fresh
`pnpm install --frozen-lockfile` and `pnpm install --frozen-lockfile --filter
@portfolio/backend...` both succeed against a lockfile generated with the setting in
place.

**Local dev linking is unaffected on current pnpm.** The documented worry - that
injection replaces workspace symlinks with hard copies, so edits to `packages/shared`
stop appearing until a reinstall - **does not reproduce**. With
`injectWorkspacePackages: true`, pnpm 11.22.0 still records
`version: link:../packages/shared` in the lockfile, still creates
`backend/node_modules/@portfolio/shared` as a symlink to `packages/shared`, and creates
no `@portfolio+shared@file+...` entry in the workspace's own virtual store. Injection is
materialized only in the `pnpm deploy` output. Confirmed by editing
`packages/shared/src`, rebuilding with `pnpm --filter @portfolio/shared build`, and
seeing the new value in the consumer with no reinstall. Re-checked on pnpm 10.34.5 with
the same result, and re-checked with `packages/shared` carrying a runtime dependency of
its own - symlinked in every case. **So the dev-loop cost of injection is zero: the
`tsc` rebuild of `packages/shared` was already required and is unchanged.**

If a future pnpm does start hard-copying workspace packages at install time under this
setting, the cost is a re-link step after a shared rebuild (a filtered install, not a
clean reinstall), on a package that is near-static after Epic 4. That is a small enough
price that it would not change this decision.

#### Accepted cost: one lockfile means shared cache invalidation

Both images key their dependency layer on the same `pnpm-lock.yaml` hash, so **adding a
dependency to the frontend invalidates the backend's cached install layer and vice
versa.** This is inherent to having one lockfile, not a misconfiguration.

It is the price of the single-source-of-truth property that makes the workspace coherent -
one resolution of every shared transitive dependency, one `--frozen-lockfile` check that
means something. **Do not "optimize" this by splitting into per-package lockfiles**,
which would defeat the workspace, allow the two packages to silently resolve
`packages/shared`'s dependencies differently, and reintroduce exactly the drift the
monorepo exists to remove. Recorded here so a future reader recognizes it as a decision
rather than an oversight.

#### Dev-mode bind mounts

The narrow-mount rule applies to **both** containers once the move lands. The frontend's
existing `./src:/app/src` mount (`docker-compose.yml:59-61`) becomes
`./frontend/src:/app/frontend/src`, and the backend gets `./backend/src:/app/backend/src`.

The reason the mounts must stay narrow is structural, not incidental. pnpm's isolated
node-linker puts the real packages in a **content-addressed virtual store at the workspace
root** (`node_modules/.pnpm`) and leaves only symlinks in each package's own
`node_modules`. Two consequences:

- **The root `node_modules` must remain intact inside the image.** A package-level
  `node_modules` is just a directory of symlinks into `../../node_modules/.pnpm`; mounting
  over or omitting the root store leaves every one of those links dangling.
- **Never mount a host directory over any `node_modules`.** The host tree is built for the
  host's platform and pnpm's store layout is absolute-path sensitive. Mounting `backend/`
  wholesale would shadow `backend/node_modules` with whatever the host has - or with
  nothing - and break resolution. Mount `backend/src` and nothing above it.

This is why the existing compose file mounts `./src` rather than `.`, and that instinct
carries forward unchanged.

#### Frontend-specific considerations

The frontend image needs **no structural difference** from the backend's - same root build
context, same manifest-copy set, same filtered install, same narrow mount, same
`node:24-bookworm` base. With both packages on one runtime there is no version skew to
accommodate anywhere in the build.

The one frontend-specific note is `frontend/Dockerfile`'s existing `RUN npx prisma
generate` step (currently `Dockerfile:29`). It must survive the pnpm conversion as
`RUN pnpm --filter @portfolio/frontend exec prisma generate`, run **after** the install
and **before** `next build`, since the Prisma client is generated into `node_modules` and
the Next build imports it. Prisma stays in `frontend/` per GR-1 and D14.

Dev ergonomics carry over unchanged in spirit: the backend runs `nest start --watch` with
a **narrow bind mount of `backend/src` only**. Mounting anything that contains
`node_modules` is fatal under pnpm's symlinked store, so the mount stays as tight as the
existing `./src:/app/src` mount in `docker-compose.yml:59-61`.

### What gates a build, and where

> **This supersedes part of story 1.6, which is marked Complete.** 1.6 turned on
> build-failing lint for `backend/`, and it did so correctly against NFR-2 as that
> requirement was written. The owner has since decided that **an image build produces an
> artifact and does not run quality gates**, so the lint half of that story is reversed.
> Its frontend half - the recorded 46 type errors and the deferral rationale carried
> forward to story 8.5 - is untouched and still stands. F4 routes the NFR-2 text to
> `bmad-pm`.

Two checks exist in this repo. They are deliberately not enforced the same way.

| Check | Fails a build? | Where it runs |
| --- | --- | --- |
| Type checking, `backend/` and `packages/shared` | **Yes** | inherently, inside both Docker builds |
| Lint, every package | **No** | developers and editors only |

> **Amended by Epic 10 as shipped.** This table used to carry a third row - OpenAPI
> snapshot staleness, failing both production builds. **It is gone**, along with the
> committed snapshot it compared and the script that produced it. **Type checking is now
> the only thing that fails a backend image build** (NFR-2 as amended), and contract
> currency is the developer's responsibility at commit time (FR-26). Everything below
> under "Where the staleness check runs" describes a mechanism that no longer exists and
> is kept only because Epic 9's shipped stories cite it. The **lint** half of this section
> is unaffected and still current.

**Type checking still gates, and it does so without a dedicated step.** `nest build` *is*
`tsc`, and `packages/shared`'s build script is literally `tsc`, so both run inside
`backend/Dockerfile` already and a type error fails the image. This is the surviving half
of NFR-2 and it needs no new machinery - the gate is a side effect of needing the
JavaScript. The frontend is the documented exception: `next.config.js` sets
`typescript.ignoreBuildErrors`, so `next build` does not type-check, which is the standing
deferral to story 8.5 and not a new decision.

**Lint gates nothing, anywhere.** Remove `backend/Dockerfile:44`
(`pnpm --filter @portfolio/shared lint`, added as an Epic 4 review fix, in **stage 2,
`common-build`**) and `backend/Dockerfile:57` (`pnpm --filter @portfolio/backend lint`, in
**stage 4, `builder`**). Both removals stand exactly as D40 states them. (They were the
*only* changes either Dockerfile ended up keeping from this section - the staleness step
described below was added and then removed again inside Epic 10, so both `builder` stages
now go straight from `common-build` to their own `pnpm build`.) `frontend/Dockerfile`
was checked and has no equivalent to remove; `next build` would run ESLint by default, but
`next.config.js` sets `eslint.ignoreDuringBuilds`, so the frontend already behaves the way
the backend is being changed to behave. The `lint` scripts stay in every package manifest
and stay wired into editors - what goes away is lint's ability to stop an artifact from
being produced. Removing these two lines also shortens the backend image build, since
ESLint no longer runs during it.

#### Where the staleness check runs: the two production image builds, one link each

> **Superseded in full - this mechanism does not exist (FR-26, D62).** Everything from here
> to the end of "Rejected alternatives" describes the two-link Docker enforcement that
> Epic 9 built and Epic 10's owner-feedback rounds deleted. Neither Dockerfile copies a
> spec, copies `scripts/`, or runs a check. It is kept because stories 9.4, 10.1 and 10.3
> cite it, and because its rejected alternatives - CI, a pre-commit hook - are now the
> alternatives to *nothing*, and the owner has ruled both out on top of ruling out the
> build check. **The one sentence below that is still true is the CI note**: no CI is added,
> and none may be.
>
> **Owner decision, replacing this document's earlier answer.** An earlier draft put the
> check in a new GitHub Actions job. **No CI is added.** `.github/workflows/api-contract.yml`
> is not created, and nothing is appended to the two workflows that already exist. D39
> records the decision and the reasoning; it is not re-argued here.

FR-21 needs a build to fail. The principle that took lint out of the images does not take
this out with it: **lint is style, a stale contract is a correctness failure of the same
kind as a type error** - the frontend's declared view of a response no longer matches the
response. Type checking already gates in exactly this place, inherently, because
`nest build` *is* `tsc`. The staleness check goes where that failure already happens.

**The chain has two links, and they live in different images.**

| Link | Input | Output | Image that can check it |
| --- | --- | --- | --- |
| 1 | `backend/dist` | `backend/openapi.json` | backend, `builder` stage |
| 2 | `backend/openapi.json` | `frontend/types/api.d.ts` | frontend, `builder` stage |

Between them the whole chain is covered. Verified against the actual Dockerfiles, the
Compose file, and a real pnpm install rather than reasoned about:

- **Both build contexts are the repo root.** `docker-compose.yml` gives `context: .` with
  `dockerfile: backend/Dockerfile` and `frontend/Dockerfile`, and `deployment.yml` builds
  `frontend/Dockerfile` with `context: .` too. Either image may `COPY` any path in the repo,
  which is what makes link 2 checkable from the frontend image at all.
- **The backend `builder` stage already has everything link 1 needs.** It inherits
  `backend/src`, the root `node_modules`, and a built `packages/shared` from `common-build`,
  and its own `RUN pnpm --filter @portfolio/backend build` is what produces the `dist` the
  generator reads. It has no frontend tree - `backend/Dockerfile` copies `backend/`,
  `packages/shared`, and the root manifests and nothing else - so link 1 is all it can do.
- **The frontend image already carries the output side of link 2.** `common-build` does
  `COPY frontend/types ./frontend/types`, so `api.d.ts` and `contracts.ts` are present
  before any step runs. Only the input is missing, and it is one committed file.
- **`openapi-typescript` resolves in both images with no install change.** It is a root
  devDependency, as "Scripts, and where they live" sets out, and a filtered install still
  installs the *root project's* devDependencies - verified on pnpm 11.22.0 in a scratch
  workspace, where `pnpm install --frozen-lockfile --filter pkg...` put the root devDep in
  the root `node_modules` and it resolved from the root. Both Dockerfiles already copy the
  root `package.json` into `deps` and copy `/app/node_modules` forward.
- **`.dockerignore` does not stand in the way.** It excludes `node_modules`, `.next`,
  `db-dumps`, `.private`, and `.git`; neither `scripts/` nor `backend/openapi.json` is
  excluded, so both reach the build context of both images without an edit.
- **The dev target is untouched.** In both Dockerfiles `dev` and `builder` branch off the
  same `common-build`, and Compose builds `target: ${TARGET:-dev}`. Steps added to `builder`
  never run during `docker compose up`, so a stale artifact cannot block the dev loop.

##### Exact placement, stage by stage

Said precisely because D40 edits the same file. D40's two removals are in **different
stages**: `pnpm --filter @portfolio/shared lint` is in stage 2, `common-build`; `pnpm
--filter @portfolio/backend lint` is in stage 4, `builder`. **Everything below lands in
`builder` only** - stage 4 of `backend/Dockerfile`, and the `builder` stage of
`frontend/Dockerfile`.

`backend/Dockerfile`, stage 4 `builder`, after `RUN pnpm --filter @portfolio/backend build`:

```dockerfile
COPY backend/openapi.json ./backend/openapi.json
COPY scripts ./scripts
RUN node scripts/generate-api-contract.mjs --check --only=spec
```

The copies come *after* the build so that changing the snapshot alone does not invalidate
the compile layer. `deploy` and `prod` need no edit. `deploy` is `FROM builder`, so it
inherits both copies; whether `pnpm deploy --prod` carries `backend/openapi.json` into the
production closure is not worth controlling either way, since it is 45KB of static JSON
that no runtime code reads.

`frontend/Dockerfile`, `builder` stage, **before** `RUN pnpm --filter @portfolio/frontend build`:

```dockerfile
COPY backend/openapi.json ./backend/openapi.json
COPY scripts ./scripts
RUN node scripts/generate-api-contract.mjs --check --only=types
```

Before `next build` so a stale contract fails in about a second instead of after a full
Next compile. This is the one place a backend path is copied into the frontend image; it is
a committed JSON document, not backend source, and nothing in the frontend build imports it.

> **Superseded (D55, D56).** Epic 10 first re-pointed this step at `--only=client` and
> `frontend/src/api/generated.ts`; its owner-feedback rounds then **deleted the step from
> both Dockerfiles**, together with the `COPY backend/openapi.json` and `COPY scripts`
> lines. Neither image reads a spec or invokes Orval. `frontend/Dockerfile` also no longer
> copies `orval.config.ts`, which now lives in `frontend/` and is not needed in any image.

Both steps invoke the script directly rather than through new root `package.json` entries.
The flags *are* the content of the step, and two more script names existing only to be
typed by a Dockerfile is worse than one visible command.

##### The frontend-side check is not a typecheck

Stated explicitly because it decides whether this can land now. `openapi-typescript` parses
a JSON schema document and emits declaration text; `--check` then compares those bytes to
the committed `api.d.ts`. **No frontend TypeScript is compiled at any point** - `tsc` is
never invoked, no `frontend/src` file is read, and `next.config.js`'s
`typescript.ignoreBuildErrors` is neither consulted nor changed. So this ships while the
46 pre-existing frontend type errors sit exactly where D41 leaves them, and nothing in
Epic 9 acquires a dependency on that later epic.

> **Moot after Epic 10 - there is no step to typecheck or not typecheck.** One property
> from here does survive into the shipped design and is worth keeping: **Orval transpiles
> the mutator with esbuild, which strips types without checking them**, so a type error in
> `http-client.ts` does not fail `spec:generate`. It fails `frontend/typecheck` (D41) and
> the editor, which is where D40 says type feedback belongs. What esbuild *does* enforce is
> the `target` in the tsconfig the config names - see D57 as amended.

##### What this costs against the CI job it replaces

Recorded so it is understood now rather than discovered later:

- **Nothing runs on a push.** Enforcement fires when someone builds a production image.
  The initiative lives on `nestjs-migration`, where no image build happens automatically,
  so during Epics 5 to 7 the check runs when a developer runs it.
- **Only link 2 runs automatically on `main`.** `deployment.yml` builds `frontend/Dockerfile`
  with no `target:`, so it builds through `builder` to the final `prod` stage and link 2 is
  enforced on every push to `main`. **No workflow builds the backend image at all**, so link
  1 fires only on a local or manual production build. `TARGET=prod docker compose build`
  builds both services and therefore covers the full chain in one command; that is the
  invocation to name in story 9.4's acceptance.
- **A failure names one link, never the pair**, because the two checks run in separate
  builds.

None of this needs machinery added later. The moment a workflow that builds the backend
image exists, link 1 starts being enforced by it for free, because the check lives *in* the
image rather than beside it.

##### Local development prevents drift rather than detecting it

`pnpm spec:watch` (D45) regenerates both artifacts on every change under `backend/src`, so
editing a DTO updates `api.d.ts` within a couple of seconds and a consumer still reading
the renamed field goes red in the editor - before any build runs. The image checks are the
backstop for the case the watcher was not running, not the primary feedback loop. This is
the substantive difference from the CI design: there, drift was *caught*; here, it is
mostly *not created*, and caught when it is.

##### No `predev` or `prebuild` hook

Considered and rejected, not omitted. A `prebuild` in `backend/package.json` **recurses**:
the generator's first action is `pnpm --filter @portfolio/backend build`, which would fire
`prebuild` again. That is not a subtle risk, it is an infinite loop, and it would fire
inside the Docker `builder` stage as well. A `predev` on `@portfolio/frontend` runs inside
the frontend container, which has no backend tree; a hook on the backend's `start:dev` runs
inside the backend container, where D45's mount analysis already shows generated files
cannot reach the tree the developer commits from. The only place a hook could correctly run
is a root-level host script, and that script already exists - it is `spec:watch`. A second
entry point into the same generator would add a path that can behave differently from the
one whose output gets committed, which is the property the single-script design exists to
protect.

##### Rejected alternatives

- **A new GitHub Actions job** (`.github/workflows/api-contract.yml`, `on: push`,
  `pnpm spec:check`). This is the mainstream answer for committed generated artifacts and
  was this document's own recommendation. **The owner ruled CI out**; see D39.
- **A git pre-commit hook.** No hook framework exists in the repo, hooks are not installed
  by a clone, and they are bypassed by `--no-verify`. A check that only runs when a human
  remembers to let it is the discipline FR-21 exists to replace.
- **Putting the steps in `common-build` so dev builds check too.** That makes
  `docker compose up` fail on a stale artifact and blocks the dev loop over a file whose
  regeneration is a background watcher's job. The prod build is the gate; the dev build is
  not a gate at all.
- **Checking both links in one image**, by copying `frontend/types` into the backend image
  or `backend/src` into the frontend image. Either doubles an image's tree so one `RUN` can
  see both ends of a chain whose two halves are already each in the right place.
- **No enforcement at all, relying on the `spec:watch` loop.** This is the honest reading
  of "generate locally and commit both artifacts", and it fails on the one case that
  matters: someone edits a DTO without the watcher running.

> **The last alternative is what shipped, minus the watcher.** The owner chose no
> enforcement anywhere, and `spec:watch` does not exist either, so the failure case named
> above is simply accepted: someone edits a DTO, does not regenerate, and nothing says so
> until a field renders `undefined`. The objection was not answered - it was priced and
> paid. D62 records that, and FR-26 is the discipline that replaces the machinery.

#### The frontend typecheck script is evidence, wired into nothing

`frontend/package.json` gains `"typecheck": "tsc --noEmit -p tsconfig.json"`, matching the
script that `backend/` and `packages/shared` already carry. It fails today - **46 errors
across 19 files, re-measured on this branch**, the same count story 1.6 recorded - and it
is wired into no build and no image, and there is no CI for it to be wired into. It exists
so the number can be produced
on demand rather than reconstructed with a bare `tsc` invocation.

Those 46 errors are **out of scope for Epic 9** and are not to be fixed here. The owner
intends a new epic for them; story 8.5 remains their scheduled home until that epic
exists. That epic is not Epic 13 - Epic 13 is prose only and touches no source file.
Nothing in Epic 9 may depend on them being fixed.

The consequence has to be stated plainly, and Epic 10 made it sharper rather than softer:
**until the frontend type-checks, a renamed DTO field is caught by nothing.** Under Epic
9's design the spec diff caught it and failed a production build. That check is gone
(FR-26), so the only remaining nets are the reviewer reading the regenerated
`generated.ts` diff, and - once the frontend compiles - the consumer that still reads the
old field name failing to compile. Two of the files
stories 9.5 and 9.6 touch (`components/product/ProductTable.tsx`,
`_hooks/useFetchCurrentPrice.ts`) are already among the 19 failing ones, so for those
files "does it typecheck" cannot be a pass/fail signal at all. Record a per-file error
count before and after instead, and expect it to be unchanged.

### Node and framework versions

| Package | Runtime | Why |
| --- | --- | --- |
| `backend/` | **`node:24-bookworm`** | Node 24 "Krypton" is **Active LTS**. The dependency floor is lower - `@mikro-orm/core@7.1.11` declares `engines.node >= 22.17.0` and `@nestjs/core@11.2.1` declares `>= 20` - so the floor is not what drives the choice; LTS status is. |
| `frontend/` | **`node:24-bookworm`** | Bumped from Node 18 on spike evidence - see below. One runtime across the workspace. |

**Why Node 24 and not 22 or 26.** Verified against `nodejs.org/dist/index.json` and the
official release schedule rather than assumed:

| Line | Status today | Notes |
| --- | --- | --- |
| v26 | **Current**, not LTS | Does not reach LTS until 2026-10-28 |
| v24 "Krypton" | **Active LTS** | LTS since 2025-10-28; maintenance from 2026-10-20 |
| v22 "Jod" | **Maintenance LTS** | Entered maintenance 2025-10-21; security fixes only |

Node 22 was the right call when first specified and has since moved to maintenance.
Active LTS is the correct target for a backend service, and Current is the wrong choice
for infrastructure nobody is babysitting.

**Scheduled revisit, not a surprise.** Node 24 enters maintenance on 2026-10-20, roughly
two months out, when v26 becomes Active LTS. This is not a reason to jump to 26 early -
that would mean running Current in the interim, which is the thing being avoided - but it
does mean the backend base image should be bumped to `node:26-bookworm` shortly after
that date. Recording it here so it is a scheduled decision rather than quiet drift.

#### The frontend's Node bump - spike evidence, and why it moved into Epic 1

The frontend was originally left on Node 18 on the reasoning that bumping it was
unrelated risk on an already-large branch. **That was reversed** after the risk was
measured rather than assumed. Node 18 "Hydrogen" reached EOL on 2025-04-30 and receives
no security updates of any kind, so "leave it alone" was not a neutral choice - it was a
decision to ship an unsupported runtime.

The blocker was never Node itself, it was **Next 14.0.1**, released October 2023 and
therefore never tested against a Node that did not yet exist. That is a real question and
it was answered empirically:

| Check | Result on Node 24.13.0 |
| --- | --- |
| `next@14.0.1` declared `engines` | `>=18.17.0` - open upper bound |
| `next-auth@4.24.5` declared `engines` | none declared |
| `next build` (App Router, server component) | **Compiled successfully**, 4/4 pages generated |
| `next start` + HTTP request | **200 OK**, server component rendered |
| **Edge middleware executes** | **Yes** - and ES256 WebCrypto inside it returned `true` |
| `bcrypt@5.1.1` | **Installs and hashes correctly** |
| `sharp@0.32.6` | **Loads correctly** |
| `@prisma/client@5.6.0` | Loads correctly |

The native modules were the expected failure point and they are not one. `bcrypt@5.1.1`
builds against **N-API (`napi-v3`)**, which is ABI-stable across Node major versions by
design, so it does not need recompilation for a new Node major at all. `sharp` is not
even a direct dependency - it is optional, for Next's image optimization.

One misleading signal worth recording so nobody re-runs this and panics: in the current
repo, `require('bcrypt')` fails on Node 24 with `ERR_DLOPEN_FAILED`. That is **not** a
Node version problem - the message reads
`incompatible architecture (have 'x86_64', need 'arm64')`. The committed `node_modules`
was built for a different CPU architecture. A clean reinstall - which story 1.3 performs
anyway when converting to pnpm - resolves it.

The middleware result is the most valuable one, because per F1 the Edge path is the part
of this design with the least margin. Verified directly: Next 14.0.1's middleware ran on
Node 24 and completed an ECDSA P-256 sign-and-verify through the sandbox's WebCrypto.
That confirms the Node bump and the ES256 session design simultaneously, on the real
framework version rather than a proxy for it.

**Upgrading Next was considered and is not needed.** If Next 14.0.1 could not run on a
modern Node, the honest choice would have been "stay on pnpm 10" versus "upgrade Next" -
and a framework upgrade riding along with a backend migration would have been the wrong
trade, with staying put the respectable answer. The evidence removes the dilemma: Next
14.0.1 runs correctly on Node 24, so **no framework upgrade is in scope**, and the
Next 15 upgrade remains genuinely separate future work.

Node 20 was evaluated and dismissed on two independent grounds: it reached EOL on
2026-04-30, and at `>= 22.13` it sits below pnpm 11's floor, so it unlocks nothing. Node
22 clears pnpm's floor and is the smallest jump, but it is Maintenance LTS - a shorter-
lived answer that would need doing again sooner. Node 24 is Active LTS and matches the
backend, giving **one runtime across the entire workspace**, which also means one
`.nvmrc`, one base image line to bump each October, and no version-skew class of bug at
all.

ES256 remains the right session algorithm regardless: ECDSA P-256 is
original-specification WebCrypto with no experimental status on any runtime, so the
frontend's Node version is not cryptographically load-bearing even now that it is
current.

Note for the story 1.1 inventory: the root `Dockerfile.dev` appears entirely unused -
`docker-compose.yml` builds `Dockerfile` with `target: dev`. Flagged rather than deleted;
under GR-1 it is an Epic 8 cleanup item.

### Compose and nginx

A new service, `nest-api` (container name `nest-api`), listening on **3001 inside the
Compose network and published to the host as `127.0.0.1:3002:3001`**. Host 3001 is already
Grafana's, hence 3002. nginx remains the single *ingress* path - the host mapping is bound
to loopback so it is reachable from the developer's machine and from nowhere else, and it
exists for one reason: Orval's input is a URL, so `spec:generate` has to fetch
`http://localhost:3002/backend/docs-json` from the host (FR-26, D27). It joins
`portfolio-network` with a `nest-api` alias, reads the same
`defaults.env` / `override.env` pair as everything else, and depends on `portfolio-db`
and `redis`.

nginx gains one location block inside the existing TLS server, ahead of the catch-all:

```
location /backend/ {
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Real-IP       $remote_addr;
  proxy_set_header Host            $http_host;
  proxy_pass       "http://nest-api:3001";
}
```

`location /` continues to proxy to `next-app:3000`, untouched. The existing local HTTPS
flow needs no changes at all - same host, same certificate, same SANs - which is the
concrete payoff of choosing a path prefix over a subdomain.

New env vars: `SESSION_PRIVATE_KEY_JWK` (nest-api only), `SESSION_PUBLIC_KEY_JWK` (both
containers), `SWAGGER_ENABLED`, `TZ=UTC` (nest-api). Existing `DATABASE_URL`,
`METRICS_SECRET`, and the Redis settings are reused as-is.

### Swagger exposure (FR-19)

Served at `/backend/docs`, gated by an explicit **`SWAGGER_ENABLED`** env flag defaulting
to on for this project - not by a hardcoded `NODE_ENV` check, so it can be turned off
without a code change or a rebuild.

Access is restricted **at nginx**, not by the application's own auth guard - either by
`allow`/`deny` on the LAN and WireGuard ranges already present in
`setup_local_https.sh`, or by HTTP basic auth. "Who may see this API surface at all" is
an ingress question, and guarding Swagger with the app's JWT breaks the Try-It-Out flow
in irritating ways for the one person the docs are for. The path sitting under `/backend`
means this is one more directive in the block that already exists.

---

## Migration / Rollout Strategy

This aligns to the PRD's epic sequence rather than proposing a different one. What
follows is the architectural obligation each epic carries.

**Epic 1 - restructure.** The move is path-only. `tsconfig.base.json`, the two
per-package tsconfigs, and the split eslint setup land here. The backend's injectable
config provider (story 1.4) is the one piece of cross-cutting infrastructure that must
exist before anything else, because nothing boots without it. nginx gets its `/backend/`
block in 1.5. `packages/shared` can be created empty here or deferred to Epic 4 - it has
no consumers until the session type exists.

**Epic 2 - scaffold and gate.** This is where the FR-3 contract gets written down. Story
2.1's inventory must record, per field, the **runtime JS type** and not just the field
name, because that is what catches both the pre-formatted strings and, later, the raw
deserialization drift named above. Story 2.3 establishes the `@FormattedValue` decorator
and the DTO conventions. The Swagger doc is the artifact under review at Epic 2's gate,
not the controller source.

**Epic 3 - data layer.** Generator runs once in 3.1 with its raw output captured. Story
3.4 is the load-bearing one: it fixes the EM-by-injection pattern, the raw-query pattern,
and the TZ verification that every Epic 5 story then inherits. Worth over-investing in.

**Epic 3 rework, from the D33 reversal.** Epic 3 has already been built and reviewed
against the superseded `defineEntity` decision, so the conversion is rework on delivered
stories rather than new scope. It is mechanical and self-contained:

1. Add `@mikro-orm/decorators@7.1.13`; move `@mikro-orm/core`, `@mikro-orm/mysql`,
   `@mikro-orm/cli`, and `@mikro-orm/entity-generator` from 7.1.12 to 7.1.13 in the same
   change, since MikroORM pins those peers exactly. Raise the `typescript` range to
   `^5.9.0`.
2. Convert the seven entity files: one exported decorated class each, `type` and
   `fieldName` explicit on every property, `name` used nowhere. The `p` builder calls map
   one-to-one onto decorator options, so this is transcription, and the existing property
   keys and column mappings must come out byte-identical - that is the acceptance check,
   because D13 is what FR-3's JSON field names rest on.
3. Update `src/entities/mikro-orm.module.ts` to register the classes instead of the
   `*Schema` objects, and delete the `*Schema` exports.
4. Re-run the story 3.3 `schema:update --dump` drift check. Empty output is the proof
   that the conversion preserved every column mapping; it is the cheapest possible
   regression test here and it should gate the rework.

The existing entity comments about relations being deliberately unmodeled carry over
verbatim - nothing about the style change reopens that. Note that `@mikro-orm/decorators`
also restores `CreateRequestContext` and `EnsureRequestContext`, which were reported
missing under the old reading. D15 is unaffected - `MikroOrmMiddleware` remains the
mechanism for HTTP requests - but those decorators are now available if any non-request
entry point (a script, a future job) ever needs a context.

**Knock-on to Epics 4 to 7: none, provided the rework lands before Epic 5 starts.** The
style change is confined to how entity metadata is declared. It does not touch the EM
injection pattern (D15), the raw-query split (D16), DTOs (D20), error shaping (D22), or
anything in the session design, so Epic 4 is untouched. Epic 5 consumes entities only
through `em.find(Entity, ...)` and `EntityRepository<Entity>`, which take the class in
both styles - and because the class is now the only exported symbol, Epic 5 stories cannot
accidentally import the wrong one. Epics 6 and 7 are frontend-seam work and never see an
entity. The one real sequencing constraint is ordering: converting entities *after* Epic 5
stories have been diffed for FR-3 parity would invalidate those diffs, for the same reason
D26e gives about the frontend runtime. Do the rework now, while Epic 3 is the newest thing
on the branch.

**Epic 4 - auth, the first vertical slice.** 4.2 (clock) and 4.3 (error shaping) block
Epic 5 and must be genuinely finished, not stubbed. Story 4.8's demonstration that a Next
server component can read a Nest-issued session **must be extended to cover Edge
middleware** per F1 - server components run in Node and will succeed even if the Edge path
is broken, so a demonstration limited to `page.tsx` proves less than it appears to. The
same story is where the cross-library interop is proven for real: a token signed by
`@nestjs/jwt` with ES256, verified by `jose` through a WebCrypto `CryptoKey`, from inside
the middleware. This was reasoned about but not executed at design time.

**Epic 9 - the contract pipeline.** Runs fifth, between Epics 4 and 5. **Everything in this
entry except story 9.1 was undone by Epic 10** - the snapshot, both artifacts, and 9.4's
Dockerfile enforcement are all gone. It is kept as the record of what those shipped stories
were built against. Story 9.1's DTO repair is the part that survived, because it edited
backend source. Story 9.1 is
reconciliation and DTO repair only - the `TimeFrame` enum and all seven `timeFrame` sites
land there, five of which carry a wrong `'24h'` example today, before anything is
generated from them, so the first committed snapshot is already correct. 9.2 and 9.3
produce the two artifacts; 9.4 adds the enforcement and is the story the epic exists for,
which is why the PRD sequences it ahead of every adoption story. 9.5 to 9.7 are adoption
and cleanup.

Two things worth knowing before the epic starts. **Story 9.4 is a Dockerfile story, in both
files** - this corrects an earlier statement here that nothing in Epic 9 needed a Dockerfile
change, which was true only while the check was going to live in CI. The shipping side of
the artifacts still needs nothing: `frontend/Dockerfile:42` already does
`COPY frontend/types ./frontend/types`, so `api.d.ts` and the `contracts.ts` alias surface
reach the frontend image as-is. What 9.4 adds is the check itself - `backend/openapi.json`,
`scripts/`, and one `RUN` into the `builder` stage of each Dockerfile, per "Where the
staleness check runs". GR-5 is not tripped, as the PRD predicted - `contracts.ts` imports
from a generated declaration file, not from `@portfolio/shared`. **And D40's removals belong
in the same story**: 9.4 is where enforcement is decided, and the two changes touch
`backend/Dockerfile` together - lint comes out of `common-build` and `builder`, the
staleness step goes into `builder`.

**Epic 10 - the generated client.** Runs sixth, between Epic 9 and Epic 5. It was planned
to inherit Epic 9's chain down to `backend/openapi.json`; **as it shipped it replaced that
chain instead**, deleting the snapshot, the generator script and both staleness checks. The
obligation each story carries, as planned:

- **10.1 is the only story that edits backend source, and it must land first and complete.**
  The 22 explicit `operationId`s and the deletion of `TransactionAddRequestDto.unit` are
  both spec changes, so both must be in the document before a single line is generated -
  otherwise 10.1 ships one set of names, some later story fixes one, and the regenerated
  client renames a symbol under call sites that were already adopted.
- **10.2 verifies the path equivalence rather than trusting this document.** The check has
  been run across all 17 data routes and came back clean, and it is recorded under "The
  mutator, and the FR-25 seam" so the story starts from evidence rather than from scratch -
  but a route that fails it invalidates the epic's shape, so the story re-runs it and stops
  if it finds an exception.
- **10.3 lands before any adoption story**, exactly as 9.4 did, and for the same reason:
  once components import generated symbols, a stale generated file is a broken app rather
  than a stale file. It was planned as a Dockerfile story in the frontend's file only.
  *As shipped it inverted*: the owner-feedback rounds took the check out of both
  Dockerfiles instead of adding one, so 10.3 ends with neither image reading a spec.
- **10.4 to 10.6 are adoption.** Nothing in them may restructure a component (GR-7), and
  10.6's acceptance runs GR-6's grep, which will report the mutator - see F5. The Scrum
  Master should write that criterion as "every surviving hit is crypto.com, a GR-1 file, or
  `frontend/src/api/http-client.ts`" rather than as the PRD's current enumeration, and F5's
  PM action makes the same correction in `prd.md`.

The epic ends with the frontend still calling the Next.js routes and every page rendering
identically, because the seam defaults to `legacy`. The browser check that stories 9.5 and
9.6 could not perform belongs to the owner at this epic's gate, as the PRD says.

**What Epics 5 and 7 inherit from Epic 10, stated because they read this next.** Every
backend DTO change from here on is also a frontend client change, and nothing automates it:
bring `nest-api` up, run `pnpm --filter @portfolio/frontend spec:generate`, and commit
`frontend/src/api/generated.ts` **in the story that changed the DTO**. Epic 5 implements
the domains, so it changes DTOs constantly - this applies to nearly every one of its
stories. Epic 7's story 7.2 flips `NEXT_PUBLIC_API_TARGET` to `nest`, which is a Compose
build-arg change and needs no regeneration.

**Epic 5 - domains.** Each story's NFR-4 diff must compare runtime types, not just
rendered values, for the raw-deserialization reason above. Story 5.7 ships two formatters
per F2. Story 5.9 records the F3 divergence.

**Epic 6 - build the seam.** Two seams, both switched by config with defaults that
preserve today's behavior exactly: a data base-URL seam (`''` today, `'/backend'` after)
and an auth seam covering client-side session reads, `getServerAuthSession()` in the two
pages, **and `src/middleware.ts`** (F1). Nothing observable changes in this epic.

**Epic 11 - scope the delete to its owner. Complete, shipped as `246feeb`.** It runs
between Epic 6 and Epic 7, and this entry is the record of that step rather than an
obligation - the epic was added to the PRD after this document was last revised and
landed before it was next revised, so what follows is written backwards from what
shipped. One story, one endpoint, one requirement (FR-27): `deleteTransaction` in
`backend/src/transactions/transactions.service.ts` takes the caller's id and filters its
`nativeDelete` on `{ id, userId }`, with the controller passing `user.sub` - the value it
already passed to `addTransaction`. No new branch, no new response shape.

Two properties of it are worth carrying forward, because they are the parts a reader
would otherwise have to re-derive from the diff.

- **A foreign-owned id is indistinguishable from a nonexistent one, and that was
  verified rather than assumed.** Both land in the existing zero-affected branch and
  raise the same `InternalServerErrorException`, so they agree on the error body; they
  also agree on the two observability surfaces that could have leaked the difference. The
  global filter's `HttpException` branch returns before it logs, so neither case produces
  a log line, and the metrics interceptor labels on method, matched-route `path`, and
  `status_code`, all three of which are identical for the two cases. See D65.
- **The old Next.js route was deliberately not touched, and the gap that leaves is
  owner-accepted rather than overlooked.** `frontend/src/app/api/transaction/[id]/route.ts`
  is GR-1 territory, so it kept deleting by bare `id` for the entire coexistence window.
  The ownership hole FR-27 exists to close therefore stayed reachable through the old
  origin until story 7.2 flips traffic off it - that is the moment the fix takes effect
  in practice, not this epic.

**Its position in the sequence is load-bearing, which is why the hole this entry fills
mattered.** It had to land after Epic 5 (there must be a delete endpoint to scope) and
before Epic 7, because Epic 7 is the last point at which both routes serve traffic and
the tightening can be diffed against the unscoped original. That diff is the epic's NFR-4
evidence and it is not reproducible afterwards.

**Epic 7 - flip.** Auth first, then data all at once, as the PRD sequences it. The Epic
7.1 acceptance must include middleware-gated routes. **The epic is three stories - 7.1,
7.2, 7.3 - and the number 7.4 is retired**: the developer-documentation work it carried is
now Epic 13, so that the cutover's diff contains nothing but configured values and a
post-flip regression has exactly one possible cause. Read any surviving citation of 7.4,
here or in a story file, as pointing at Epic 13.

**Epic 12 - refile the auth seam's server modules.** Runs after the flip - Epic 13's
setup docs follow it and close the initiative - and is a path change and nothing else:
`frontend/src/server/session.ts` and `authSession.ts` moved to `frontend/src/auth/` (as
`session.ts` and `serverSession.ts`), four importers changed specifier, no exported name,
signature, or runtime behavior moved (D64). Two obligations it inherited from this document. **Every citation of those two paths here was written
against the pre-move location on purpose** - five of them: in the Overview, under "Session
design", under "`packages/shared` - scope and build" (two adjacent paragraphs, counted as
one), in D25, and in D64 itself, which is the sentence licensing the other four and
retired with them - because they were correct until story 12.2 executed the move. That
story was the *trigger* for repointing them, not the owner of the work: **story 12.2 does
not edit this document.** Repointing was an Architect obligation, discharged by a
`bmad-architect` pass once 12.2 had landed, matching the PRD's "that document is the
Architect's and this epic does not edit it". What story 12.2 owed was the handoff, not the
edit - its Dev Notes record that the five citations were then stale and name this paragraph
as the inventory, and its completion is what made the refresh due. The backstop was a grep
of this document for `src/server/session.ts` and `src/server/authSession.ts` after the
move: every surviving hit must be defensibly historical rather than a live path. And
**the Edge path is the one to prove**: `middleware.ts` reaches `@portfolio/shared` through
the moved file, so GR-5's Dockerfile wiring stays load-bearing across the move and a
production `next-app` image build belongs in the epic's
evidence rather than in its assumptions.

**Epic 13 - developer-setup docs.** Runs last and is prose only: the pnpm workspace, the
Node 24 / pnpm 11 toolchain, bringing the stack up over local HTTPS, the `next-app` +
`nest-api` topology behind nginx, and the `OBSERVABILITY.md` `METRICS_SECRET` rotation
steps that story 5.9 made wrong by adding a third consumer of that secret and a second
Prometheus job. No file under `frontend/src`, `backend/src`, or any config or compose file
is edited. Two things it inherits from this document. **It runs after Epic 12 for
durability, not truth** - every fact about the toolchain and topology is already true after
Epic 7, but a repo-layout section written before 12.2 names two paths that move one epic
later, and a setup doc that is wrong about where a file lives is worse than one that omits
it. **And it reads this document after the Epic 12 repointing pass, not before** - the two
refreshes are ordered, so the layout section is copied from citations that are already
current rather than from ones known to be stale.

**On NFR-5's "configuration, not code."** One wrinkle to be explicit about:
`NEXT_PUBLIC_*` values are inlined at Next build time, so flipping the base URL is a
container rebuild rather than a restart. That still satisfies NFR-5 as written - the
*value* changes, no source changes - and the alternative is runtime config plumbing in
the frontend that Epic 8 would then have to remove. On a Compose stack where rebuilds are
routine, accepting the rebuild is the right trade.

---

## Key Decisions

| # | Decision | Alternatives rejected, and why |
| --- | --- | --- |
| D1 | **Same-origin path prefix `/backend`, Nest global prefix `/backend/api`** | A separate `api.tubesock.xyz` subdomain. It would require CORS with credentials, a `Domain=` cookie, `SameSite=None`, and a second SAN in the mkcert local flow - three mechanisms to maintain for no benefit on a single-host Compose deployment. The prefix also makes every post-prefix path identical to today's, so the Epic 6 seam is one string. |
| D2 | **Stateless JWT, no session store** | Opaque token in Redis or MySQL. FR-13 forbids the schema change a DB session table needs, and a Redis-backed token would put a network hop in Edge middleware on every page navigation - and Edge cannot reach Redis directly, so it would mean an HTTP call to Nest per navigation. Stateless also mirrors today's NextAuth `jwt` strategy, so FR-7 and FR-8 fall out of the existing shape. |
| D3 | **ES256 (ECDSA P-256 / SHA-256), asymmetric** | (a) **HS256 with a shared secret** - rejected on privilege separation: verify key == sign key, so giving Next what it needs to read a session also gives it what it needs to issue one, which partially dissolves the ownership boundary this whole migration exists to draw. Noted honestly that on a single-host Compose stack where both containers read the same env files this is partly hygiene rather than a hard boundary - but it is nearly free and it makes the ownership model true in code. (b) **EdDSA / Ed25519** - briefly adopted and then reversed in favour of the most commonly deployed practice. Ed25519 was not in the original WebCrypto spec and runtime support is more variable; that is the wrong property for an auth path that gates every page navigation through Edge middleware. ES256 sits alongside RS256 as the standard asymmetric JWT algorithm, is what most modern OIDC providers sign with, and has universal WebCrypto support. |
| D4 | **Split libraries: `@nestjs/jwt` signs, `jose` verifies** | `jose` on both sides. Under the earlier EdDSA decision the split was impossible - `jwa@2.0.0`, which backs `jsonwebtoken@9.0.3` and therefore `@nestjs/jwt@11.0.2`, does not implement EdDSA. **ES256 removes that pressure entirely**, since jwa's supported list includes ES256 (verified from source). So the backend keeps the Nest-idiomatic, DI-friendly module. **`jose` on the Next side remains forced regardless of algorithm** - by the Edge runtime, not by the crypto: `jsonwebtoken` is built on `node:crypto`, which does not exist in the Edge sandbox. Drift between the two libraries is prevented by declaring the algorithm, cookie name, and claim type once in `packages/shared`, and by pinning `algorithms: ['ES256']` on the verify side so an attacker-controlled token header cannot downgrade the algorithm. |
| D5 | **`jose@6.2.9`, frontend side only** | `jose@5.10.0`, which was the earlier pin and existed **solely** because jose 6 targets Node 20+ while the frontend sat on Node 18. D26e removes that constraint, so there is no reason to adopt a superseded major. Because the backend signs with `@nestjs/jwt`, jose is not a backend dependency at all, and since the verify helper moved out of the shared package (D25) it is not a shared-package dependency either - this pin lives in `frontend/package.json` and constrains the frontend alone. |
| D6 | **Keys generated with openssl, stored as JWK in env vars; private key to nest-api only** | PEM in env vars. A JWK is single-line JSON that survives `env_file` and Compose intact; PEM's newline-delimited block does not without escaping, and escaped-newline env values fail only inside the container, which is the worst place to discover them. The public key is deliberately available to the frontend container - it is public by construction, and its presence there is exactly what enables local verification without granting the ability to issue. |
| D7 | **httpOnly cookie `portfolio_session`, `SameSite=Lax`, Nest sets it directly** | `Authorization` header with the token in `localStorage`. That breaks FR-8 outright - a server component cannot read `localStorage` - and it exposes the token to XSS. Returning the token for Next to set was also rejected: same-origin makes the extra round trip pointless. |
| D8 | **Single token, `exp` 8h or 30d, non-sliding** | Short access token plus long refresh token. It is the modern default but needs a refresh endpoint, rotation, a concurrent-refresh race, and a revocation store - and it does not match FR-7, where `rememberMe` governs how long you stay logged in, not access-token lifetime. Non-sliding matches `src/server/auth.ts:103` exactly. |
| D9 | **Logout clears the cookie; `jti` carried but unused** | A Redis `jti` denylist. It would force Edge middleware to consult Nest on every navigation - the same objection that killed D2's alternative. Cookie-clear is what NextAuth does today, so it is parity, and FR-10's own wording scopes invalidation to the browser and server components. The `jti` costs a few bytes and makes a denylist addable later without a token-format change. |
| D10 | **Next verifies the session locally with the public key** | Calling `GET /auth/session` from server components and middleware. Local verification costs no network hop per render and, per F1, avoids adding latency and a coupling to backend availability on every matched page navigation. The Nest session endpoint still exists as the canonical FR-9 shape and the client-side `useSession` replacement. |
| D11 | **Flipping the auth seam forces a re-login** | Translating a live NextAuth session into a Nest one or vice versa. That means one system minting credentials it cannot itself verify, for the convenience of not retyping a password on a single-user personal app. Distinct cookie names and distinct keys keep the two systems mutually unintelligible, which is what makes the flip-back trustworthy. |
| D12 | **entity-generator once as a seed, output hand-tuned and owned** | (a) Hand-writing entities from `schema.prisma` - would miss `float` vs `double`, `NetCashFlow`'s `DATE` primary key, and whatever `TokenPriceHistory` actually has given Prisma declares no `@id`. (b) Treating generated output as a regenerable artifact - destroys every hand refinement on the next run. Generate-then-own gets the fidelity without the lock-in. **Unaffected by the D33 reversal:** `GenerateOptions` carries `entityDefinition: 'decorators'` and `decorators: 'legacy'`, so the generator emits the chosen style natively. The original raw output is already captured in `mikroorm-generator-raw/`; it stays as the record of observed database facts even though its syntax is no longer the target style. |
| D13 | **Entity properties mirror DB column names exactly, explicit `fieldName`, no naming strategy** | A camelCase naming strategy with mapped field names. Prettier, but some of these names flow straight into FR-3-pinned JSON, the owner already knows them, and it would add a translation layer to hold in your head for nothing. **Confirmed to express cleanly in MikroORM 7, and re-confirmed in the decorator style after the D33 reversal.** `PropertyOptions.fieldName` is the same option the `p` builder wrapped, so `@Property({ fieldName: 'coinName' })` and `@Property({ fieldName: 'token_info_id' })` both mapped 1:1 on 7.1.13, with the DDL dump naming exactly the declared columns. The decision stands unchanged; only the syntax that expresses it has moved twice. **The trap moved with it:** `@Property({ name: 'coinName' })` still silently resolves to `coin_name`, so `fieldName` remains mandatory and `name` remains forbidden. Since all seven entities and the FR-3-pinned JSON field names depend on this, the conversion review should check `fieldName` presence per property rather than per file. |
| D14 | **`@mikro-orm/migrations` is never installed** | Relying on config flags to disable schema generation. A missing package cannot be invoked; a config flag can be overridden or bypassed. This is the strong form of the FR-13 guarantee. `schema:update --dump` remains available as a read-only drift check. |
| D15 | **`@mikro-orm/nestjs` + `MikroOrmMiddleware` for request context** | (a) Manual `em.fork()` per service - boilerplate that will eventually be omitted somewhere, and the resulting bug is a cross-request data leak that is very hard to see. (b) Nest `Scope.REQUEST` providers - request scope is contagious up the whole injection chain with real instantiation cost, and buys nothing over AsyncLocalStorage. |
| D16 | **Split SQL port: verbatim for aggregates, ORM for simple queries** | (a) All verbatim - safest for parity but teaches nothing about MikroORM, which is the stated point of the initiative. (b) All rewritten to QueryBuilder - stacks a rewrite on top of a byte-for-byte parity proof, and for the aggregate queries the SQL *is* the contract. The split puts the ORM where it earns its keep and leaves the risky queries alone. |
| D17 | **Formatting helpers are pure functions, not injectable providers** | A `FormattingService`. NFR-1's DI requirement targets ambient, stateful collaborators - the EM, the session, the clock. A pure `formatUSD(n): string` has none of those properties and is already trivially unit-testable as a direct import; a provider would make every call site worse for no gain. Recorded explicitly as a reasoned carve-out so it is not read as an oversight at review. |
| D18 | **Two USD formatters, not one** | Unifying them, which is what "reconciled" in story 5.7 could be read to mean. They are behaviorally different (see F2) and FR-3 pins both outputs; unifying breaks whichever endpoint loses. |
| D19 | **`@FormattedValue` composed decorator for pre-formatted string fields** | Plain repeated `@ApiProperty({ type: String, example, description })`. This cuts against the standing preference for explicit repetition over abstraction, so the reasoning matters: what is being centralized is a **contract semantic, not a code shape**. The whole risk the Analyst flagged is that a future reader "fixes" a `string` field to a `number` and silently breaks the frontend. The decorator makes the rationale travel with all ~20 such fields automatically, where repetition makes it something that can be omitted on the twenty-first. |
| D20 | **Hand-written DTOs** | (a) Derived from entities via mapped types - actively wrong, since most responses are computed aggregates corresponding to no entity. (b) Derived from Zod via `nestjs-zod` - `zod` is already a dependency and this is tempting, but it creates a second source of truth for response shapes. Decisively: GR-2 makes the DTO the artifact under review at the gate, and hand-writing forces a look at every field, which *is* the gate. |
| D21 | **Permissive request validation** (`whitelist: true`, `forbidNonWhitelisted: false`, coercion only) | (a) No request validation, for strict parity. (b) Strict validation with real business rules. Today's routes trust their bodies entirely, so any validation is a divergence - recorded knowingly. Permissive is chosen so it cannot reject a request the old route accepted, which would surface as an Epic 7 regression rather than as an improvement. FR-3 constrains responses only. |
| D22 | **Global error filter passes through explicit bodies** | A uniformly-JSONifying filter. It would break the plain-text `403 Forbidden` of the metrics guard and the bare-JSON-string responses of `exchange-rates/unit/:unit`, both of which FR-5 and FR-3 pin. |
| D23 | **`SWAGGER_ENABLED` flag, access restricted at nginx** | (a) A hardcoded `NODE_ENV !== 'production'` check - cannot be flipped without a rebuild. (b) Guarding Swagger behind the app's own JWT - breaks Try-It-Out and makes reading the docs require a login, for the one person the docs exist for. Ingress restriction is the right layer, and the `/backend` prefix means it is one more directive in a block that already exists. |
| D24 | **Root `tsconfig.base.json` + per-package lint, no config packages** | `packages/tsconfig` and `packages/eslint-config`. Two consumers, one repo, nothing published - a config package is ceremony until there is a third consumer. The base is kept thin because the two compilers genuinely differ; it exists to stop `strict` drifting, not to unify things that are not alike. |
| D25 | **`packages/shared` limited to the session claim contract - types and constants, no runtime dependencies - with a small `tsc` build** | **Narrowed during Epic 4's review, on the owner's decision.** The original scope also included a `jose`-based `verifySessionToken` behind a `./verify` subpath; it now lives in `frontend/src/auth/session.ts` - moved there from `frontend/src/server/` by Epic 12 (D64), which changes nothing this row decides. The reason is that it had exactly one consumer - the backend verifies through its own `SessionService` using `@nestjs/jwt` and never imported it - so it was a shared *shape of code* rather than a shared concern, and it was the only thing forcing a runtime dependency and a second entry point onto the package. The claim contract carries the decision on its own: both sides read the same token independently, so the payload type, algorithm name, and cookie name must not drift. `jose` is now a direct dependency of `frontend/` alone. Nothing in the runtime design moved with it - local verification in Edge middleware and server components, and the explicit ES256 pin on both sides, are unchanged. Alternatives rejected: (a) No shared package, duplicating the claim type - but FR-8 plus F1 make the claim shape a genuinely shared concern needed on both sides. (b) Sharing response DTOs too - drags `@nestjs/swagger` into the frontend bundle and invites exactly the frontend refactor the PRD forbids. The build step is preferred over zero-build because `tsc` resists emitting from outside `rootDir`, and boring infrastructure beats clever infrastructure. |
| D26 | **`node:24-bookworm` for both packages** | (a) **Node 22** - now **Maintenance LTS** (since 2025-10-21), security fixes only; it clears pnpm 11's floor and is the smallest jump from 18, but it is a shorter-lived answer that would need redoing sooner. (b) **Node 26** - **Current**, not LTS until 2026-10-28; running Current on unattended infrastructure is the thing being avoided. (c) **Node 20** - dismissed on two independent grounds: EOL since 2026-04-30, and below pnpm 11's `>= 22.13` floor, so it unlocks nothing. The dependency floor (`@mikro-orm/core@7.1.11` requires `>= 22.17.0`) is satisfied by 22/24/26 alike, so the floor is not the deciding factor - **Active LTS status is**. Revisit scheduled for ~2026-10-20, when 24 enters maintenance and 26 becomes Active LTS. |
| D26e | **The frontend's Node bump happens in Epic 1, not Epic 8** | Leaving the frontend on Node 18 for the initiative and fixing it during deferred cleanup - which was this document's own earlier position, on the reasoning that it was unrelated risk on an already-large branch. **Reversed after measuring the risk instead of assuming it.** Node 18 has been EOL since 2025-04-30, so deferring was not a neutral choice but a decision to build and ship on an unsupported runtime. The presumed blocker was Next 14.0.1 (October 2023, predating Node 22 entirely); a spike proved it builds, boots, serves a server component, **and executes Edge middleware with working ES256 WebCrypto** on Node 24, with `bcrypt@5.1.1` fine because it is N-API and therefore ABI-stable across Node majors. **The decisive sequencing argument is not the lockfile** (see the D26a correction - pnpm 10 and 11 share `lockfileVersion: '9.0'`, so there is no format migration). It is **parity evidence**: NFR-4 requires per-domain response diffing throughout Epic 5, and NFR-3 requires the stack to run at the end of *every* epic. If the frontend's runtime changes in Epic 8, every parity comparison gathered across Epics 5 and 7 was taken on a runtime the project no longer uses, and the final state is the one state never validated. Bumping in Epic 1 means all subsequent work is built, diffed, and signed off on the runtime that ships. It also collapses two changes into one: base image, `engines`, `.nvmrc`, and the pnpm major all get set once. **Upgrading Next was considered and rejected as unnecessary** - the spike shows 14.0.1 runs correctly on Node 24, so no framework upgrade is in scope. |
| D26a | **pnpm pinned to 11.22.0** | pnpm 10.34.5, which was the earlier pin and was **forced by the frontend's Node 18** (`pnpm@11` requires `engines.node >= 22.13`). D26e removes that constraint, so the workspace goes straight to the current major rather than adopting a version it would want to leave. Verified on 11.22.0: plain `pnpm deploy` works under `injectWorkspacePackages: true`, so the D26c design holds. **Correction to the reasoning that prompted this spike:** the concern was that deferring the Node bump would force a lockfile-format rewrite across the whole workspace at the end of the initiative. That specific risk **does not exist** - pnpm 10 and pnpm 11 both write `lockfileVersion: '9.0'` (verified by generating a lockfile under each), so moving between them is not a format migration. The sequencing conclusion still holds, but on the different and stronger grounds recorded in D26e. |
| D26b | **Generic copy-all-manifests Docker pattern, not `pnpm fetch`** | **`pnpm fetch` + `pnpm install --offline`**, which is pnpm-native and keys its download layer on the lockfile alone. Evaluated properly rather than assumed, and rejected on two verified findings. **(1) Its headline advantage does not exist at this scale.** `pnpm fetch` does not avoid copying workspace manifests - the subsequent `install --offline` still needs every one of them to link the workspace, so the "manifest dance" is unavoidable either way. What it actually buys is finer layer-cache granularity, which is worth little here where the lockfile and the manifests change at essentially the same times. **(2) pnpm's own CLI marks it experimental:** *"WARNING! This is an experimental command. Breaking changes may be introduced in non-major versions of the CLI."* Build infrastructure that nobody is babysitting should not sit on a command that can change under a patch bump. It also required `pnpm-workspace.yaml` and the root `package.json` to be present despite being documented as reading only the lockfile - with the lockfile alone it silently no-ops and the later `--offline` install fails with `ERR_PNPM_NO_OFFLINE_TARBALL`. Both flows were verified working end to end; they are near-equivalent in outcome, so the tiebreaker is which is easier to debug at 2am, and that is the generic pattern. |
| D26c | **`injectWorkspacePackages: true` in `pnpm-workspace.yaml`, written before the first install; production stages then run plain `pnpm deploy`** | **Reverses this document's earlier decision to use `pnpm deploy --legacy`**, which was a hack: `--legacy` opts into behavior pnpm has already declared transitional and will remove, and the two objections that had been raised against the supported path do not survive testing on a greenfield workspace (all of the below re-verified on pnpm 11.22.0 / Node 24, in a miniature `frontend` + `backend` + `packages/shared` workspace, ending in a real `node:24-bookworm` Docker build that runs). **(a) `pnpm deploy --legacy`** - rejected now that it is not needed. It is a deprecated-by-design escape hatch on the single command that produces the production image, i.e. exactly the place where a silent removal in a future pnpm major becomes a build outage during an unrelated dependency bump. **(b) `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH`, the first objection to injection - does not apply here.** It fires only when the setting is *added* to a workspace whose lockfile predates it; the earlier session almost certainly tested exactly that migration shape. Reproduced deliberately to confirm the mechanism, then shown to vanish when the setting is present in `pnpm-workspace.yaml` before the first `pnpm install`: the lockfile is then born with it in `settings:`, and both plain and `--filter` frozen installs pass from the first one onward. Story 1.3 creates this workspace from scratch, so the ordering is free. **(c) "Injection turns symlinks into hard copies and breaks the dev loop", the second objection - does not reproduce at all.** With the setting on, pnpm 11.22.0 still writes `version: link:../packages/shared`, still symlinks `backend/node_modules/@portfolio/shared`, and creates no injected entry in the workspace virtual store; editing shared and rebuilding is visible to the consumer with no reinstall. Same on pnpm 10.34.5, and same when shared carries its own runtime dependency. Injection materializes only inside the `pnpm deploy` output, which is what is wanted. **(d) Bundling the backend** (`nest build --webpack`, so `packages/shared` compiles into `dist/` and the image needs no workspace resolution) - costed for the first time and rejected on three measured findings. Its premise is false: Nest's default webpack config externalizes `node_modules`, so the emitted bundle still contains `require("@portfolio/shared")` and the production image still needs the workspace resolved - the deploy problem is untouched. Forcing shared to inline requires a hand-written `webpack.config.js` with a `webpack-node-externals` allowlist; doing so pulls MikroORM into the bundle and the build then **exits 1** with `Module not found: Error: Can't resolve 'tinyglobby' in .../@mikro-orm/core/utils` (its `file-discovery` module), while also emitting lazy chunks for MikroORM's dynamic driver imports. And glob entity discovery is genuinely incompatible with bundling: `entities: ['./dist/**/*.entity.js']` against a bundle fails with `MetadataError: No entities were discovered`, so entities would have to be registered by explicit import. A custom webpack config, an ORM-shaped build error to suppress, and a constraint on how entities are registered - all to solve a problem one line of YAML solves. |
| D26d | **One lockfile, accepting cross-package cache invalidation** | Per-package lockfiles, to stop a frontend dependency change from invalidating the backend's cached install layer. Rejected: it would defeat the workspace, let the two packages resolve `packages/shared`'s transitive dependencies differently, and reintroduce precisely the drift a monorepo exists to eliminate. The shared invalidation is the price of one coherent resolution and one meaningful `--frozen-lockfile` check. Recorded so it is not later mistaken for a misconfiguration. |
| D27 | ~~**`nest-api` on 3001, no host port published**~~ **- amended by Epic 10: `nest-api` publishes `127.0.0.1:3002:3001`.** The original reasoning anticipated this exactly ("if direct debugging access is wanted later, 3002 is free") and Epic 10 took that fallback, for a reason that did not exist when this was written: Orval's input is a URL, so `spec:generate` must reach `/backend/docs-json` from the host (FR-26). Host 3001 is Grafana's, hence 3002. **The binding is loopback-only, and that qualifier is load-bearing.** Docker's short syntax (`3002:3001`) binds `0.0.0.0`, which on the deployment host would publish the API, the Swagger UI (`SWAGGER_ENABLED` defaults true) and `/backend/api/metrics` over plain HTTP, bypassing nginx and its TLS - caught in Epic 10's review as F2 and fixed before the epic closed. nginx is still the only *ingress*; the mapping is a developer-workstation affordance. | Publishing it for direct access. Host 3001 is Grafana's, and keeping nginx as the single ingress matches the rest of the stack's posture. If direct debugging access is wanted later, 3002 is free. |
| D28 | **Winston bound as Nest's LoggerService** | Nest's built-in logger with a JSON transport. Winston is what produces the exact field set (`service`, `environment`, timestamp, level) that the existing Alloy → Loki → Grafana pipeline and dashboards are built against; reproducing it faithfully with a different logger is work with a downside and no upside. |
| D29 | **`nestjs-cls` for request ids; current user passed as a parameter** | Putting the current user in CLS too, which would be more convenient. The rule is: telemetry metadata may be ambient, anything domain logic *branches on* is a parameter. NFR-1 names the session as one of the three ambient dependencies that are painful to unpick, and an ambient current user is exactly the trap it describes. |
| D30 | **`dayjs` + injectable `Clock` + `TimeFrameService`; `TZ=UTC` pinned** | (a) `moment`, already present but in maintenance mode; the backend is a fresh package with no migration cost. (b) Native `Date` - too little for the range arithmetic involved. The TZ pin is not incidental: `DATE` columns plus host-local time arithmetic will shift time-frame boundaries by hours and present as a query bug. |
| D31 | **Prometheus `job` label distinguishes the two services** | Renaming the backend's metrics to avoid collision. Renaming breaks the existing dashboards; two `job`s on one metric name is precisely what that label is for. |
| D32 | **NFR-5 flip-back accepts a container rebuild** | Runtime config plumbing in the frontend so the base URL is a restart-only change. `NEXT_PUBLIC_*` is build-time-inlined, so runtime config means new machinery that Epic 8 would then have to remove. A rebuild with a changed env value is still "configuration, not code," and rebuilds are routine on this stack. |
| D33 | **Stay on MikroORM 7; entities are classes carrying decorators from `@mikro-orm/decorators`, with explicit `type` and `fieldName` on every property** | **This decision was reversed after Epic 3 shipped, and the reversal is the point of the entry.** The original decision was `defineEntity()` + the `p` builder, justified by the claim that "v7 exports no decorators at all" and that decorators via a compatibility shim were "not a thing that exists". **The justification was false.** Decorators were not removed in v7, they were moved to a separate top-level package: `@mikro-orm/decorators`, with `./legacy` and `./es` entry points, introduced in upstream PR [#7011](https://github.com/mikro-orm/mikro-orm/pull/7011) and documented in the [v6-to-v7 upgrade guide](https://mikro-orm.io/docs/upgrading-v6-to-v7). The underlying *observation* was right and re-verified on the installed 7.1.12 - `Entity`, `Property`, `PrimaryKey`, `ManyToOne`, `Unique`, `Index`, and `CreateRequestContext` really are `undefined` on `@mikro-orm/core` - but "absent from core" was read as "absent from v7", and no search was done for where they went. Recorded as a standing caution: a negative result about one package is not a negative result about a framework. **Owner decision, not re-litigated here:** entities are decorated classes. **What the reversal costs:** the seven Epic 3 entities and `src/entities/mikro-orm.module.ts` get converted; the paired `class X` / `const XSchema` exports collapse to one exported class; `core`, `mysql`, `cli`, and `entity-generator` move 7.1.12 to 7.1.13 alongside `decorators@7.1.13`, which pins its core peer exactly. **What it does not cost:** D12 (the generator emits decorators natively via `entityDefinition: 'decorators'`), D13, D14, D15, D16, and everything from Epic 4 onward. Alternatives still rejected: **pinning MikroORM v6** - the motive for it was to keep decorators, which v7 has, and v6 is a superseded major to learn an ORM on; **`defineEntity` retained** - overridden by the owner. **Surviving evidence from the original spike, gathered on a throwaway MySQL 5.7 container loaded with this project's real schema via `prisma db push`, all re-verified as style-independent:** `orm.getSchemaGenerator()` is now `orm.schema`; `getMetadata().getAll()` returns a **`Map` keyed by the entity class**, so `Object.keys()` is `[]` and `.has('Name')` is `false` while `.get()`/`.getByClassName()`/`.find()` return correct post-discovery metadata, meaning an FR-12 completeness check written against `getAll()` would silently pass on nothing; `@mikro-orm/nestjs@7.0.2` + `MikroOrmMiddleware` forked the EM per request (ids 5, 7, root 2); `orm.schema.getUpdateSchemaSQL({ safe: true })` ran with `@mikro-orm/migrations` absent; and the `name`-vs-`fieldName` trap, which **survives into decorator syntax unchanged** - `@Property({ name: 'coinName' })` resolves to column `coin_name` on 7.1.13. |
| D34 | **`@mikro-orm/decorators/legacy`, not `/es`** | **`@mikro-orm/decorators/es`, the TC39 standard-decorator entry point.** This is the one genuinely open question the D33 reversal created, and it is **forced, not preferred**. TC39 standard decorators and TypeScript's `experimentalDecorators` are mutually exclusive at the project level, and **NestJS 11 requires `experimentalDecorators` plus `emitDecoratorMetadata`** - its entire DI container reads constructor types from `design:paramtypes`, which only `emitDecoratorMetadata` emits, and that flag is only honoured under `experimentalDecorators`. `backend/tsconfig.json` has both set to `true` today for exactly that reason. Since a tsconfig cannot mix the two decorator implementations, the ORM has to use whichever one Nest dictates. Verified rather than assumed: compiling the identical entity against `/es` under `experimentalDecorators: true` fails at every single decoration with `TS1238: The runtime will invoke the decorator with 1 arguments, but the decorator expects 2` on classes and `TS1240: Argument of type 'string' is not assignable to parameter of type 'ClassFieldDecoratorContext'` on properties - the signatures are structurally incompatible, not merely differently typed. The same file against `/legacy` compiled clean and discovered correctly. Secondary confirmations, none of which had to carry the decision: `/legacy` is the entry point aligned with the surrounding NestJS, `class-validator`, and `@nestjs/swagger` decorators the backend is already full of, so one mental model covers the whole file; `/es` cannot use `emitDecoratorMetadata` and so would require an explicit `type` on every property, which this design requires anyway. **The cost, stated honestly:** `/es` is where MikroORM is heading, so this is a bet that Nest adopts standard decorators before the legacy entry point is retired. That is a safe bet on the current evidence - Nest's DI has no standard-decorator story yet, and legacy decorators are not going anywhere while it does not - but it is a coupling worth revisiting whenever NestJS ships standard-decorator support. **`reflect-metadata` is not a new dependency**: it is already a direct backend dependency for Nest, and `@mikro-orm/decorators` declares its peer on it as *optional*, which this design leans on by registering no `metadataProvider` at all. |
| D35 | ~~**The OpenAPI snapshot is generated in Nest preview mode, from the compiled `dist`, by a dedicated entry point**~~ **- superseded by D62. There is no snapshot.** Orval reads the live `/backend/docs-json` off a running container, which is alternative (a) below, rejected here and later chosen by the owner once NFR-6's offline-generation clause was voided. The evidence recorded below stands as measured and is why the rejection was right *at the time*; it is not a reason to reinstate anything. The original alternatives follow. | (a) **Booting the service and curling `/backend/docs-json`** - NFR-6 rules it out outright: the backend reaches MySQL through MikroORM at boot. (b) **Full `NestFactory.create` without preview mode** - instantiates every provider, so MikroORM connects and the generator needs a database, which is the same failure one step removed. (c) **Generating from `src` through a TypeScript loader** - `ts-node` type-checks and fails on `src/auth/current-user.decorator.ts:7` where the `express-request.d.ts` global augmentation is not loaded; `tsx` would probably work but is an unverified guess and a new dependency, and going through `dist` makes the question moot since `nest build` has already emitted JavaScript. Verified on this branch: preview mode emitted all 22 paths and 19 schemas with `DATABASE_URL` pointed at a dead port, **and with no environment variables set at all**, and two consecutive runs were byte-identical at 45,641 bytes. A side benefit worth recording: because the generator does not go through `main.ts`, `SWAGGER_ENABLED` is structurally incapable of emptying the document, which NFR-6 explicitly warns about. |
| D36 | **`main.ts` and the generator import one shared `DocumentBuilder` config and one shared `GLOBAL_PREFIX`** | Letting each construct its own. The drift would be invisible - both sides would be internally consistent while documenting different APIs. The global prefix belongs in the shared module too, not just the Swagger config: `SwaggerModule.setup()` is independent of `setGlobalPrefix`, but document *paths* are not, and the verification run only produced `/backend/api/...` because the generator called `setGlobalPrefix` before `createDocument`. Omitting it strips the prefix from every path in the snapshot while the running service keeps it. |
| D37 | ~~**The snapshot is pretty-printed JSON at `backend/openapi.json`, committed**~~ **- superseded by D62. The file is deleted.** The reviewability argument below did not die with it: it transferred to the generated client, which is committed and Prettier-formatted for the same reason (D46, D53 as amended). The original alternatives follow. | Minified JSON, or YAML. The file's entire job is to be diffed - by `spec:check` and by a human reading a review diff to see which field moved. A 45KB single line defeats both. YAML diffs nicely too but adds a serializer and a second format to the repo for no gain, since nothing reads this file by hand. |
| D38 | ~~**Consumers import verbatim-named aliases from a hand-written `frontend/types/contracts.ts`**~~ **- superseded by D50.** Orval emits named model types directly, so there is nothing left to alias and `contracts.ts` is deleted in story 10.6. **The reasoning survives the file and is now D50's**: the alias file existed to give a DTO a name a consumer could import without indexing a namespace, and to forbid renaming a contract in transit. Orval provides the first for free, and the second is what the explicit-`operationId` convention enforces on the operation side - one grep still finds the controller method, the spec entry, and every call site. Recorded as amended rather than deleted because Epic 9's shipped stories cite it. The original entry follows. | (a) **Indexing the generated namespace at every call site** - `components['schemas']['CoinSummaryResponseDto']` across fifteen files, and a five-level `paths[...]` index for the shapes that have no component schema, is harder to read than the hand-declared types being removed. (b) **Re-exporting under the old frontend names** (`CoinSummaryResp`) to avoid touching call sites - that is renaming a contract in transit, which is the habit FR-20 exists to end; one grep should find the backend class, the schema, the alias, and every consumer. The alias file is safe because an alias declares no structure: it resolves to the generated type or it fails to compile, so a renamed or deleted DTO breaks it immediately. |
| D39 | ~~**The FR-21 staleness check runs inside the two production Docker builds, one link of the chain each; no CI is added.**~~ **- superseded by D62. There is no check, in either image or anywhere else.** Epic 10 first re-pointed the second link at the Orval client; its owner-feedback rounds then removed both links, the committed snapshot and the script. Both `builder` stages now go straight from `common-build` to their own `pnpm build`. **The "no CI" half of this decision survives and is stronger than ever** - the owner has ruled CI out a second time, on top of ruling out the build check, so a contract check has no sanctioned home at all. The alternatives below are kept because they are still the rejected options; what changed is that the option that won is now "none of these". | **Owner decision, reversing this document's earlier recommendation.** The earlier D39 added `.github/workflows/api-contract.yml`, an `on: push` job running `pnpm spec:check`. That is the documented consensus for committed generated artifacts - commit the output, validate drift in CI - and it was put to the owner as the mainstream answer. **The owner ruled CI out.** Recorded as their call and not re-argued. The design that replaces it: a stale contract is a **correctness** failure of the same kind as a type error, not a style gate like lint, so it belongs exactly where `nest build` already fails the image - which is also why D40 taking lint out of the images does not take this out with it. The chain has two links in two images and the split falls out cleanly: `backend/Dockerfile`'s `builder` stage regenerates the spec from the `dist` it just built and byte-compares the committed `backend/openapi.json`; `frontend/Dockerfile`'s `builder` stage copies that committed snapshot in, regenerates `api.d.ts` from it, and byte-compares the committed copy that `COPY frontend/types` already put in the image. Verified rather than assumed: both build contexts are the repo root, root devDependencies install under a filtered `pnpm install` (checked on 11.22.0) so `openapi-typescript` resolves in both images with no install change, and `dev` branches off `common-build` in both files so nothing added to `builder` can break `docker compose up`. **The frontend-side check compiles no frontend TypeScript**, so it lands without touching the 46 errors D41 defers. Alternatives rejected: **(a) a pre-commit hook** - no hook framework, not installed by a clone, bypassed by `--no-verify`; a check that runs only when a human remembers is the discipline FR-21 exists to replace. **(b) The steps in `common-build`** - would fail the dev build over an artifact a background watcher regenerates. **(c) One image checking both links** - means copying the frontend tree into the backend image or vice versa, doubling a build context so one `RUN` sees both ends of a chain whose halves are already each in the right place. **(d) No enforcement, trusting `spec:watch`** - fails on the exact case that matters, someone editing a DTO without the watcher running. **The cost, stated plainly:** nothing runs on a push; `deployment.yml` builds the frontend image on `main` so link 2 is enforced there, but no workflow builds the backend image at all, so link 1 fires only on a local or manual `TARGET=prod docker compose build`. Watch-mode generation (D45) is what makes that acceptable - drift is mostly prevented rather than caught. |
| D40 | **Lint fails no build anywhere; type checking still gates, inherently** | **Reverses the backend half of story 1.6, which is marked Complete.** 1.6 added build-failing lint for `backend/`, correctly against NFR-2 as written at the time. The owner's principle overrides it: **an image build produces an artifact, it does not run quality gates.** So `backend/Dockerfile:44` (`@portfolio/shared lint`, itself an Epic 4 review addition) and `backend/Dockerfile:57` (`@portfolio/backend lint`) are removed, and no lint step is added to CI either. `frontend/Dockerfile` was checked and has nothing equivalent - `next build` would run ESLint, but `next.config.js` already sets `eslint.ignoreDuringBuilds`, so the frontend has always behaved this way and the change makes the two sides consistent rather than divergent. **What survives is the more valuable half**: `nest build` *is* `tsc` and `packages/shared`'s build script is literally `tsc`, so a type error still fails the backend image with no dedicated step - the gate is a side effect of needing the JavaScript, which is the most robust form it could take. Alternatives rejected: (a) **keeping lint in the images because NFR-2 says so** - the requirement is amendable and the owner amended it; F4 routes the text to `bmad-pm`. (b) **moving lint into the new CI job** - honours the letter of NFR-2 while ignoring the reason, which is that lint findings are style and habit, enforced where they are read. NFR-2's text must now cover type checking only. |
| D41 | **`frontend/package.json` gains a `typecheck` script wired into nothing** | (a) Wiring it into the frontend image - it fails today, 46 errors across 19 files re-measured on this branch, and fixing them is a separate epic the owner intends to add. (b) Leaving it out entirely - then producing the number means remembering the right bare `tsc` invocation, and the script is the evidence NFR-2's deferral asks for. **The cost, stated plainly:** until the frontend type-checks, a renamed DTO field is caught by the spec diff rather than by the frontend compiler. The diff still converts the silent runtime drift FR-21 targets into a failed build; what is missing is the second net where a consumer reading the old field name fails to compile. Two files stories 9.5 and 9.6 touch are already among the 19 failing, so "does it typecheck" cannot be their acceptance signal - a per-file error count before and after is. |
| D42 | **`TimeFrame` becomes a generated enum: a `TIME_FRAMES` const in backend source, applied with `enum` + `enumName: 'TimeFrame'`** | (a) **Leaving `TimeFrame` hand-declared in `global.d.ts` as a request-side type** - defensible, since it describes what the frontend *sends*, but it leaves a response field (`timeFramesNeeded`) typed as bare `string[]` and keeps one contract hand-maintained for no reason once the backend can express it. (b) **Adding `enum` without `enumName`** - the values would be correct and the frontend would still get a union, but inlined at each site with no named type to import. The const also makes the wrong `'24h'` example unrepresentable rather than merely corrected. Seven sites take it, not the four the PRD lists: the four `@ApiParam`s, plus `summary.controller.ts:48`'s `@ApiQuery` (documenting the FR-4 path form as an enum and its query-string twin as a free string would contradict itself inside one controller), plus `set-price-history-request.dto.ts:16` and `price-history-check-response.dto.ts:9`. The last two are the same vocabulary, not a lookalike: `frontend/src/app/api/price-history/check/route.ts:8` declares `const timeFrames: TimeFrame[] = ['h','d','w','m','3m','6m','y','all']` and `useStorePriceHistory.ts` feeds each returned value straight back into `POST /price-history/set`. |
| D43 | **`time-frame-coins-pl` keeps its raw `additionalProperties` response schema; the named model is the entry, not the map.** **Amended by Epic 10:** the decision itself stands unchanged - there is still nothing to decorate and the schema is still the correct OpenAPI expression of a `Record<string, TimeFrameCoinsPlEntryDto>` - but its *only consequence* went away with `contracts.ts`. The five-level `paths[...]` alias that this shape forced was the ugliness D38's alias file existed to confine to one line, and Orval names the map type itself, so the shape now has an importable name like every other. Story 10.5 confirms what Orval emits for it, which is the one generated shape worth looking at by eye. | Inventing a class for the map so it becomes a component schema. There is nothing to decorate - the response is `Record<string, TimeFrameCoinsPlEntryDto>`, keyed by product name, and `@ApiProperty` cannot express an arbitrary-key map. The existing `@ApiExtraModels` + `additionalProperties` + `getSchemaPath` form is the correct OpenAPI expression of it and generates cleanly: `openapi-typescript@7.13.0` emitted `{ [key: string]: components["schemas"]["TimeFrameCoinsPlEntryDto"] }`, verified against the real snapshot. The only consequence is that this shape has no component schema to alias, so D38's alias goes through `paths[...]` - which is precisely the ugliness the alias file exists to confine to one line. |
| D44 | **Story 9.7 deletes `Session` and `SessionUser` from `packages/shared` outright** | Migrating their consumers onto generated types first. There are none - grep finds no import of either type in `backend/src`, `frontend/src`, or the package itself, so the "adoption" is a deletion. The shape they described still exists and is still generated: it is the `LoginResponseDto` that `GET /auth/session` returns. What remains - `SessionClaims`, `SESSION_ALGORITHM`, `SESSION_COOKIE_NAME` - is exactly FR-22's boundary, and D25 already argued why those three are a shared *concern* rather than a shared shape. |
| D45 | ~~**`spec:watch` runs on the host as `node --watch-path=backend/src` in front of the same script `spec:generate` runs; Compose is unchanged.**~~ **- superseded by D62. There is no `spec:watch`.** Two independent reasons, and either alone is sufficient: the script it watched is deleted, and Orval's input is now a URL while its `--watch` watches *files*, so a watcher would have to poll the running backend and would race its own hot-reload. Compose being unchanged is also no longer true - `nest-api` publishes a loopback host port so codegen can reach the spec at all (D27). **The consequence is the loss, not the mechanism**: this watcher was the thing that made "no CI" tolerable by preventing drift rather than catching it, and nothing replaces it. See D63. | (a) **A watcher inside the dev container, riding the compile `nest start:dev` is already doing.** Attractive on paper and rejected on the mounts: the dev bind mount is `./backend/src:/app/backend/src` and nothing else, so neither `backend/openapi.json` nor `frontend/types/api.d.ts` would reach the tree the developer commits from. Worse, the backend image contains no frontend tree at all, so this means bind-mounting a slice of `frontend/` into the backend container purely so a watcher can write there - and single-file mounts break when a generator writes by temp-file-and-rename, so `openapi.json` would have to move into a directory that exists only to be mountable. Structure invented to avoid running a command on the host. (b) **A host watcher on `dist`, fed by a parallel `nest build --watch`.** The "reuse a compile that is already happening" advantage exists only inside the container; on the host nothing is compiling, so this is two processes, a concurrency-runner dependency, and an orphaned compiler after every Ctrl-C. **A full `nest build` here measures 1.9 seconds warm**, plus about a second to generate, so incremental compilation buys nothing worth that. `node --watch-path` is built into Node 24, needs no dependency, coalesces rapid changes, and was verified standalone on this machine. Because the watched script *is* `spec:generate`, watch mode and the committed output cannot diverge - there is no second generation path. **Unchanged by the move of enforcement out of CI (D39), and now doing more work.** With no CI job watching pushes, watch-mode generation is the primary way drift is avoided rather than a convenience in front of a CI net: the artifacts stay current as DTOs change, so errors surface in the IDE and in the dev build, and the production-build checks are the backstop. Nothing in the reasoning above depends on where the check runs - the mounts, the host-versus-container argument, and the single-generation-path property are all unaffected. |
| D46 | **The generated client stays committed - amended: there is now exactly one generated artifact, `frontend/src/api/generated.ts`.** `backend/openapi.json` and `frontend/types/api.d.ts` are both deleted, so "both artifacts" is now one. **The decision itself survives Epic 10 intact and matters more than it did**, because it is the last thing standing: with no staleness check anywhere (D62), the committed diff is the *only* place a contract change is visible before it renders wrong in a browser. It is also what keeps NFR-6's surviving half true - a clean checkout typechecks and both images build with no generation step, no running backend and no network. The alternatives below still fail, for a new reason on top of the old ones: generating at build time is impossible when the input is a URL to a service that is not running during a build. | Stated as a decision rather than inherited, since D39 changed what enforces them. Alternatives: **(a) generate at build time and commit neither** - impossible as designed, because `frontend/Dockerfile` has no backend tree and no `dist`, so the snapshot must exist in the build context as a file somebody committed; making it a build product means teaching the frontend image to compile the backend. **(b) Commit `openapi.json` only, generate `api.d.ts` at build time** - the frontend image could do that, but nothing else could: the editor, `frontend/typecheck`, and every `contracts.ts` alias need `api.d.ts` present in the working tree, and a file that must exist for local work but is produced only by an image build is the worst of both. The positive reason is unchanged and still the strongest one: **a committed artifact makes the contract change reviewable**, so a renamed field shows up as a diff hunk in the pull request that caused it rather than as a difference between two build logs. D37's pretty-printing exists for exactly this. |
| D47 | ~~**`--check` compares generated bytes against the file on disk; the generator splits into `--only=spec` and `--only=types`**~~ **- superseded by D62. There is no `--check` and no `--only`, because there is no script.** `scripts/generate-api-contract.mjs` is deleted; the entire toolchain is `frontend/orval.config.ts` plus `"spec:generate": "orval --config orval.config.ts"`. Both halves of this entry - the comparison mechanism and the split - existed only to serve the two-image check that D39 records as gone. The original alternatives follow. | **Amends the earlier design, where `spec:check` ran `git diff --exit-code`.** Git is not available to the check any more: it now runs inside Docker builds, and the root `.dockerignore` excludes `.git` from every build context - copying a repository into an image so a check can call `git diff` is not a trade worth making. One comparison mechanism in both places beats two that can disagree. The `--only` split is forced by the same geometry: each image holds one end of the chain, and `--only=types` must be able to run with no `backend/dist` and no backend source present at all, which is a constraint on how the script is written. **The cost:** on the host, `spec:check` now passes against a regenerated-but-uncommitted tree where the git form would have failed. Accepted, because a Docker build context *is* the working tree, so the gate that blocks anything compares exactly the bytes `--check` compares, and the CI job that would have inspected the commit does not exist by decision. |
| D48 | **No `predev` or `prebuild` hook** - **amended: with watch mode and the production-build check both gone (D45, D62), the hook question is settled by the ruling rather than by the reasoning below.** No hook, in any form, at any lifecycle point: a `pre`-anything that regenerated the client would be a staleness mechanism, which FR-26 forbids, and it could not work regardless, since generation now needs a running backend. The recursion and mount findings below stand as recorded and are no longer the operative reason. | Considered because generation now has no CI net, and rejected on a hard failure rather than on taste. A `prebuild` in `backend/package.json` **recurses infinitely** - the generator's first action is `pnpm --filter @portfolio/backend build`, which fires `prebuild` again - and it would fire inside the Docker `builder` stage too. The container-side variants fail on D45's mount analysis: a `predev` on the frontend runs where there is no backend tree, and a hook on the backend's `start:dev` runs where generated files cannot reach the tree the developer commits from. That leaves a host-level root script, which already exists and is called `spec:watch`. A second entry point into the generator would create the one thing the single-script design exists to prevent: a generation path that can behave differently from the one whose output gets committed. |
| D49 | **One Orval config, `mode: 'single'`, output `frontend/src/api/generated.ts`, mutator `frontend/src/api/http-client.ts`** - **amended: the config lives at `frontend/orval.config.ts`, not at the repo root.** Alternative (c) below rejected a frontend-local config because "the pipeline crosses both packages" and would "need to reach up into `backend/` for its input". That premise died with the committed snapshot: the input is a URL, so nothing at the root has a claim on the config, and both its outputs are under `frontend/src/api/`. Owner decision in Epic 10's round 2, and **it turned out to be a correctness fix as well as a tidiness one** - see D61. `mode: 'single'` and both paths are unchanged; the paths are simply rebased to be relative to the config's new home (`./src/api/...`). | (a) **`mode: 'tags-split'` or `'split'`** - the idiomatic choice for a large API and wrong for this one: 22 operations and 19 schemas is one comfortable file, and a directory tree whose boundaries mirror backend controller tags is a second structure to keep in step with the backend for no navigational gain. It also turns the FR-21 byte-compare from one path into a tree walk. (b) **Output under `frontend/types/`, where Epic 9's artifacts lived** - wrong now that the artifact is runtime code rather than a declaration file; `generated.ts` exports functions and hooks that ship in the bundle, and `frontend/types/` is on the tsconfig include path as ambient declarations. (c) **A config inside `frontend/`** - the pipeline crosses both packages and is already owned by the root, exactly as `openapi-typescript` was; a frontend-local config would need to reach up into `backend/` for its input. Keeping the mutator in the same directory as the generated file is not cosmetic: it makes Orval emit `./http-client` as the import specifier, which is what D55's byte-compare depends on. |
| D50 | **Explicit `@ApiOperation({ operationId })` on all 22 controller methods, following a stated naming convention, landed in story 10.1** | **Owner decision, and it carries D38's surviving half.** (a) **Leaving `@nestjs/swagger`'s derived names** - `SummaryController_getCoins` generates `useSummaryControllerGetCoins()`, which puts a backend class name in a frontend call site and renames every consumer if the controller is ever renamed. (b) **Renaming in Orval's config**, via an operation-name override - the name would then exist only in a generator config, so Swagger UI, the committed spec, and the client would each show something different, which is the same drift D36 exists to prevent one level up. Declaring it in the decorator fixes it in the spec itself, so all three agree and one grep finds the controller method, the operationId, and every consumer. **The convention is part of the decision, not a matter of taste per endpoint:** camelCase, no controller name and no read verb; a read is named for the DTO it returns, pluralized for arrays (`CoinSummaryResponseDto[]` gives `coinSummaries`, hence `useCoinSummaries()`); a write is verb-first (`addTransaction`, `setPriceHistory`); operations returning the same shape are separated by `By<Param>` with the bare name going to the variant the frontend calls today; a response with no DTO noun takes its name from the path (`exchangeRatesByUnit`, `timeFrameCoinsPl`). The full 22-row table is in "Operation names are declared, not derived", including the two entries that are deliberate rather than mechanical - `authSession` to avoid colliding with `next-auth/react`'s `useSession`, which FR-11 keeps alive until Epic 7, and `coinPriceHistory` to avoid colliding with `/price-history/check`. |
| D51 | **`includeHttpResponseReturnType: false` - operations resolve to the bare body, and the mutator throws on non-2xx** | The envelope form (`{ data, status, headers }`), which is Orval's default for the fetch client. Rejected on GR-7: React Query's contract is that `queryFn` returns the data and rejects on failure, the twelve existing hooks are already that shape, and the envelope would make every adopted call site read `.data` where it reads the value today - a component edit at a dozen sites to gain a status code that only two of them look at. **The consequence is named rather than discovered:** `AddTransaction.tsx:161` and `product/page.tsx:17` branch on a status inside `.then` and move to the `.catch` branch they already have. Neither is a restructure. **The one hard requirement this puts on the mutator** is that it lift the error body's `error` field into the thrown `Error`'s message, so `AddTransaction`'s toast text is unchanged - the Next.js route and FR-5's Nest filter both use that key, so it needs no branch on which side of the seam answered. |
| D52 | **`enumGenerationType: 'union'`** | (a) **TypeScript `enum`** - a runtime value where a type is wanted, so `useTimeFrameCoinsPl('3m')` would stop compiling and every call site would have to import and spell `TimeFrame.ThreeMonths`, which is a call-site rewrite GR-7 forbids for zero benefit. (b) **`const` object plus a derived union** - the same import burden with more machinery. The union is also what the hand-declared `TimeFrame` in `global.d.ts` already is, so consumers see no change at all: they pass the same string literals they pass today, and D42's `enumName: 'TimeFrame'` is what gives that union a name to import. |
| D53 | ~~**No formatter over the generated output (`prettier: false`); the path is added to `.prettierignore` and `frontend/.eslintignore`**~~ **- reversed by Epic 10. The config sets `formatter: 'prettier'` and the output is removed from `.prettierignore`.** Two things were wrong with the original. **(1) `prettier: false` was never an option.** `OutputOptions` in `@orval/core@8.26.0` has no `prettier` field at all - formatting is a `formatter` field taking `'prettier'`, `'biome'` or `'oxfmt'` - so the key was a silently ignored no-op that happened to coincide with the default. It only surfaced as an error once the config moved into `frontend/`, where `tsconfig.json`'s `**/*.ts` include type-checks it. **(2) The argument for it was load-bearing on a mechanism that no longer exists**: the committed bytes had to be reproducible inside two Docker images, so a Prettier version resolving differently per image could fail a build. No image regenerates anything now (D62), so the only remaining consumer of those bytes is a human reading a diff - and formatted output is strictly better for that. Determinism was re-verified with the formatter in the pipeline: two consecutive runs byte-identical. `frontend/.eslintignore` keeps its entry; only the Prettier one is removed, and leaving it would have suppressed the formatter Orval runs. | Running Prettier or ESLint `--fix` over Orval's output so it matches the repo's style. Rejected because the committed bytes have to be reproducible inside two Docker images: adding a formatter makes them depend on the Prettier version each image resolves, which is a second thing that can drift and fail a production build for a reason unrelated to the API contract. The generated file is never read for style and never edited, so the only thing formatting would buy is a tidier diff in a file whose diffs are read for *content*. The two ignore entries are the other half of the decision - without them an editor's format-on-save or a `lint --fix` silently invalidates the byte-compare, and the failure appears in a build rather than at the keystroke that caused it. Both ignore files already exist. |
| D54 | **The FR-25 seam is the mutator, keyed on `NEXT_PUBLIC_API_TARGET`, defaulting to `legacy`** | (a) **Orval's `output.baseUrl`** - the obvious answer, and **it cannot work**: verified during the spike that `baseUrl` only *prepends*, with no ability to strip. The spec's paths carry `/backend/api` and the Next.js routes are `/api`, so coexistence needs a prefix *removed*, which nothing but the mutator can do. This is why FR-25 names a mutator, and recording it stops a story reaching for the simpler-looking option. (b) **A per-route mapping table** - unnecessary: the equivalence was checked across all 17 data routes and every one satisfies `spec path === '/backend' + Next.js path`, with identical path params, query params, and bodies, so the mapping is one string operation and there is no table to maintain or let rot. (c) **Regenerating against a rewritten spec for the legacy target** - two committed clients, and the flip stops being configuration, which breaks NFR-5. The value being `NEXT_PUBLIC_*` makes the flip a container rebuild; that is D32, already decided, and this seam inherits it rather than reopening it. Both targets are same-origin relative paths, so no CORS appears anywhere. |
| D55 | ~~**The frontend staleness check keeps its current shape: regenerate and byte-compare, into a sibling scratch directory at equal depth**~~ **- superseded by D62. There is no check, so there is no scratch directory.** `frontend/src/.api-check/` never ships and its `.gitignore` entry was removed. Two findings from this entry outlive it and are still true of the shipped config: **`clean` stays off**, because `output.clean` deletes the target directory and would take the hand-written mutator with it (verified); and **determinism is measured, not assumed** - still the precondition for "regenerate and commit" producing a reviewable diff rather than noise. The equal-depth requirement itself is moot: there is only ever one output geometry now. | Comparing something other than bytes - an AST or a semantic spec diff - or regenerating into a temp directory anywhere convenient. The first reintroduces a second comparison mechanism, which D47 already removed for good reason. The second is a real trap that the spike hit: **Orval writes the mutator import relative to the output file**, so regenerating into a directory at a different depth emits `../api/http-client` instead of `./http-client` and the check fails on one import line while the contract is perfectly current - a failure that is real output, is not a contract change, and does not reproduce when you regenerate for real. A sibling directory at equal depth, with the check-time mutator path pointed inside it, makes the two runs geometrically identical. Two related settings ride along: **`clean` stays off**, because `output.clean` deletes the target directory and the hand-written mutator is a sibling of the generated file - verified, a `clean: true` run removed `http-client.ts`; and determinism was measured, not assumed - two consecutive runs byte-identical, 0.39 seconds each. |
| D56 | ~~**The Orval invocation lives inside `scripts/generate-api-contract.mjs` as `--only=client`, replacing `--only=types`**~~ **- reversed by Epic 10. The `orval` CLI is called directly, and the script is deleted.** `frontend/package.json` carries one script, `"spec:generate": "orval --config orval.config.ts"`, and that is the whole toolchain. The alternative recorded below as rejected is what shipped. It was rejected for a reason that stopped applying: wrapping the CLI protected the single-generation-path property, which mattered because a *second* path existed in the Dockerfiles and in watch mode. With both gone (D45, D62) there is exactly one invocation, so the wrapper was protecting a property it was the only remaining threat to. The equal-depth handling it would have had to duplicate (D55) is moot for the same reason. | Calling the `orval` CLI directly from the Dockerfile and from the root scripts. Tempting because Orval ships a CLI and the script's `--check` was already a hand-rolled comparison - but it produces two code paths that generate the committed bytes, and D45's single-generation-path property is the thing that guarantees watch mode and the committed output cannot diverge. It would also need the equal-depth scratch-directory handling (D55) duplicated in whatever wrapper the CLI got. The script's existing constraint carries over unchanged and is still hard: `--only=client` must run with no `backend/dist` and no backend source present, because it runs in the frontend image. The spec half of the script is untouched - Orval generates clients from a spec and does not produce one from NestJS source, so that half has no replacement and needs none. |
| D57 | **A tsconfig is named explicitly in the Orval config - amended: it is `./tsconfig.json`, the frontend's own, and the frontend's `target` was bumped `es5` -> `es2017` to make that work.** Naming it rather than letting Orval discover one is unchanged and is still the point. What changed is which one, once the config moved into `frontend/` (D49): pointing up at `../tsconfig.base.json` from inside the frontend workspace is a reach across a boundary for no reason, and the reason it originally had - avoiding `frontend/tsconfig.json`'s `target: es5` - was fixable at the source. The `es5` finding below was **understated**: esbuild does not merely emit downlevel helpers, it **refuses** - `spec:generate` fails outright with five `Transforming ... to the configured target environment ("es5") is not supported yet` errors on the mutator's `async`/`const`. Verified in both directions. The bump is safe because the setting is typecheck-only: `noEmit: true`, `lib` is set explicitly so `target` does not select it, `useDefineForClassFields` defaults `false` at both es5 and es2017, Next 14 compiles with SWC and never reads it, and no other tsconfig extends this one - the frontend's 15 pre-existing `tsc` errors are byte-identical at both targets. **The coupling to remember: reverting that `target` breaks code generation.** | Letting Orval discover a tsconfig. Rejected on a landmine rather than on principle: Orval loads `orval.config.ts` and reads the mutator through esbuild, and the discovered tsconfig configures that transpile. `frontend/tsconfig.json` sets `target: es5` - correct for a browser bundle, wrong for a Node-side config load, where it downlevels async functions into emitted helpers and changes output for reasons that have nothing to do with the API contract. `tsconfig.base.json` sets no `target` at all, which is exactly right, and naming it makes the choice visible rather than dependent on the working directory the command ran from. |
| D58 | **The mutator is fetch-based (`httpClient: 'fetch'`), not axios** | `axios`, which is Orval's default client and is already a frontend dependency. Rejected on two counts. **GR-6's test greps for `axios` as well as `fetch(`**, and axios's only importers today are `src/server/helpers/get-exchange-rates.ts` and `update-price-history.ts`, both GR-1 files - so keeping it out of the mutator leaves that half of the grep a pure violation detector, where an axios mutator would make it another exemption to remember. And `fetch` is what Next instruments and patches, what every call site being replaced already uses, and what adds no bundle weight for 22 same-origin JSON calls. |
| D59 | **`TransactionAddRequestDto.unit` is deleted, in story 10.1, before anything is generated** | Keeping it for symmetry with the `Transaction` row's `unit` column. **Owner decision, and the endpoint agrees:** `frontend/src/app/api/transaction/add/route.ts` destructures the body without `unit` and writes `unit: tokenInfo.symbol` from the `token_id` lookup, and `AddTransaction.tsx:161` does not send one. A field the server derives has no place in the request contract, and leaving it in would put an optional property on the generated request model that no caller can meaningfully fill - which is the sort of thing that gets filled in anyway a year later, with a value the server ignores. Timing is the load-bearing half: it lands with the `operationId` work, before generation, so the first committed client is already correct. |
| D60 | **Orval's input is the backend's live OpenAPI document at `http://localhost:3002/backend/docs-json`; there is no committed spec file.** **Owner decision, taken during Epic 10 and reversing D35, D37 and NFR-6's offline-generation clause.** This is the standard NestJS/Orval setup: `SwaggerModule.setup('backend/docs', ...)` already serves the document, so pointing a generator at it removes a whole pipeline - preview mode, the dedicated entry point, the pretty-printed 45KB snapshot, the two-link chain - rather than maintaining a second way to produce the same bytes. Verified equivalent before the switch: the live document returns 200 with 22 paths and 22 operationIds, and regenerating from it produced a `generated.ts` byte-identical to the one the committed snapshot produced. **The cost is real and is accepted, not hidden:** generation is no longer offline and no longer possible from a clean checkout - it needs `docker compose up -d nest-api`, a database the backend can boot against, and `SWAGGER_ENABLED` on. Building and typechecking are still offline (D46), which is the half of NFR-6 that still binds. | (a) **Keeping the committed snapshot** - the whole design D35 to D47 records. It works, and its offline property is genuinely better; it was rejected because the owner does not want to pay for a generator entry point, a shared `DocumentBuilder` import contract, a byte-stable serializer, and two Dockerfile check steps to get it. (b) **Curling the live document into a committed file, then generating from the file** - keeps the snapshot's reviewability while dropping preview mode, but it is the worst of both: still a committed artifact to keep current, still needs the stack up, and now with two steps instead of one. |
| D61 | **`frontend/orval.config.ts`, not `orval.config.ts` - and the location is a correctness requirement, not a preference.** `@orval/query` decides which `@tanstack/react-query` API surface to emit by reading the **declared range in the nearest package.json to the config**, not the version resolved in `node_modules`. At the repo root the nearest manifest never declared `@tanstack/react-query` at all, so Orval silently emitted its older, undetected-version output shape. From `frontend/`, it reads the real `^5.62.0` and emits the v5.62+ shape - `DataTag` query keys and a `queryClient` parameter on every hook - which matches the `5.101.4` the lockfile actually resolves. **This was discovered, not predicted:** the config move was requested for ownership reasons (D49) and the regenerated output came back materially different. Verified it was not path-rebase noise: two consecutive runs are byte-identical, the mutator import specifier is unchanged, and every one of the eight adopted hook call sites type-checks unchanged, because none passes the positional argument the new trailing parameter would capture. Orval resolves output paths and the version-detection manifest relative to the **config file**, not the cwd, so the shape cannot silently flip back depending on where the command is run from - confirmed by running it from both directories with byte-identical results. | Leaving the config at the root and pinning the emitted shape some other way - there is no such option; the detection is not configurable. Keeping the root location and accepting the older shape - that is generating for a version of React Query the frontend does not have, which is exactly the class of silent drift generation exists to remove. |
| D62 | **Nothing verifies that the committed client is current. Not a build, not a script, not a hook, not CI.** **Owner ruling, stated three times across Epic 10's feedback rounds, and it supersedes FR-21 with FR-26.** Keeping generated output current is the developer's responsibility at commit time. **A story that reintroduces a check in any form is invalid**, however it is packaged. What is given up is stated plainly rather than softened: the Epic 9 design converted a stale contract into a failed production image build, and that net is gone. What remains is the committed diff (D46) and, once the frontend type-checks (D41), the consumer that fails to compile. The failure mode this leaves open is a renamed DTO field that compiles clean everywhere and renders `undefined` in a browser. | (a) **The two-image build check** (D39) - built, shipped in Epic 9, and deleted in Epic 10. (b) **CI** (`pnpm spec:check` on push) - the mainstream answer for committed generated artifacts, recommended by this document, and ruled out by the owner twice. (c) **A pre-commit hook** - no hook framework, not installed by a clone, bypassed by `--no-verify`. (d) **`spec:watch`** (D45) - impossible now regardless: Orval's `--watch` watches files and the input is a URL, and polling the running backend would race its own hot-reload. |
| D63 | **The regeneration discipline is written into the acceptance criteria of any story that changes a DTO, since nothing else carries it.** Concretely: bring `nest-api` up, run `pnpm --filter @portfolio/frontend spec:generate`, commit `frontend/src/api/generated.ts` **in the same story**, and say so in the criteria. This is the only place the FR-26 obligation can live once D62 removes every automated check - a rule that exists in a document nobody re-reads at commit time is not a control. It binds Epic 5 hardest, since implementing the domains is a continuous stream of DTO changes. | Trusting the developer to remember - which is what "the developer's responsibility" means in isolation, and is the thing that fails at 11pm on the fourteenth DTO. Putting it in a CONTRIBUTING file - same failure, one indirection further away. Neither is a check, so neither violates D62; the story criterion is chosen because the Scrum Master writes criteria per story and Dev reads them, so it is the only artifact in this workflow that is guaranteed to be read at the moment it applies. |
| D64 | **The two seam files this initiative put under `frontend/src/server/` - `session.ts` and `authSession.ts` - move to `frontend/src/auth/` in Epic 12, after the Epic 7 flip, with no barrel file.** **Owner call at Epic 6's review gate, deferred there rather than reopening a passed epic, and now PRD Epic 12.** `frontend/src/server/` is the folder Epic 8 empties, so its name predicts deletion; these two are the opposite - they are the frontend's half of the auth seam, and `authSession.ts` exists specifically to read a *Nest-issued* session, so they outlive the migration. Both were created by this initiative (`session.ts` in Epic 4, `authSession.ts` in story 6.2) and were therefore never in the set GR-1 protects, which makes this a clarification of GR-1 rather than a relaxation of it. The move is a rename plus four import specifiers: no exported name, signature, or runtime behavior changes, and `src/server/auth.ts` is not edited - `authSession.ts` keeps importing `getServerAuthSession` from it, as `@/server/auth`. **Every path citation in this document stayed on the pre-move location until story 12.2 executed it**, since a document that points at a file that does not exist yet is wrong for the whole window in between. **Who repoints them was contested and is now settled: not story 12.2.** This document is the Architect's, the PRD's Epic 12 section says the epic does not edit it, and a story granted scope its own PRD withholds is the worse of the two failures. So 12.2 executing the move was the trigger, and a `bmad-architect` pass after it landed did the repointing - five citations, inventoried in the "Epic 12" paragraph of Migration / Rollout Strategy, with a grep for the two old paths as the backstop. The residue this leaves is a window in which this document is knowingly stale, which is why 12.2's Dev Notes carry the handoff and why the inventory is written by heading and quoted phrase rather than by line number. | (a) **Leave them where they are** - costs nothing today, and permanently misfiles the two files a future reader would use to find the auth boundary. (b) **Move them in or before Epic 7** - the flip's discipline is that a post-cutover regression has exactly one possible cause, and a rename inside that window gives it a second; hence `depends-on: 6, 7`. (c) **Add a `frontend/src/auth/index.ts` barrel while there** - the destination is `'use client'` code today (`actions.ts`, `useCurrentSession.ts`) and `authSession.ts` imports `next/headers`, so a barrel would pull a server-only module into a client bundle. Direct file imports keep the mix safe, which is what all four importers already do. One thing that does **not** relax across the move: `middleware.ts` reaches `@portfolio/shared` through the moved file on the Edge path, so GR-5's Dockerfile wiring stays load-bearing and the epic proves it with a real `next-app` image build. |
| D65 | **FR-27's ownership check answers a foreign-owned id with the existing `500`, not a `404` or a `403`, and the old Next.js route keeps serving unscoped deletes until Epic 7 flips traffic off it.** Recorded after the fact - Epic 11 shipped as `246feeb` - because both halves are decisions with consequences that outlive the story. On the status code: a row the caller does not own makes `nativeDelete` return `0`, which falls into the branch a nonexistent id already fell into, so the two cases produce one error body, one metrics label set (`method` / matched-route `path` / `status_code`, identical for both), and no log line at all, since the global filter's `HttpException` branch returns before it logs. The endpoint therefore leaks nothing about the existence or ownership of ids it refuses, and reusing the existing branch means the change adds no response shape for FR-3 to have diverged on beyond the single divergence FR-27 licenses. On the coexistence gap: `frontend/src/app/api/transaction/[id]/route.ts` is GR-1 territory and was not edited, so the vulnerability stayed reachable through the old origin for the whole window - an accepted, owner-approved risk on a two-user private deployment, and the one architectural consequence to hold onto is that **FR-27 is not actually in force until story 7.2**, however complete Epic 11 reads. | (a) **`404` for a foreign id** - the conventional REST answer, and it is an enumeration oracle: it tells any logged-in caller which sequential integer ids exist, which is precisely the counting attack FR-27 exists to stop. (b) **`403` for a foreign id, `404` for a miss** - most informative and worst here; it confirms ownership of ids the caller cannot see. (c) **Fixing the Next.js route in the same epic so the gap never opens** - a direct GR-1 violation, and it would edit the file every NFR-4 diff in the initiative is measured against, contaminating Epic 7's cutover evidence to close a window Epic 7 closes anyway. (d) **Bringing Epic 11 forward, ahead of Epic 6** - shortens the window but forfeits nothing else useful, and the sequencing constraint runs the other way: the diff against the live old route is only available while both are up. |
