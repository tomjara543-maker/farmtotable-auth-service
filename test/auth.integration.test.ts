import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { as, request, Running, startApp } from "./helpers";

let api: Running;

before(async () => {
  const { createApp } = await import("../src/app");
  api = await startApp(createApp());
});

after(() => api.close());

test("POST /auth/register rechaza correos inválidos y contraseñas cortas", async () => {
  const badEmail = await request(api.url, "/auth/register", {
    method: "POST",
    body: { email: "no-es-correo", password: "12345678", name: "Ana" },
  });
  assert.equal(badEmail.status, 400);
  assert.ok(badEmail.body.error.some((i: { path: string[] }) => i.path.includes("email")));

  const shortPassword = await request(api.url, "/auth/register", {
    method: "POST",
    body: { email: "ana@finca.co", password: "123", name: "Ana" },
  });
  assert.equal(shortPassword.status, 400);
  assert.ok(shortPassword.body.error.some((i: { message: string }) => /al menos 8 caracteres/.test(i.message)));
});

test("PATCH /auth/users/:id solo lo usa un admin y nunca sobre su propia cuenta", async () => {
  const anonymous = await request(api.url, "/auth/users/u-2", { method: "PATCH", body: { active: false } });
  assert.equal(anonymous.status, 401);

  const buyer = await request(api.url, "/auth/users/u-2", { method: "PATCH", headers: as("u-1", "BUYER"), body: { active: false } });
  assert.equal(buyer.status, 403);

  const self = await request(api.url, "/auth/users/admin-1", { method: "PATCH", headers: as("admin-1", "ADMIN"), body: { active: false } });
  assert.equal(self.status, 409);
  assert.equal(self.body.error, "No puedes modificar tu propia cuenta");
});
