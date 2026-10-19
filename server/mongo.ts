import {
  MongoClient,
  type ClientSession,
  type Document,
  type Db as MongoDb,
} from "mongodb";
import {
  primaryKeys,
  type Store,
  type Query,
  type Mutation,
  type Row,
  type Filter,
  type Table,
} from "./store.js";

// Presentations, slides and template snapshots are embedded MongoDB documents.
// The API's existing JSON serialization boundary is kept for SQLite/D1 compatibility.
function document(row: Row): Document {
  const doc: Document = { ...row };
  for (const key of ["data", "snapshot"]) {
    if (typeof doc[key] === "string") doc[key] = JSON.parse(doc[key]);
  }
  if (typeof row.expires_at === "number")
    doc.expires_on = new Date(row.expires_at);
  return doc;
}
function row(doc: Document): Row {
  const { _id, expires_on, ...value } = doc;
  for (const key of ["data", "snapshot"]) {
    if (value[key] && typeof value[key] === "object")
      value[key] = JSON.stringify(value[key]);
  }
  return value as Row;
}
function filter(where: Filter = {}): Document {
  return Object.fromEntries(
    Object.entries(where).map(([key, value]) => [
      key,
      value && typeof value === "object"
        ? "gt" in value
          ? { $gt: value.gt }
          : { $lt: value.lt }
        : value,
    ]),
  );
}

export function mongoStore(client: MongoClient, database: MongoDb): Store {
  async function write(op: Mutation, session?: ClientSession) {
    const collection = database.collection(op.table);
    if (op.action === "delete")
      return collection.deleteMany(filter(op.where), { session });
    const values = document(op.values || {});
    if (op.action === "insert")
      return collection.insertOne(values, { session });
    if (op.action === "update") {
      return collection.updateMany(
        filter(op.where),
        {
          ...(Object.keys(values).length ? { $set: values } : {}),
          ...(op.increment ? { $inc: op.increment } : {}),
        },
        { session },
      );
    }
    const keys = op.keys || primaryKeys[op.table];
    const match = {
      ...Object.fromEntries(keys.map((key) => [key, values[key]])),
      ...filter(op.guard),
    };
    if (op.ignore)
      return collection.updateOne(
        match,
        { $setOnInsert: values },
        { upsert: true, session },
      );
    const increments = op.increment || {};
    const updateKeys = (
      op.update || Object.keys(values).filter((key) => !keys.includes(key))
    ).filter((key) => !(key in increments));
    const set = Object.fromEntries(updateKeys.map((key) => [key, values[key]]));
    const onInsert = Object.fromEntries(
      Object.entries(values).filter(
        ([key]) => !(key in set) && !(key in increments),
      ),
    );
    return collection.updateOne(
      match,
      {
        ...(Object.keys(set).length ? { $set: set } : {}),
        ...(Object.keys(onInsert).length ? { $setOnInsert: onInsert } : {}),
        ...(Object.keys(increments).length ? { $inc: increments } : {}),
      },
      { upsert: true, session },
    );
  }
  async function all<T>(q: Query): Promise<{ results: T[] }> {
    const projection = {
      _id: 0,
      ...(q.fields ? Object.fromEntries(q.fields.map((key) => [key, 1])) : {}),
    };
    let cursor = database
      .collection(q.table)
      .find(filter(q.where), { projection });
    if (q.sort) cursor = cursor.sort(q.sort);
    if (q.limit) cursor = cursor.limit(q.limit);
    return { results: (await cursor.toArray()).map((doc) => row(doc) as T) };
  }
  return {
    all,
    first: async <T>(q: Query) =>
      (await all<T>({ ...q, limit: 1 })).results[0] || null,
    count: async (table) => ({
      count: await database.collection(table).countDocuments(),
    }),
    write,
    batch: async (operations) => {
      const session = client.startSession();
      try {
        return await session.withTransaction(async () => {
          const results: unknown[] = [];
          for (const op of operations) results.push(await write(op, session));
          return results;
        });
      } finally {
        await session.endSession();
      }
    },
  };
}

export async function initializeMongo(database: MongoDb) {
  // Unique constraints preserve account isolation and make retries idempotent.
  for (const [table, keys] of Object.entries(primaryKeys)) {
    await database
      .collection(table)
      .createIndex(Object.fromEntries(keys.map((key) => [key, 1])), {
        unique: true,
      });
  }
  const indexes: [Table, Record<string, 1 | -1>, boolean?][] = [
    ["users", { email: 1 }, true],
    ["categories", { name: 1 }, true],
    ["projects", { user_id: 1, updated_at: -1 }],
    ["templates", { published: 1, "data.family": 1, created_at: 1, id: 1 }],
    ["templates", { category: 1 }],
    ["downloads", { user_id: 1, created_at: -1 }],
    ["downloads", { user_id: 1, template_id: 1, "snapshot.id": 1 }],
    ["audit_logs", { created_at: -1 }],
    ["contact_messages", { created_at: -1 }],
  ];
  for (const [table, keys, unique] of indexes)
    await database
      .collection(table)
      .createIndex(keys, { unique: unique || false });
  for (const table of ["sessions", "rate_limits"]) {
    await database
      .collection(table)
      .createIndex({ expires_on: 1 }, { expireAfterSeconds: 0 });
  }
}

let connection:
  Promise<{ client: MongoClient; store: Store; database: MongoDb }> | undefined;
export function connectMongo() {
  if (!connection) {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error("MONGODB_URI is required for persistent storage");
    const client = new MongoClient(uri, {
      maxPoolSize: 10,
      minPoolSize: 0,
      maxIdleTimeMS: 60000,
      serverSelectionTimeoutMS: 15000,
    });
    connection = client
      .connect()
      .then(async () => {
        const database = client.db(
          process.env.MONGODB_DATABASE || "campusdeck",
        );
        await initializeMongo(database);
        return { client, database, store: mongoStore(client, database) };
      })
      .catch(async (error) => {
        connection = undefined;
        await client.close();
        throw error;
      });
  }
  return connection;
}
