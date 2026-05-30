import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import pino from 'pino'
import { env } from './env'

function logStreams() {
  if (!env.logFile) {
    return [{ stream: process.stdout }]
  }

  const logFile = resolve(env.logFile)
  mkdirSync(dirname(logFile), { recursive: true })

  return [{ stream: process.stdout }, { stream: pino.destination({ dest: logFile, sync: false }) }]
}

export const logger = pino(
  {
    level: env.logLevel,
    base: {
      service: 'sport-app',
      env: env.nodeEnv,
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: {
      paths: [
        'authorization',
        'cookie',
        'headers.authorization',
        'headers.cookie',
        'jwt',
        'password',
        'password_hash',
        'req.headers.authorization',
        'req.headers.cookie',
        'request.headers.authorization',
        'request.headers.cookie',
        'token',
        '*.password',
        '*.password_hash',
        '*.token',
      ],
      censor: '[redacted]',
    },
  },
  pino.multistream(logStreams())
)
