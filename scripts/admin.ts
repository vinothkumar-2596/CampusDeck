import { openDatabase } from "../server/sqlite";
import { connectMongo } from "../server/mongo";
import { storage } from "../server/store";
try {
  process.loadEnvFile(".env");
} catch {}
const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error("Usage: npm run admin -- registered-email@example.com");
  process.exit(1);
}
const mongo = process.env.MONGODB_URI ? await connectMongo() : null;
const db = mongo
  ? undefined
  : openDatabase(process.env.DATABASE_PATH || ".data/campusdeck.sqlite");
const store = storage({ DB: db, STORE: mongo?.store });
const close = async () => {
  db?.close();
  await mongo?.client.close();
};
const user = await store.first({ table: "users", where: { email } });
if (!user) {
  console.error(
    "Register this account in CampusDeck first, then run this command.",
  );
  await close();
  process.exit(1);
}
await store.write({
  table: "users",
  action: "update",
  where: { email },
  values: { role: "admin" },
});
console.log("Administrator access granted to the registered account.");
await close();
