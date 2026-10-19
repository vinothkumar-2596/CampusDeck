import type { DB } from "./db";

export type Table =
  | "users"
  | "sessions"
  | "categories"
  | "templates"
  | "projects"
  | "profiles"
  | "saved_templates"
  | "downloads"
  | "purchases"
  | "entitlements"
  | "audit_logs"
  | "rate_limits"
  | "contact_messages";
export type Row = Record<string, string | number | null>;
export type Filter = Record<
  string,
  string | number | null | { gt: number } | { lt: number }
>;
export interface Query {
  table: Table;
  where?: Filter;
  fields?: string[];
  sort?: Record<string, 1 | -1>;
  limit?: number;
}
export interface Mutation {
  table: Table;
  action: "insert" | "put" | "update" | "delete";
  values?: Row;
  where?: Filter;
  keys?: string[];
  update?: string[];
  increment?: Record<string, number>;
  ignore?: boolean;
  guard?: Filter;
}
export interface Store {
  first<T = Row>(query: Query): Promise<T | null>;
  all<T = Row>(query: Query): Promise<{ results: T[] }>;
  count(table: Table): Promise<{ count: number }>;
  write(operation: Mutation): Promise<unknown>;
  batch(operations: Mutation[]): Promise<unknown[]>;
}

export const primaryKeys: Record<Table, string[]> = {
  users: ["id"],
  sessions: ["id"],
  categories: ["id"],
  templates: ["id"],
  projects: ["id"],
  profiles: ["user_id"],
  saved_templates: ["user_id", "template_id"],
  downloads: ["id"],
  purchases: ["id"],
  entitlements: ["user_id", "template_id"],
  audit_logs: ["id"],
  rate_limits: ["key"],
  contact_messages: ["id"],
};

function identifier(name: string) {
  if (!/^[a-z_][a-z0-9_]*$/i.test(name))
    throw new Error("Invalid storage field");
  return `"${name}"`;
}
function field(name: string) {
  const parts = name.split(".");
  if (parts.length === 1) return identifier(name);
  parts.forEach(identifier);
  return `json_extract(${identifier(parts[0])},'$.${parts.slice(1).join(".")}')`;
}
function condition(filter: Filter = {}, args: unknown[]) {
  return (
    Object.entries(filter)
      .map(([key, value]) => {
        if (value === null) return `${field(key)} IS NULL`;
        const operator =
          typeof value === "object" ? ("gt" in value ? ">" : "<") : "=";
        args.push(typeof value === "object" ? Object.values(value)[0] : value);
        return `${field(key)}${operator}?`;
      })
      .join(" AND ") || "1=1"
  );
}

/** SQLite/D1 adapter keeps the standalone and existing Sites deployments working. */
export function sqlStore(db: DB): Store {
  function select(q: Query) {
    const args: unknown[] = [];
    let sql = `SELECT ${q.fields?.map(field).join(",") || "*"} FROM ${identifier(q.table)} WHERE ${condition(q.where, args)}`;
    if (q.sort)
      sql +=
        " ORDER BY " +
        Object.entries(q.sort)
          .map(
            ([key, order]) => `${field(key)} ${order === -1 ? "DESC" : "ASC"}`,
          )
          .join(",");
    if (q.limit !== undefined) {
      sql += " LIMIT ?";
      args.push(q.limit);
    }
    return db.prepare(sql).bind(...args);
  }
  function mutation(op: Mutation) {
    const args: unknown[] = [];
    const table = identifier(op.table);
    if (op.action === "delete")
      return db
        .prepare(`DELETE FROM ${table} WHERE ${condition(op.where, args)}`)
        .bind(...args);
    const values = op.values || {};
    if (op.action === "update") {
      const set = Object.keys(values).map((key) => {
        args.push(values[key]);
        return `${identifier(key)}=?`;
      });
      for (const [key, value] of Object.entries(op.increment || {})) {
        set.push(`${identifier(key)}=${identifier(key)}+?`);
        args.push(value);
      }
      const sql = `UPDATE ${table} SET ${set.join(",")} WHERE ${condition(op.where, args)}`;
      return db.prepare(sql).bind(...args);
    }
    const columns = Object.keys(values);
    args.push(...Object.values(values));
    let sql = `INSERT INTO ${table} (${columns.map(identifier).join(",")}) VALUES (${columns.map(() => "?").join(",")})`;
    if (op.action === "put") {
      const keys = op.keys || primaryKeys[op.table];
      sql += ` ON CONFLICT(${keys.map(identifier).join(",")})`;
      if (op.ignore) sql += " DO NOTHING";
      else {
        const increments = op.increment || {};
        const fields = (
          op.update || columns.filter((key) => !keys.includes(key))
        ).filter((key) => !(key in increments));
        const set = fields.map(
          (key) => `${identifier(key)}=excluded.${identifier(key)}`,
        );
        for (const [key, value] of Object.entries(increments)) {
          set.push(`${identifier(key)}=${table}.${identifier(key)}+?`);
          args.push(value);
        }
        sql += ` DO UPDATE SET ${set.join(",")}`;
        if (op.guard) sql += ` WHERE ${condition(op.guard, args)}`;
      }
    }
    return db.prepare(sql).bind(...args);
  }
  return {
    first: <T>(q: Query) => select({ ...q, limit: 1 }).first<T>(),
    all: <T>(q: Query) => select(q).all<T>(),
    count: async (table) =>
      (await db
        .prepare(`SELECT COUNT(*) AS count FROM ${identifier(table)}`)
        .first<{ count: number }>())!,
    write: (op) => mutation(op).run(),
    batch: (operations) => db.batch(operations.map(mutation)),
  };
}

const adapters = new WeakMap<DB, Store>();
export function storage(env: { DB?: DB; STORE?: Store }): Store {
  if (env.STORE) return env.STORE;
  if (!env.DB) throw new Error("Persistent storage is not configured");
  let adapter = adapters.get(env.DB);
  if (!adapter) {
    adapter = sqlStore(env.DB);
    adapters.set(env.DB, adapter);
  }
  return adapter;
}
