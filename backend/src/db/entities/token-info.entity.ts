import { Entity, PrimaryKey, Property } from '@mikro-orm/decorators/legacy';

@Entity({ tableName: 'TokenInfo' })
export class TokenInfo {
  // Externally assigned (e.g. a CoinGecko token id), not auto-increment.
  @PrimaryKey({
    type: 'integer',
    fieldName: 'token_id',
    autoincrement: false,
    unsigned: false,
  })
  token_id!: number;

  @Property({
    type: 'string',
    fieldName: 'symbol',
    length: 45,
    nullable: true,
  })
  symbol?: string;

  @Property({
    type: 'string',
    fieldName: 'slug',
    length: 45,
    nullable: true,
  })
  slug?: string;

  @Property({
    type: 'string',
    fieldName: 'name',
    length: 45,
    nullable: true,
  })
  name?: string;

  @Property({
    type: 'integer',
    fieldName: 'rank',
    nullable: true,
  })
  rank?: number;
}
