import { defineConfig } from "drizzle-kit";

// `drizzle-kit generate` needs no database. `drizzle-kit migrate` reads DATABASE_URL.
export default defineConfig({
  dialect: "postgresql",
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
  strict: true,
  verbose: true,
});
