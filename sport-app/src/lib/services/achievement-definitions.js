import { INPUT_LIMITS } from '../input-limits'
import { randomUUID } from 'node:crypto'
import { badRequest } from '../server/http-error'

export const ACHIEVEMENT_CONDITIONS = new Set([
  'completed_workouts',
  'distance_km',
  'morning_workouts',
  'organized_workouts',
])

export function achievementBodyFromFormData(form) {
  const body = {}

  for (const key of ['code', 'title', 'description', 'icon']) {
    if (form.has(key)) body[key] = form.get(key)
  }

  if (form.has('conditionType') || form.has('conditionValue')) {
    body.condition = {
      type: form.get('conditionType'),
      value: form.get('conditionValue'),
    }
  }

  return body
}

function cleanText(value, field, { max = 160, required = true } = {}) {
  const text = String(value || '').trim()
  if (required && !text) throw badRequest(`Поле "${field}" обязательно`)
  if (text.length > max) throw badRequest(`Поле "${field}" слишком длинное`)
  return text
}

function makeCode(title) {
  const suffix = `_${randomUUID().replaceAll('-', '').slice(0, 6)}`
  const maxBaseLength = Math.max(1, INPUT_LIMITS.achievementCode - suffix.length)
  const code = title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{Letter}\p{Number}]+/gu, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, maxBaseLength)

  return `${code || 'ach'}${suffix}`.slice(0, INPUT_LIMITS.achievementCode)
}

function fallbackAchievementCode() {
  return `ach_${randomUUID().replaceAll('-', '').slice(0, 10)}`.slice(
    0,
    INPUT_LIMITS.achievementCode
  )
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
      .replace(/[^\p{Letter}\p{Number}_-]/gu, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '')

    if (!payload.code) {
      payload.code = fallbackAchievementCode()
    }
  }

  return payload
}
