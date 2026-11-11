import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import {
  drizzle,
  type BetterSQLite3Database,
} from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema";

export type AppDatabase = BetterSQLite3Database<typeof schema>;

type DbGlobal = {
  db: AppDatabase;
  sqlite: Database.Database;
};

const globalForDb = globalThis as typeof globalThis & {
  __ineeditDb?: DbGlobal;
};

function resolveDatabasePath() {
  return path.resolve(
    /* turbopackIgnore: true */ process.env.DATABASE_PATH ??
      path.join(process.cwd(), "data", "ineedit.db"),
  );
}

function createDatabase(): DbGlobal {
  const databasePath = resolveDatabasePath();
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });

  const sqlite = new Database(databasePath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("busy_timeout = 5000");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("synchronous = NORMAL");

  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });

  return { db, sqlite };
}

const created = globalForDb.__ineeditDb ?? createDatabase();
globalForDb.__ineeditDb = created;

export const db: AppDatabase = created.db;
export { schema };
