process.env.DATABASE_URL = "postgresql://test:test@127.0.0.1:1/test";
process.env.SERVICE_NAME = "auth-service";
delete process.env.RABBITMQ_URL;
delete process.env.INTERNAL_TOKEN;
process.env.JWT_SECRET = "secreto-de-pruebas";
