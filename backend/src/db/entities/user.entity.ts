import { Entity, PrimaryKey, Property } from '@mikro-orm/decorators/legacy';

@Entity({ tableName: 'User' })
export class User {
  // `unsigned: false` overrides MikroORM's unsigned default for PK integer columns.
  @PrimaryKey({
    type: 'integer',
    fieldName: 'id',
    unsigned: false,
    autoincrement: true,
  })
  id!: number;

  @Property({
    type: 'string',
    fieldName: 'name',
    length: 191,
    nullable: true,
  })
  name?: string;

  @Property({
    type: 'string',
    fieldName: 'email',
    length: 191,
    unique: 'User_email_key',
  })
  email!: string;

  @Property({
    type: 'string',
    fieldName: 'password',
    length: 191,
  })
  password!: string;

  @Property({
    type: 'string',
    fieldName: 'username',
    length: 191,
    unique: 'User_username_key',
  })
  username!: string;

  @Property({
    type: 'string',
    fieldName: 'image',
    length: 191,
    nullable: true,
  })
  image?: string;
}
