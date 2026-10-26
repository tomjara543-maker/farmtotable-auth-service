import bcrypt from "bcryptjs";
import { Router } from "express";
import { z } from "zod";
import { requireUser, userOf } from "./auth";
import { prisma } from "./db";
import { publish } from "./events";
import { issueTokens, publicUser, revokeAll, revokeRefreshToken, rotateRefreshToken, TokenError } from "./tokens";

const registerSchema = z.object({
  email: z.email().transform((e) => e.toLowerCase()),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
  name: z.string().min(1),
  role: z.enum(["BUYER", "PRODUCER"]).default("BUYER"),
});

const loginSchema = z.object({
  email: z.email().transform((e) => e.toLowerCase()),
  password: z.string().min(1),
});

const refreshSchema = z.object({ refreshToken: z.string().min(1) });

const updateUserSchema = z.object({
  active: z.boolean().optional(),
  role: z.enum(["BUYER", "PRODUCER", "ADMIN"]).optional(),
});

export function authRoutes() {
  const router = Router();

  router.post("/register", async (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });
    const { email, password, name, role } = parsed.data;

    if (await prisma.user.findUnique({ where: { email } })) {
      return res.status(409).json({ error: "Ya existe una cuenta con ese correo" });
    }
    const user = await prisma.user.create({
      data: { email, name, role, passwordHash: await bcrypt.hash(password, 10) },
    });
    publish("user.registered", { userId: user.id, email, name, role });
    res.status(201).json(await issueTokens(user));
  });

  router.post("/login", async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });
    const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (!user || !user.active || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
      return res.status(401).json({ error: "Correo o contraseña incorrectos" });
    }
    res.json(await issueTokens(user));
  });

  router.post("/refresh", async (req, res) => {
    const parsed = refreshSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });
    try {
      res.json(await rotateRefreshToken(parsed.data.refreshToken));
    } catch (err) {
      if (err instanceof TokenError) return res.status(401).json({ error: err.message });
      throw err;
    }
  });

  router.post("/logout", async (req, res) => {
    const parsed = refreshSchema.safeParse(req.body);
    if (parsed.success) await revokeRefreshToken(parsed.data.refreshToken);
    res.status(204).end();
  });

  router.get("/me", requireUser(), async (_req, res) => {
    const user = await prisma.user.findUnique({ where: { id: userOf(res).id } });
    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
    res.json(publicUser(user));
  });

  router.get("/users", requireUser("ADMIN"), async (_req, res) => {
    const users = await prisma.user.findMany({ orderBy: { createdAt: "desc" } });
    res.json(users.map(publicUser));
  });

  router.patch("/users/:id", requireUser("ADMIN"), async (req, res) => {
    const id = String(req.params.id);
    if (id === userOf(res).id) return res.status(409).json({ error: "No puedes modificar tu propia cuenta" });
    const parsed = updateUserSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });
    if (!(await prisma.user.findUnique({ where: { id } }))) return res.status(404).json({ error: "Usuario no encontrado" });

    const user = await prisma.user.update({ where: { id }, data: parsed.data });
    if (parsed.data.active === false) await revokeAll(id);
    publish("user.updated", { userId: id, role: user.role, active: user.active });
    res.json(publicUser(user));
  });

  return router;
}
