import { createHash, randomBytes } from "crypto";
import jwt, { SignOptions } from "jsonwebtoken";
import { prisma } from "./db";
import { User } from "./generated/prisma/client";

const JWT_SECRET = process.env.JWT_SECRET ?? "";
if (!JWT_SECRET) throw new Error("Falta la variable JWT_SECRET (debe ser igual a la del api-gateway)");

const ACCESS_TTL = (process.env.ACCESS_TOKEN_TTL ?? "15m") as SignOptions["expiresIn"];
const REFRESH_DAYS = Number(process.env.REFRESH_TOKEN_DAYS ?? 7);

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

export const publicUser = ({ id, email, name, role, createdAt, active }: User) => ({ id, email, name, role, createdAt, active });

export const signAccessToken = (user: Pick<User, "id" | "role" | "email" | "name">) =>
  jwt.sign({ sub: user.id, role: user.role, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: ACCESS_TTL });

export async function issueTokens(user: User) {
  const accessToken = signAccessToken(user);
  const refreshToken = randomBytes(48).toString("base64url");
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: sha256(refreshToken),
      expiresAt: new Date(Date.now() + REFRESH_DAYS * 24 * 60 * 60 * 1000),
    },
  });
  return { accessToken, refreshToken, user: publicUser(user) };
}

export class TokenError extends Error {}

export async function rotateRefreshToken(refreshToken: string) {
  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash: sha256(refreshToken) },
    include: { user: true },
  });
  if (!stored) throw new TokenError("Refresh token inválido");
  if (stored.revokedAt) {
    await revokeAll(stored.userId);
    throw new TokenError("Refresh token reutilizado: se cerraron todas las sesiones");
  }
  if (stored.expiresAt < new Date() || !stored.user.active) throw new TokenError("Sesión expirada");

  await prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
  return issueTokens(stored.user);
}

export async function revokeRefreshToken(refreshToken: string) {
  await prisma.refreshToken.updateMany({
    where: { tokenHash: sha256(refreshToken), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export const revokeAll = (userId: string) =>
  prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
