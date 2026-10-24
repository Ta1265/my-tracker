# Story 9.1a: `ProductTransactionResponseDto` defect repair

Status: Done

## Context

Acts on the two "DTO is wrong" rows story 9.1's reconciliation table recorded for
`ProductTransactionResponseDto` (`backend/src/product/dto/product-transaction-response.dto.ts`).
Both are real backend response-documentation defects, not new discovery work - story 9.1
found them empirically by comparing the live route to the DTO. This story is the fix; it
does not re-diff anything. Runs after 9.1, before 9.2 (the committed spec snapshot must be
generated from a corrected DTO, not a wrong one).

## Acceptance Criteria

- [x] `ProductTransactionResponseDto` is missing six fields the route actually returns.
  `frontend/src/app/api/product/[product]/route.ts:56-71` builds every transaction with
  `id`, `fullName`, `product`, `date`, `side`, `size`, `unit`, `price`, `fee`, `total`,
  `notes`, `runningBalance`, `runningCostBasis`, `realizedGains` - fourteen fields. The
  DTO documents only eight: `price`, `fee`, `total`, `runningCostBasis`, `size`,
  `runningBalance`, `date`, `realizedGains`. Add `id` (`number`), `fullName` (`string`),
  `product` (`string`), `side` (`string`), `unit` (`string`), `notes` (`string`, nullable
  per the `Transaction` entity), each with an `@ApiProperty` example matching the existing
  style. `ProductTable.tsx` (`frontend/src/components/product/ProductTable.tsx:52,75,89,211`)
  already reads `date`, `side`, `runningBalance`, and `id` off this shape today via the
  hand-declared `ProductTransaction` type, so the DTO gap is real, not theoretical.
- [x] `ProductTransactionResponseDto.size`'s description is wrong. It reads
  "`.toFixed(4)`-formatted", but `route.ts:62` builds it as
  `transaction.size.toString()` - plain `toString()`, no fixed-decimal formatting.
  `runningBalance` (`route.ts:68`, `.toFixed(4)`) is correctly described; only `size`'s
  description is inaccurate. Fix the description to say "returned via `.toString()`, not
  fixed-decimal formatted" and correct the `@ApiProperty` `example` if it currently
  implies four decimal places.
- [x] `pnpm --filter @portfolio/backend build` succeeds; start the backend
  (`docker compose up -d --build nest-api`) and confirm `GET /backend/docs-json` now
  documents all fourteen fields on `ProductTransactionResponseDto`, with `size`'s
  `description` matching the corrected text.

## Technical Notes

- No generation runs in this story. `backend/openapi.json` and `frontend/types/api.d.ts`
  do not exist yet - they're stories 9.2/9.3's deliverables.
- This story edits exactly one file:
  `backend/src/product/dto/product-transaction-response.dto.ts`.

## Out of Scope

- Any other DTO or the reconciliation table itself - story 9.1.
- `TimeFrame` as a generated enum - story 9.1b.
- Any frontend consumer change (`ProductTable.tsx` still imports the hand-declared
  `ProductTransaction` type until story 9.5) - this story only corrects what the backend
  documents, not what the frontend currently reads.

## Dev Notes

### Changed Files

~ backend/src/product/dto/product-transaction-response.dto.ts   added the six missing
  fields (`id`, `fullName`, `product`, `side`, `unit`, `notes`) and corrected `size`'s
  description/example to match `.toString()` instead of implying `.toFixed(4)`.

Note on `notes`: the story's AC text describes it as "nullable per the Transaction
entity", but `backend/src/db/entities/transaction.entity.ts:81-85` declares `notes!:
string` with no `nullable: true`, and the originating migration
(`frontend/src/server/db/migrations/20231119180527_add_transaction_table/migration.sql:12`)
defines the column as `VARCHAR(255) NOT NULL`. `notes` was implemented as a required
`string`, matching the entity and DB schema rather than the AC's parenthetical, since the
route (`route.ts:67`) assigns `transaction.notes` directly with no null branch.

### Verification

- `pnpm --filter @portfolio/backend typecheck` - passed, no errors.
- `pnpm --filter @portfolio/backend lint` - passed; one pre-existing warning in
  `src/main.ts` (`no-floating-promises`), unrelated to this change.
- `pnpm --filter @portfolio/backend build` - succeeded.
- `docker compose up -d --build nest-api` - built and started successfully.
- `docker compose exec nest-api wget -qO- http://localhost:3001/backend/docs-json` -
  confirmed `components.schemas.ProductTransactionResponseDto` now lists all fourteen
  fields (`id`, `fullName`, `product`, `side`, `unit`, `notes`, `price`, `fee`, `total`,
  `runningCostBasis`, `size`, `runningBalance`, `date`, `realizedGains`), all marked
  `required`, with `size`'s `description` reading "Coin quantity, returned via
  .toString(), not fixed-decimal formatted." and `example: "12.34"` (no trailing zeros).
