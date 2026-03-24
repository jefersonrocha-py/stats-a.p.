import fs from "node:fs/promises";
import path from "node:path";
import { createMysqlConnection } from "./mysql-utils.mjs";

const schemaPath = path.resolve(process.cwd(), "db", "schema.sql");

async function columnExists(connection, tableName, columnName) {
  const [rows] = await connection.execute(
    `
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?
      LIMIT 1
    `,
    [tableName, columnName]
  );

  return Array.isArray(rows) && rows.length > 0;
}

async function ensureUserTableMigrations(connection) {
  const hasSuspendedUntil = await columnExists(connection, "User", "suspendedUntil");
  if (!hasSuspendedUntil) {
    await connection.query("ALTER TABLE `User` ADD COLUMN `suspendedUntil` DATETIME NULL AFTER `isBlocked`");
    console.log("Added User.suspendedUntil column.");
  }
}

(async () => {
  const connection = await createMysqlConnection({ multipleStatements: true });
  try {
    const sql = await fs.readFile(schemaPath, "utf8");
    await connection.query(sql);
    await ensureUserTableMigrations(connection);
    console.log("Database schema is ready.");
  } catch (error) {
    console.error("Database initialization failed:", error);
    process.exit(1);
  } finally {
    await connection.end();
  }
})();
