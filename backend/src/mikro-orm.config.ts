import { defineConfig } from '@mikro-orm/mysql';

const required = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is missing or empty - Compose injects it from ` +
        'defaults.env/override.env via env_file',
    );
  }
  return value;
};

export default defineConfig({
  host: required('DB_HOST'),
  port: Number(required('DB_PORT')),
  user: required('DB_USERNAME'),
  password: required('DB_PASSWORD'),
  dbName: required('DB_NAME'),
  entities: ['./dist/db/entities'],
  entitiesTs: ['./src/db/entities'],
  migrations: {
    path: './dist/db/migrations',
    pathTs: './src/db/migrations',
    // Migrations here are hand-written SQL, not generated from entity metadata: the
    // schema has a view and foreign keys that the entities do not model, so a diff
    // against the snapshot would emit wrong SQL. Use `migration:create --blank`.
    snapshot: false,
    // Both are MikroORM defaults, pinned because they are load-bearing. MySQL commits
    // implicitly on DDL, so these only actually roll back data-only migrations.
    transactional: true,
    allOrNothing: true,
  },
  // MikroORM defaults this to true, which issues CREATE DATABASE when the database is
  // absent - production connects to an existing database or fails.
  ensureDatabase: process.env.NODE_ENV !== 'production',
});
