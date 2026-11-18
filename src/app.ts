import cors from "cors";
import express from "express";
import { authRoutes } from "./routes";
import { metricsHandler, metricsMiddleware } from "./metrics";

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use(metricsMiddleware);

  app.get("/health", (_req, res) => res.json({ service: "auth-service", status: "ok" }));
  app.get("/metrics", metricsHandler);
  app.use("/auth", authRoutes());
  return app;
}
