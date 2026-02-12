import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/shared/api/schema.ts",
  dialect: "sqlite",
});
