import { INPUT_LIMITS } from '@/lib/input-limits'
import { badRequest } from '@/lib/server/http-error'

const MS_IN_DAY = 24 * 60 * 60 * 1000
const BAN_DAYS_HINT = `Укажите срок бана в днях: 0 — навсегда, от 1 до ${INPUT_LIMITS.banMaxDays} — временный бан`

export function banUntilFromBody(body) {
  const mode = String(body.banMode || body.duration || 'permanent')
  if (mode === 'permanent') return null

  const rawDays = body.banDays ?? body.days
  if (
    rawDays === null ||
    rawDays === undefined ||
    (typeof rawDays === 'string' && rawDays.trim() === '')
  ) {
    throw badRequest(BAN_DAYS_HINT)
  }

  const days = Number(rawDays)

  if (days === 0) return null

  if (!Number.isInteger(days) || days < 0) {
    throw badRequest(BAN_DAYS_HINT)
  }

  if (days > INPUT_LIMITS.banMaxDays) {
    throw badRequest(`Максимальный срок временного бана — ${INPUT_LIMITS.banMaxDays} дней`)
  }

  return new Date(Date.now() + days * MS_IN_DAY)
}
