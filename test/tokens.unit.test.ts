import assert from "node:assert/strict";
import { test } from "node:test";
import jwt, { JwtPayload } from "jsonwebtoken";
import { publicUser, signAccessToken } from "../src/tokens";

const user = {
  id: "u-1",
  email: "ana@finca.co",
  name: "Ana",
  role: "PRODUCER",
  passwordHash: "$2a$10$hash",
  active: true,
  createdAt: new Date("2026-11-01T00:00:00Z"),
} as Parameters<typeof publicUser>[0];

test("signAccessToken firma un JWT con identidad y rol que vence en 15 minutos", () => {
  const token = signAccessToken(user);
  const payload = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;

  assert.equal(payload.sub, "u-1");
  assert.equal(payload.role, "PRODUCER");
  assert.equal(payload.email, "ana@finca.co");
  assert.equal(payload.exp! - payload.iat!, 15 * 60);
  assert.throws(() => jwt.verify(token, "otro-secreto"));
});

test("publicUser nunca expone el hash de la contraseña", () => {
  const json = publicUser(user);

  assert.equal("passwordHash" in json, false);
  assert.deepEqual(Object.keys(json).sort(), ["active", "createdAt", "email", "id", "name", "role"]);
});
