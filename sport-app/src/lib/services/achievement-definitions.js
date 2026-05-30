import { INPUT_LIMITS } from '../input-limits'
import { badRequest } from '../server/http-error'

export const ACHIEVEMENT_CONDITIONS = new Set([
  'completed_workouts',
  'distance_km',
  'morning_workouts',
  'organized_workouts',
])

function cleanText(value, field, { max = 160, required = true } = {}) {
  const text = String(value || '').trim()
  if (required && !text) throw badRequest(`Поле "${field}" обязательно`)
  if (text.length > max) throw badRequest(`Поле "${field}" слишком длинное`)
  return text
}

function makeCode(title) {
  const code = title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{Letter}\p{Number}]+/gu, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, INPUT_LIMITS.achievementCode)

  return code || `achievement_${Date.now()}`
}

export function normalizeAchievementPayload(body, { partial = false } = {}) {
  const payload = {}

  if (!partial || 'title' in body) {
    payload.title = cleanText(body.title, 'Название', {
      max: INPUT_LIMITS.achievementTitle,
      required: !partial,
    })
  }

  if (!partial || 'description' in body) {
    payload.description = cleanText(body.description, 'Описание', {
      max: INPUT_LIMITS.achievementDescription,
      required: !partial,
    })
  }

  if (!partial || 'icon' in body) {
    payload.icon = cleanText(body.icon, 'Значок', {
      max: INPUT_LIMITS.achievementIcon,
      required: !partial,
    })
  }

  if (!partial || 'condition' in body || 'conditionType' in body || 'conditionValue' in body) {
    const source = body.condition || {}
    const type = String(body.conditionType || source.type || '').trim()
    const value = Number(body.conditionValue ?? source.value)

    if (!ACHIEVEMENT_CONDITIONS.has(type)) {
      throw badRequest('Выберите корректное условие достижения')
    }

    if (
      !Number.isFinite(value) ||
      value <= 0 ||
      value > INPUT_LIMITS.achievementConditionValue
    ) {
      throw badRequest(`Значение условия должно быть числом от 1 до ${INPUT_LIMITS.achievementConditionValue}`)
    }

    payload.condition = { type, value }
  }

  if (!partial || 'code' in body) {
    const fallback = payload.title || body.title || ''
    payload.code = cleanText(body.code || makeCode(fallback), 'Код', {
      max: INPUT_LIMITS.achievementCode,
      required: !partial,
    })
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '')

    if (!payload.code) {
      payload.code = `achievement_${Date.now()}`
    }
  }

  return payload
}
