import { openDatabase } from "../server/sqlite";
try {
  process.loadEnvFile(".env");
} catch {}
const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error("Usage: npm run admin -- registered-email@example.com");
  process.exit(1);
}
const db = openDatabase(process.env.DATABASE_PATH || ".data/campusdeck.sqlite");
const user = await db
  .prepare("SELECT id FROM users WHERE email=?")
  .bind(email)
  .first();
if (!user) {
  console.error(
    "Register this account in CampusDeck first, then run this command.",
  );
  db.close();
  process.exit(1);
}
await db
  .prepare("UPDATE users SET role='admin' WHERE email=?")
  .bind(email)
  .run();
console.log("Administrator access granted to the registered account.");
db.close();
