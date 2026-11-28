import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

const envFile =
  process.env.DRIZZLE_ENV === "production"
    ? ".env.production.local"
    : ".env.local";

config({ path: envFile });

export default defineConfig({
  schema: "./lib/db/schema.ts",

  out: "./drizzle",

  dialect: "postgresql",

  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
