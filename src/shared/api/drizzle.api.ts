import { drizzle } from "drizzle-orm/sqlite-proxy";
import { getDb } from "./database.api";
import * as schema from "./schema";

export const db = drizzle<typeof schema>(
  async (sql, params, method) => {
    const database = await getDb();

    if (/^\s*SELECT\b/i.test(sql) || /\bRETURNING\b/i.test(sql)) {
      const rows = await database.select<Record<string, unknown>[]>(sql, params as unknown[]);
      const mapped = rows.map(Object.values);
      return { rows: method === "all" ? mapped : mapped.length > 0 ? [mapped[0]] : [] };
    }

    await database.execute(sql, params as unknown[]);
    return { rows: [] };
  },
  { schema },
);
