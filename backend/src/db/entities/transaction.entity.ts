import { Entity, PrimaryKey, Property } from '@mikro-orm/decorators/legacy';
import type { Opt } from '@mikro-orm/mysql';

@Entity({ tableName: 'Transaction' })
export class Transaction {
  @PrimaryKey({
    type: 'integer',
    fieldName: 'id',
    unsigned: false,
    autoincrement: true,
  })
  id!: number;

  // Live column is `int(11) NOT NULL DEFAULT '1'`, hence `default: 1` and `& Opt`.
  @Property({
    type: 'integer',
    fieldName: 'userId',
    default: 1,
    index: 'Transaction_userId_fkey',
  })
  userId!: number & Opt;

  @Property({
    type: 'string',
    fieldName: 'coinName',
  })
  coinName!: string;

  @Property({
    type: 'string',
    fieldName: 'product',
  })
  product!: string;

  @Property({
    type: 'datetime',
    fieldName: 'date',
    length: 3,
    defaultRaw: 'current_timestamp(3)',
  })
  date!: Date & Opt;

  @Property({
    type: 'string',
    fieldName: 'side',
  })
  side!: string;

  // `size`, `price`, `fee`, `total` are live `FLOAT` columns - `type: 'float'` maps
  // correctly; `float64`/`double` would pick the wrong column type.
  @Property({
    type: 'float',
    fieldName: 'size',
  })
  size!: number;

  @Property({
    type: 'string',
    fieldName: 'unit',
  })
  unit!: string;

  @Property({
    type: 'float',
    fieldName: 'price',
  })
  price!: number;

  @Property({
    type: 'float',
    fieldName: 'fee',
  })
  fee!: number;

  @Property({
    type: 'float',
    fieldName: 'total',
  })
  total!: number;

  @Property({
    type: 'string',
    fieldName: 'notes',
  })
  notes!: string;

  @Property({
    type: 'integer',
    fieldName: 'token_info_id',
    nullable: true,
  })
  token_info_id?: number;
}
