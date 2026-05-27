import bcrypt from 'bcryptjs'
import { query } from '@/lib/server/db'
import { HttpError, badRequest } from '@/lib/server/http-error'
import { createAuthSession, refreshExpiredBlock, setAuthCookies } from '@/lib/server/auth'
import { publicUser } from '@/lib/mappers/user'
import { json, readJson, route } from '@/lib/server/response'

const EMAIL_RE = /^[A-Za-z0-9._%+-]{2,64}@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/

export const POST = route(async (request) => {
  const body = await readJson(request)
  const rawLogin = String(body.login || '').trim()
  const login = rawLogin.toLowerCase()
  const password = String(body.password || '')
  if (!login || !password) throw badRequest('Укажите логин и пароль')
  if (/[A-Za-z@]/.test(login) && !EMAIL_RE.test(login)) {
    throw badRequest('Некорректный email')
  }

  const { rows } = await query(
    'select * from users where lower(email) = $1 or phone = $2 limit 1',
    [login, rawLogin]
  )
  const user = await refreshExpiredBlock(rows[0])
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    throw new HttpError(401, 'Неверный логин или пароль')
  }
  if (user.account_status === 'blocked') {
    const until = user.blocked_until
      ? ` до ${new Date(user.blocked_until).toLocaleDateString('ru-RU')}`
      : ''
    const reason = user.block_reason ? `: ${user.block_reason}` : ''
    throw new HttpError(403, `Пользователь заблокирован${until}${reason}`)
  }

  const response = json({ user: publicUser(user, { viewer: user }) })
  setAuthCookies(response, await createAuthSession(user, request))
  return response
})
