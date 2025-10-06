// scripts/seed-local.mjs
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const email = (process.env.SUPERADMIN_EMAIL || "admin@local.test").toLowerCase();
const password = process.env.SUPERADMIN_PASSWORD || "Admin123!";
const name = process.env.SUPERADMIN_NAME || "Super Admin";

(async () => {
  try {
    const exists = await prisma.user.findUnique({ where: { email } });
    const passwordHash = await bcrypt.hash(password, 10);

    if (exists) {
      await prisma.user.update({
        where: { email },
        data: { role: "SUPERADMIN", passwordHash, name },
      });
      console.log("✅ SUPERADMIN atualizado:", email);
    } else {
      await prisma.user.create({
        data: { name, email, role: "SUPERADMIN", passwordHash },
      });
      console.log("✅ SUPERADMIN criado:", email);
    }

    console.log("ℹ️  Credenciais:");
    console.log("   Email:", email);
    console.log("   Senha:", password);
  } catch (e) {
    console.error("❌ Seed falhou:", e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();
