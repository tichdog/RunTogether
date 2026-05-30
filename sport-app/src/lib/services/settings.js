import { prisma, now } from '../server/db'
import { badRequest } from '../server/http-error'

const DEFAULTS = {
  require_verified_to_create_workouts: true,
  require_email_verification: false,
  require_phone_verification: false,
  default_participant_limit: 20,
  auto_block_complaints_count: 10,
  workout_create_min_lead_hours: 2,
  workout_archive_retention_days: 90,
  review_window_days: 7,
  notification_retention_days: 30,
}

const SETTINGS_CACHE_TTL_MS = 60_000
let settingsCache = null

const NUMBER_LIMITS = {
  default_participant_limit: { min: 1, max: 200 },
  auto_block_complaints_count: { min: 1, max: 100 },
  workout_create_min_lead_hours: { min: 0, max: 168 },
  workout_archive_retention_days: { min: 1, max: 3650 },
  review_window_days: { min: 1, max: 365 },
  notification_retention_days: { min: 1, max: 3650 },
}

export function clearSettingsCache() {
  settingsCache = null
}

export async function getSettings() {
  if (settingsCache && settingsCache.expiresAt > Date.now()) {
    return { ...settingsCache.value }
  }

  const rows = await prisma.system_settings.findMany()
  const value = rows.reduce(
    (acc, row) => {
      acc[row.key] = row.value
      return acc
    },
    { ...DEFAULTS }
  )

  settingsCache = {
    value,
    expiresAt: Date.now() + SETTINGS_CACHE_TTL_MS,
  }

  return { ...value }
}

export async function upsertSettings(values) {
  const allowed = Object.keys(DEFAULTS)
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(values, key)) {
      const value = normalizeSetting(key, values[key])
      await prisma.system_settings.upsert({
        where: { key },
        create: { key, value, updated_at: now() },
        update: { value, updated_at: now() },
      })
    }
  }
  clearSettingsCache()
  return getSettings()
}

function normalizeSetting(key, value) {
  const limits = NUMBER_LIMITS[key]
  if (!limits) return value === true || value === 'true'

  const number = Number(value)
  if (!Number.isFinite(number) || number < limits.min || number > limits.max) {
    throw badRequest(`${key}: укажите число от ${limits.min} до ${limits.max}`)
  }

  return number
}
