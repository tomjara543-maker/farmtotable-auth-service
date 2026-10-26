# auth-service

Usuarios, inicio de sesión y tokens JWT (access + refresh). Parte de **FarmToTable** (marketplace agrícola con microservicios orientados a eventos).

Estado: **Implementado** con Prisma + PostgreSQL (bcrypt, JWT de 15 min, refresh tokens rotativos guardados como hash).

- Puerto local: `4009` · Ruta pública en el API Gateway: `/api/auth`
- Base de datos propia (`DATABASE_URL`), nunca compartida con otro servicio
- Eventos por RabbitMQ (exchange topic `farmtotable.events`, ver `src/events.ts`)

## Contrato REST

Es lo que ya consume el frontend (y lo que simula su modo demo en `src/lib/mock/server.ts` del repo del frontend).
El API Gateway valida el JWT y reenvía `x-user-id` / `x-user-role`; usa `requireUser()` de `src/auth.ts`.

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| `POST` | `/auth/register` | público | `{ name, email, password (≥8), role: BUYER / PRODUCER }` → 201 `{ accessToken, refreshToken, user }`; 409 si el correo existe |
| `POST` | `/auth/login` | público | `{ email, password }` → `{ accessToken, refreshToken, user }`; 401 genérico |
| `POST` | `/auth/refresh` | público | `{ refreshToken }` → par nuevo (rotación). Reusar uno ya rotado revoca todas las sesiones |
| `POST` | `/auth/logout` | público | `{ refreshToken }` → 204 |
| `GET` | `/auth/me` | autenticado | Usuario actual |
| `GET` | `/auth/users` | ADMIN | Lista |
| `PATCH` | `/auth/users/:id` | ADMIN | `{ active?, role? }` → publica `user.updated`; desactivar revoca sus refresh tokens; no aplica sobre uno mismo |

Errores: `{ "error": "mensaje" }` con 400 (validación zod), 401, 403, 404, 409 (estado inválido) o 422 (regla de negocio).

## Eventos

Publica:
- `user.registered`
- `user.updated`

Consume:
- (ninguno)

Todo consumidor debe envolverse en `idempotent()` (`src/db.ts`).

## Modelo de datos (Prisma)

- `User` (id, email único, name, passwordHash bcrypt, role, active)
- `RefreshToken` (solo el hash SHA-256, expiresAt, revokedAt)

## Desarrollo

```bash
cp .env.example .env    # ajusta DATABASE_URL
npm install
npm run db:migrate      # crea/aplica migraciones
npm run dev
```

## Despliegue

`Dockerfile` + `render.yaml` (Render) y `.github/workflows/ci.yml`: compila en cada push/PR y, en `main`,
publica la imagen en GHCR y dispara el deploy hook de Render si existe el secreto `RENDER_DEPLOY_HOOK_URL`.
