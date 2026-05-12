import dotenv from "dotenv";

dotenv.config();

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 4000),
  clientOrigins: (process.env.CLIENT_ORIGIN || "http://localhost:5173,http://localhost:5174")
    .split(",")
    .map(origin => origin.trim())
    .filter(Boolean),
  databaseUrl: process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5433/sport_training",
  jwtSecret: process.env.JWT_SECRET || "dev-secret-change-me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  cookieName: process.env.COOKIE_NAME || "sport_session",
  uploadDir: process.env.UPLOAD_DIR || "uploads",
};
