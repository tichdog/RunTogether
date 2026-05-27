function numberFromEnv(name, fallback) {
  const value = Number(process.env[name])
  return Number.isFinite(value) ? value : fallback
}

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  clientOrigins: (process.env.CLIENT_ORIGIN || 'http://localhost:5173,http://localhost:5174')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  databaseUrl:
    process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5433/sport_training',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  accessCookieName: process.env.ACCESS_COOKIE_NAME || 'sport_access_token',
  refreshCookieName: process.env.REFRESH_COOKIE_NAME || 'sport_refresh_token',
  accessCookieMaxAge: numberFromEnv('ACCESS_COOKIE_MAX_AGE_SECONDS', 15 * 60),
  refreshCookieMaxAge: numberFromEnv('REFRESH_COOKIE_MAX_AGE_SECONDS', 30 * 24 * 60 * 60),
  uploadUrlPath: '/uploads',
  cronSecret: process.env.CRON_SECRET || '',
  logLevel: process.env.LOG_LEVEL || 'info',
  logFile: process.env.LOG_FILE || 'logs/backend.log',
  maxUploadBytes: numberFromEnv('MAX_UPLOAD_BYTES', 3 * 1024 * 1024),
}
