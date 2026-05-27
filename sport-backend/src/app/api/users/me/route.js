import { requireAuth } from '@/lib/server/auth'
import { dbId, now, prisma } from '@/lib/server/db'
import { badRequest } from '@/lib/server/http-error'
import { publicUser } from '@/lib/mappers/user'
import { getUserProfile } from '@/lib/repositories/users'
import { json, readJson, route } from '@/lib/server/response'

const NAME_RE = /^\p{L}{2,15}$/u
const LAST_NAME_RE = /^\p{L}{2,15}(?:-\p{L}{2,15})?$/u

export const PATCH = route(async (request) => {
  const user = await requireAuth(request)
  const body = await readJson(request)

  const firstName = String(body.firstName || body.first_name || user.first_name || '').trim()
  const lastName = String(body.lastName || body.last_name || user.last_name || '').trim()
  const gender = String(body.gender || user.gender || '').trim()
  const phone = body.phone === '' ? null : (body.phone ?? user.phone)
  const fullName = `${firstName} ${lastName}`.trim()
  const privacy = body.privacy || body.privacySettings || {}

  if (!NAME_RE.test(firstName)) {
    throw badRequest(
      'РРјСЏ РґРѕР»Р¶РЅРѕ СЃРѕРґРµСЂР¶Р°С‚СЊ С‚РѕР»СЊРєРѕ Р±СѓРєРІС‹, РѕС‚ 2 РґРѕ 15 СЃРёРјРІРѕР»РѕРІ'
    )
  }
  if (!LAST_NAME_RE.test(lastName)) {
    throw badRequest(
      'Р¤Р°РјРёР»РёСЏ РґРѕР»Р¶РЅР° СЃРѕРґРµСЂР¶Р°С‚СЊ Р±СѓРєРІС‹ РѕС‚ 2 РґРѕ 15 СЃРёРјРІРѕР»РѕРІ. Р”РІРѕР№РЅР°СЏ С„Р°РјРёР»РёСЏ РїРёС€РµС‚СЃСЏ С‡РµСЂРµР· РґРµС„РёСЃ'
    )
  }
  if (!['male', 'female'].includes(gender)) throw badRequest('РќРµРєРѕСЂСЂРµРєС‚РЅС‹Р№ РїРѕР»')

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
    if (error.code === 'P2002')
      throw badRequest('РўР°РєРѕР№ С‚РµР»РµС„РѕРЅ СѓР¶Рµ РёСЃРїРѕР»СЊР·СѓРµС‚СЃСЏ')
    throw error
  }
})
