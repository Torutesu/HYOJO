import { readFile } from "node:fs/promises";
import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required to run migrations");

const sql = postgres(databaseUrl, { max: 1 });
try {
  const migration = await readFile(new URL("../migrations/001_initial.sql", import.meta.url), "utf8");
  await sql.unsafe(migration);
  console.log("Applied 001_initial.sql");
} finally {
  await sql.end();
}
