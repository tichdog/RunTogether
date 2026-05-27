import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../../generated/prisma/client.ts'
import { env } from './env'

const globalForPrisma = globalThis

const adapter =
  globalForPrisma.sportPrismaAdapter ||
  new PrismaPg({
    connectionString: env.databaseUrl,
  })

export const prisma =
  globalForPrisma.sportPrisma ||
  new PrismaClient({
    adapter,
  })

if (env.nodeEnv !== 'production') {
  globalForPrisma.sportPrismaAdapter = adapter
  globalForPrisma.sportPrisma = prisma
}

export function dbId(value) {
  return typeof value === 'bigint' ? value : BigInt(value)
}

export function now() {
  return new Date()
}
