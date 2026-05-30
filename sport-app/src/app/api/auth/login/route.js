import bcrypt from 'bcryptjs'
import { INPUT_LIMITS } from '@/lib/input-limits'
import { prisma } from '@/lib/server/db'
import { HttpError, badRequest } from '@/lib/server/http-error'
import { createAuthSession, refreshExpiredBlock, setAuthCookies } from '@/lib/server/auth'
import { publicUser } from '@/lib/mappers/user'
import { json, readJson, route } from '@/lib/server/response'
import { assertRateLimit } from '@/lib/server/rate-limit'

const EMAIL_RE = /^[A-Za-z0-9._%+-]{2,64}@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/

export const POST = route(async (request) => {
  assertRateLimit(request, {
    keyPrefix: 'auth:login',
    limit: 5,
    windowMs: 60 * 1000,
  })

  const body = await readJson(request)
  const rawLogin = String(body.login || '').trim()
  const login = rawLogin.toLowerCase()
  const password = String(body.password || '')
  if (!login || !password) throw badRequest('Укажите логин и пароль')
  if (login.length > INPUT_LIMITS.login || password.length > INPUT_LIMITS.password) {
    throw badRequest('Некорректный логин или пароль')
  }
  if (/[A-Za-z@]/.test(login) && !EMAIL_RE.test(login)) {
    throw badRequest('Некорректный email')
  }

  const found = await prisma.users.findFirst({
    where: {
      OR: [{ email: { equals: login, mode: 'insensitive' } }, { phone: rawLogin }],
    },
  })
  const user = await refreshExpiredBlock(found)
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
