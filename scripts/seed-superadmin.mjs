import bcrypt from "bcryptjs";
import { createMysqlConnection } from "./mysql-utils.mjs";

const email = process.env.SUPERADMIN_EMAIL?.toLowerCase();
const password = process.env.SUPERADMIN_PASSWORD;
const name = process.env.SUPERADMIN_NAME || "Super Admin";
const promoteIfExists = process.env.SUPERADMIN_PROMOTE_IF_EXISTS === "true";

if (!email || !password) {
  console.log("SUPERADMIN_EMAIL/SUPERADMIN_PASSWORD nao definidos. Seed ignorado.");
  process.exit(0);
}

(async () => {
  const connection = await createMysqlConnection();

  try {
    const [rows] = await connection.execute(
      "SELECT `id`, `role` FROM `User` WHERE `email` = ? LIMIT 1",
      [email]
    );
    const exists = rows[0];

    if (exists?.id) {
      if (exists.role !== "SUPERADMIN") {
        if (promoteIfExists) {
          await connection.execute(
            "UPDATE `User` SET `role` = 'SUPERADMIN', `isBlocked` = 0 WHERE `id` = ?",
            [exists.id]
          );
          console.log("Usuario promovido para SUPERADMIN:", email);
        } else {
          console.log("Usuario existente nao foi promovido automaticamente. Use SUPERADMIN_PROMOTE_IF_EXISTS=true se isso for intencional.");
        }
      }
      console.log("Superadmin ja existe:", email);
    } else {
      const passwordHash = await bcrypt.hash(password, 12);
      await connection.execute(
        "INSERT INTO `User` (`name`, `email`, `passwordHash`, `role`, `isBlocked`, `createdAt`) VALUES (?, ?, ?, 'SUPERADMIN', 0, ?)",
        [name, email, passwordHash, new Date()]
      );
      console.log("Superadmin criado:", email);
    }
  } catch (error) {
    console.error("Seed superadmin falhou:", error);
    process.exit(1);
  } finally {
    await connection.end();
  }
})();
