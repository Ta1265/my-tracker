import { Entity, PrimaryKey, Property } from '@mikro-orm/decorators/legacy';

// The live `date` column is `datetime`, not a date-only type, so it maps to `Date`
// rather than `string`.
@Entity({ tableName: 'NetCashFlow' })
export class NetCashFlow {
  @PrimaryKey({
    type: 'datetime',
    fieldName: 'date',
  })
  date!: Date;

  // `unsigned: false` overrides MikroORM's unsigned default for PK integer columns.
  @PrimaryKey({
    type: 'integer',
    fieldName: 'userId',
    unsigned: false,
    index: 'userId_idx',
  })
  userId!: number;

  @Property({
    type: 'decimal',
    fieldName: 'netContributions',
    precision: 18,
    scale: 2,
  })
  netContributions!: string;

  @Property({
    type: 'decimal',
    fieldName: 'netCash',
    precision: 18,
    scale: 2,
  })
  netCash!: string;

  @Property({
    type: 'decimal',
    fieldName: 'totalCostBasis',
    precision: 18,
    scale: 2,
  })
  totalCostBasis!: string;

  @Property({
    type: 'decimal',
    fieldName: 'valueOfHoldings',
    precision: 18,
    scale: 2,
  })
  valueOfHoldings!: string;

  @Property({
    type: 'decimal',
    fieldName: 'profitLoss',
    precision: 18,
    scale: 2,
  })
  profitLoss!: string;

  @Property({
    type: 'decimal',
    fieldName: 'roi',
    precision: 18,
    scale: 2,
  })
  roi!: string;

  @Property({
    type: 'decimal',
    fieldName: 'ror',
    precision: 18,
    scale: 2,
  })
  ror!: string;
}
