function numberFromEnv(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
}

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  clientOrigins: (process.env.CLIENT_ORIGIN || "http://localhost:5173,http://localhost:5174")
    .split(",")
    .map(origin => origin.trim())
    .filter(Boolean),
  databaseUrl: process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5433/sport_training",
  jwtSecret: process.env.JWT_SECRET || "dev-secret-change-me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  cookieName: process.env.COOKIE_NAME || "sport_session",
  uploadUrlPath: "/uploads",
  cronSecret: process.env.CRON_SECRET || "",
  maxUploadBytes: numberFromEnv("MAX_UPLOAD_BYTES", 3 * 1024 * 1024),
};
