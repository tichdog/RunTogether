import { trimText } from '../input-limits'
import { badRequest } from './http-error'

export function cleanLimitedText(value, field, { max, required = false } = {}) {
  const text = trimText(value)

  if (required && !text) {
    throw badRequest(`Поле "${field}" обязательно`)
  }

  if (Number.isFinite(max) && text.length > max) {
    throw badRequest(`Поле "${field}" не должно быть длиннее ${max} символов`)
  }

  return text
}
