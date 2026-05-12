import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "node:path";
import { env } from "./config/env.js";
import { authRouter } from "./routes/auth.routes.js";
import { usersRouter } from "./routes/users.routes.js";
import { workoutsRouter } from "./routes/workouts.routes.js";
import { settingsRouter } from "./routes/settings.routes.js";
import { notificationsRouter } from "./routes/notifications.routes.js";
import { activitiesRouter } from "./routes/activities.routes.js";
import { reportsRouter } from "./routes/reports.routes.js";
import { errorHandler, notFoundHandler } from "./middleware/error.js";

export function createApp() {
  const app = express();

  app.use(cors({
    origin: env.clientOrigins,
    credentials: true,
  }));
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  app.use("/uploads", express.static(path.resolve(env.uploadDir)));

  app.get("/health", (req, res) => res.json({ ok: true }));
  app.use("/api/auth", authRouter);
  app.use("/api/users", usersRouter);
  app.use("/api/workouts", workoutsRouter);
  app.use("/api/settings", settingsRouter);
  app.use("/api/notifications", notificationsRouter);
  app.use("/api/activities", activitiesRouter);
  app.use("/api/reports", reportsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
