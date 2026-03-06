import fs from "node:fs/promises";
import path from "node:path";
import { createMysqlConnection } from "./mysql-utils.mjs";

const schemaPath = path.resolve(process.cwd(), "db", "schema.sql");

(async () => {
  const connection = await createMysqlConnection({ multipleStatements: true });
  try {
    const sql = await fs.readFile(schemaPath, "utf8");
    await connection.query(sql);
    console.log("Database schema is ready.");
  } catch (error) {
    console.error("Database initialization failed:", error);
    process.exit(1);
  } finally {
    await connection.end();
  }
})();
