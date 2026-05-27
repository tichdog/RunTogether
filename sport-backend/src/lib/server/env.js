function numberFromEnv(name, fallback) {
  const value = Number(process.env[name])
  return Number.isFinite(value) ? value : fallback
}

const nodeEnv = process.env.NODE_ENV || 'development'
const isProduction = nodeEnv === 'production'

function requiredEnv(name, fallback) {
  const value = process.env[name]
  if (value) return value
  if (isProduction) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return fallback
}

function requiredSecret(name, fallback, { minLength = 32, reject = [] } = {}) {
  const value = requiredEnv(name, fallback)
  if (isProduction && (value.length < minLength || reject.includes(value))) {
    throw new Error(`Environment variable ${name} must be a strong production secret`)
  }
  return value
}

export const env = {
  nodeEnv,
  clientOrigins: requiredEnv('CLIENT_ORIGIN', 'http://localhost:5173,http://localhost:5174')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  databaseUrl: requiredEnv(
    'DATABASE_URL',
    'postgres://postgres:postgres@localhost:5433/sport_training'
  ),
  jwtSecret: requiredSecret('JWT_SECRET', 'dev-secret-change-me', {
    reject: ['dev-secret-change-me', 'change-this-secret'],
  }),
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  accessCookieName: process.env.ACCESS_COOKIE_NAME || 'sport_access_token',
  refreshCookieName: process.env.REFRESH_COOKIE_NAME || 'sport_refresh_token',
  accessCookieMaxAge: numberFromEnv('ACCESS_COOKIE_MAX_AGE_SECONDS', 15 * 60),
  refreshCookieMaxAge: numberFromEnv('REFRESH_COOKIE_MAX_AGE_SECONDS', 30 * 24 * 60 * 60),
  uploadUrlPath: '/uploads',
  cronSecret: requiredSecret('CRON_SECRET', '', {
    reject: ['', 'change-this-cron-secret'],
  }),
  logLevel: process.env.LOG_LEVEL || 'info',
  logFile: process.env.LOG_FILE || 'logs/backend.log',
  maxUploadBytes: numberFromEnv('MAX_UPLOAD_BYTES', 3 * 1024 * 1024),
}
