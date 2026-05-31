import { requireAuth } from '@/lib/server/auth'
import { isValidPhoneNumber } from 'libphonenumber-js/min'
import { INPUT_LIMITS } from '@/lib/input-limits'
import { dbId, now, prisma } from '@/lib/server/db'
import { badRequest } from '@/lib/server/http-error'
import { publicUser } from '@/lib/mappers/user'
import { getUserProfile } from '@/lib/repositories/users'
import { json, readJson, route } from '@/lib/server/response'

const NAME_RE = /^\p{L}{2,15}$/u
const LAST_NAME_RE = /^\p{L}{2,15}(?:-\p{L}{2,15})?$/u

function normalizePhone(phone) {
  const value = phone == null ? '' : String(phone).trim()
  return value || null
}

export const PATCH = route(async (request) => {
  const user = await requireAuth(request)
  const body = await readJson(request)

  const firstName = String(body.firstName || body.first_name || user.first_name || '').trim()
  const lastName = String(body.lastName || body.last_name || user.last_name || '').trim()
  const gender = String(body.gender || user.gender || '').trim()
  const phone = body.phone === undefined ? user.phone : normalizePhone(body.phone)
  const fullName = `${firstName} ${lastName}`.trim()
  const privacy = body.privacy || body.privacySettings || {}

  if (!NAME_RE.test(firstName)) {
    throw badRequest('Имя должно содержать только буквы, от 2 до 15 символов')
  }

  if (!LAST_NAME_RE.test(lastName)) {
    throw badRequest(
      'Фамилия должна содержать буквы от 2 до 15 символов. Двойная фамилия пишется через дефис'
    )
  }

  if (!['male', 'female'].includes(gender)) {
    throw badRequest('Некорректный пол')
  }

  if (phone && (String(phone).length > INPUT_LIMITS.phone || !isValidPhoneNumber(phone))) {
    throw badRequest('Некорректный телефон')
  }

  try {
    await prisma.users.update({
      where: { id: dbId(user.id) },
      data: {
        first_name: firstName,
        last_name: lastName,
        gender,
        phone,
        full_name: fullName,
        privacy_settings: { ...(user.privacy_settings || {}), ...privacy },
        updated_at: now(),
      },
    })

    const profile = await getUserProfile(user.id)

    return json({ user: publicUser(profile, { viewer: user }) })
  } catch (error) {
    if (error.code === 'P2002') {
      throw badRequest('Такой телефон уже используется')
    }

    throw error
  }
})
