import { Entity, PrimaryKey, Property } from '@mikro-orm/decorators/legacy';
import type { Opt } from '@mikro-orm/mysql';

@Entity({ tableName: 'ExchangeRate' })
export class ExchangeRate {
  @PrimaryKey({
    type: 'integer',
    fieldName: 'id',
    unsigned: false,
    autoincrement: true,
  })
  id!: number;

  // Live column is `datetime(3) DEFAULT CURRENT_TIMESTAMP(3)`, DB-defaulted hence `& Opt`.
  @Property({
    type: 'datetime',
    fieldName: 'date',
    length: 3,
    defaultRaw: 'current_timestamp(3)',
  })
  date!: Date & Opt;

  @Property({
    type: 'string',
    fieldName: 'unit',
    unique: 'ExchangeRate_unit_key',
  })
  unit!: string;

  @Property({
    type: 'float',
    fieldName: 'rate',
  })
  rate!: number;
}
