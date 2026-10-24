import { Entity, PrimaryKey, Property } from '@mikro-orm/decorators/legacy';

// The `OuathToken` misspelling is kept exactly as it exists in the live database -
// renaming it would be a schema change, which this entity mapping does not make.
@Entity({ tableName: 'OuathToken' })
export class OuathToken {
  // Externally assigned (cuid), not autoincrement.
  @PrimaryKey({
    type: 'string',
    fieldName: 'id',
    length: 191,
  })
  id!: string;

  @Property({
    type: 'integer',
    fieldName: 'userId',
    index: 'OuathToken_userId_fkey',
  })
  userId!: number;

  @Property({
    type: 'string',
    fieldName: 'accessToken',
    length: 191,
    unique: 'OuathToken_accessToken_key',
  })
  accessToken!: string;

  @Property({
    type: 'datetime',
    fieldName: 'accessTokenExpiresOn',
    length: 3,
  })
  accessTokenExpiresOn!: Date;
}
