import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const email = process.env.SUPERADMIN_EMAIL;
const password = process.env.SUPERADMIN_PASSWORD;
const name = process.env.SUPERADMIN_NAME || "Super Admin";

if (!email || !password) {
  console.log("SUPERADMIN_EMAIL/SUPERADMIN_PASSWORD não definidos. Seed ignorado.");
  process.exit(0);
}

(async () => {
  try {
    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) {
      if (exists.role !== "SUPERADMIN") {
        await prisma.user.update({
          where: { email },
          data: { role: "SUPERADMIN" },
        });
      }
      console.log("Superadmin já existe:", email);
    } else {
      const passwordHash = await bcrypt.hash(password, 10);
      await prisma.user.create({
        data: { name, email, passwordHash, role: "SUPERADMIN" },
      });
      console.log("Superadmin criado:", email);
    }
  } catch (e) {
    console.error("Seed superadmin falhou:", e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();
