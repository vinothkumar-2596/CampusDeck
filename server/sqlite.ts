import { DatabaseSync } from "node:sqlite";
import { readFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { DB, Statement } from "./db";
export function openDatabase(
  path: string,
): DB & { close: () => void; raw: DatabaseSync } {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const raw = new DatabaseSync(path);
  raw.exec("PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;");
  raw.exec(
    readFileSync(
      new URL("../drizzle/0000_campusdeck.sql", import.meta.url),
      "utf8",
    ),
  );
  const operations = new WeakMap<Statement, () => unknown>();
  function prepare(sql: string, args: unknown[] = []): Statement {
    const run = () => raw.prepare(sql).run(...(args as never[]));
    const statement: Statement = {
      bind: (...values) => prepare(sql, values),
      first: async <T>() =>
        (raw.prepare(sql).get(...(args as never[])) as T) || null,
      all: async <T>() => ({
        results: raw.prepare(sql).all(...(args as never[])) as T[],
      }),
      run: async () => run(),
    };
    operations.set(statement, run);
    return statement;
  }
  return {
    prepare,
    batch: async (statements) => {
      raw.exec("BEGIN");
      try {
        const results = statements.map((s) => operations.get(s)!());
        raw.exec("COMMIT");
        return results;
      } catch (e) {
        raw.exec("ROLLBACK");
        throw e;
      }
    },
    close: () => raw.close(),
    raw,
  };
}
