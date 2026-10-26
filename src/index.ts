import bcrypt from "bcryptjs";
import cors from "cors";
import express from "express";
import { prisma } from "./db";
import { connectEvents, publish } from "./events";
import { authRoutes } from "./routes";

const PORT = Number(process.env.PORT ?? 4009);

async function ensureAdmin() {
  const email = process.env.ADMIN_EMAIL?.toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) return;
  if (await prisma.user.findUnique({ where: { email } })) return;
  const admin = await prisma.user.create({
    data: { email, name: "Administrador", role: "ADMIN", passwordHash: await bcrypt.hash(password, 10) },
  });
  publish("user.registered", { userId: admin.id, email, name: admin.name, role: admin.role });
  console.log(`[auth] administrador creado: ${email}`);
}

async function main() {
  await connectEvents();
  await ensureAdmin();

  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/health", (_req, res) => res.json({ service: "auth-service", status: "ok" }));
  app.use("/auth", authRoutes());

  app.listen(PORT, () => console.log(`auth-service escuchando en http://localhost:${PORT}`));
}

main();
