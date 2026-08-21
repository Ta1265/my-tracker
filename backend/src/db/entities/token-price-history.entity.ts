import { Entity, PrimaryKey, Property } from '@mikro-orm/decorators/legacy';
import type { Opt } from '@mikro-orm/mysql';

// Live schema drifted from schema.prisma: a genuine four-column composite PK, plus an
// extra `TokenPriceHistorycol` column not present in schema.prisma at all.
@Entity({ tableName: 'TokenPriceHistory' })
export class TokenPriceHistory {
  @PrimaryKey({
    type: 'integer',
    fieldName: 'token_info_id',
    unsigned: false,
  })
  token_info_id!: number;

  @PrimaryKey({
    type: 'datetime',
    fieldName: 'date',
    columnType: 'timestamp',
    defaultRaw: 'CURRENT_TIMESTAMP',
    extra: 'on update CURRENT_TIMESTAMP',
  })
  date!: Date & Opt;

  @PrimaryKey({
    type: 'decimal',
    fieldName: 'close_price',
    precision: 18,
    scale: 2,
    unsigned: false,
  })
  close_price!: string;

  @PrimaryKey({
    type: 'string',
    fieldName: 'timeFrame',
  })
  timeFrame!: string;

  @Property({
    type: 'string',
    fieldName: 'TokenPriceHistorycol',
    length: 45,
    nullable: true,
  })
  TokenPriceHistorycol?: string;
}
