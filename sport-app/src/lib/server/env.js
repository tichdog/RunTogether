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

function booleanFromEnv(name, fallback) {
  const value = process.env[name]
  if (value == null || value === '') return fallback
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase())
}

export const env = {
  nodeEnv,
  clientOrigins: (process.env.CLIENT_ORIGIN || 'http://localhost:4000')
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
  s3Endpoint: requiredEnv('S3_ENDPOINT', 'http://localhost:9000'),
  s3Region: process.env.S3_REGION || 'us-east-1',
  s3Bucket: requiredEnv('S3_BUCKET', 'sport-app'),
  s3AccessKeyId: requiredEnv('S3_ACCESS_KEY_ID', 'minioadmin'),
  s3SecretAccessKey: requiredEnv('S3_SECRET_ACCESS_KEY', 'minioadmin'),
  s3ForcePathStyle: booleanFromEnv('S3_FORCE_PATH_STYLE', true),
  cronSecret: requiredSecret('CRON_SECRET', '', {
    reject: ['', 'change-this-cron-secret'],
  }),
  turnstileSecretKey: requiredSecret(
    'TURNSTILE_SECRET_KEY',
    '1x0000000000000000000000000000000AA',
    {
      minLength: 1,
    }
  ),
  logLevel: process.env.LOG_LEVEL || 'info',
  logFile: process.env.LOG_FILE || 'logs/app.log',
  maxUploadBytes: numberFromEnv('MAX_UPLOAD_BYTES', 3 * 1024 * 1024),
}
