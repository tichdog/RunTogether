import { createHash, randomBytes, randomUUID } from 'node:crypto'
import jwt from 'jsonwebtoken'
import { env } from './env'
import { dbId, now, prisma } from './db'
import { forbidden, HttpError } from './http-error'

const ADMIN_ROLES = new Set(['admin', 'super_admin'])
const ACCESS_TOKEN_TYPE = 'access'

export function isAdmin(user) {
  return ADMIN_ROLES.has(user?.role)
}

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex')
}

function createRefreshToken() {
  return randomBytes(48).toString('base64url')
}

function refreshExpiresAt() {
  return new Date(Date.now() + env.refreshCookieMaxAge * 1000)
}

function clientInfo(request) {
  const forwardedFor = request?.headers?.get('x-forwarded-for') || ''
  return {
    userAgent: request?.headers?.get('user-agent') || null,
    ipAddress: forwardedFor.split(',')[0]?.trim() || request?.headers?.get('x-real-ip') || null,
  }
}

function signAccessToken(user, sessionId, accessJti) {
  return jwt.sign(
    {
      sub: user.id.toString(),
      role: user.role,
      sid: sessionId,
      jti: accessJti,
      typ: ACCESS_TOKEN_TYPE,
    },
    env.jwtSecret,
    {
      expiresIn: env.jwtAccessExpiresIn,
    }
  )
}

export async function createAuthSession(user, request) {
  const sessionId = randomUUID()
  const accessJti = randomUUID()
  const refreshToken = createRefreshToken()
  const { userAgent, ipAddress } = clientInfo(request)

  await prisma.auth_sessions.create({
    data: {
      id: sessionId,
      user_id: dbId(user.id),
      access_jti: accessJti,
      refresh_token_hash: hashToken(refreshToken),
      user_agent: userAgent,
      ip_address: ipAddress,
      expires_at: refreshExpiresAt(),
    },
  })

  return {
    accessToken: signAccessToken(user, sessionId, accessJti),
    refreshToken,
  }
}

export async function rotateAuthSession(refreshToken, request) {
  if (!refreshToken) {
    throw new HttpError(401, 'Нужна авторизация')
  }

  const session = await prisma.auth_sessions.findUnique({
    where: { refresh_token_hash: hashToken(refreshToken) },
    include: { users: true },
  })

  if (!session || session.revoked_at || new Date(session.expires_at).getTime() <= Date.now()) {
    throw new HttpError(401, 'Сессия недействительна')
  }

  const user = await refreshExpiredBlock(session.users)
  if (!user || user.account_status === 'blocked') {
    await revokeAuthSessionById(session.id)
    throw new HttpError(401, 'Сессия недействительна')
  }

  const nextAccessJti = randomUUID()
  const nextRefreshToken = createRefreshToken()
  const { userAgent, ipAddress } = clientInfo(request)

  await prisma.auth_sessions.update({
    where: { id: session.id },
    data: {
      access_jti: nextAccessJti,
      refresh_token_hash: hashToken(nextRefreshToken),
      ...(userAgent ? { user_agent: userAgent } : {}),
      ...(ipAddress ? { ip_address: ipAddress } : {}),
      expires_at: refreshExpiresAt(),
      last_used_at: now(),
      updated_at: now(),
    },
  })

  return {
    accessToken: signAccessToken(user, session.id, nextAccessJti),
    refreshToken: nextRefreshToken,
    user,
  }
}

async function revokeAuthSessionById(sessionId) {
  if (!sessionId) return
  const session = await prisma.auth_sessions.findUnique({ where: { id: sessionId } })
  if (!session) return
  await prisma.auth_sessions.update({
    where: { id: sessionId },
    data: {
      revoked_at: session.revoked_at || now(),
      updated_at: now(),
    },
  })
}

export async function revokeAuthSession(request) {
  const refreshToken = request.cookies.get(env.refreshCookieName)?.value
  if (refreshToken) {
    const session = await prisma.auth_sessions.findUnique({
      where: { refresh_token_hash: hashToken(refreshToken) },
    })
    if (session) await revokeAuthSessionById(session.id)
    return
  }

  const accessToken = request.cookies.get(env.accessCookieName)?.value
  const payload = accessToken ? jwt.decode(accessToken) : null
  await revokeAuthSessionById(payload?.sid)
}

function cookieOptions(maxAge) {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.nodeEnv === 'production',
    path: '/',
    maxAge,
  }
}

export function setAuthCookies(response, tokens) {
  response.cookies.set(
    env.accessCookieName,
    tokens.accessToken,
    cookieOptions(env.accessCookieMaxAge)
  )
  response.cookies.set(
    env.refreshCookieName,
    tokens.refreshToken,
    cookieOptions(env.refreshCookieMaxAge)
  )
}

export function clearAuthCookies(response) {
  response.cookies.set(env.accessCookieName, '', {
    ...cookieOptions(0),
    maxAge: 0,
  })
  response.cookies.set(env.refreshCookieName, '', {
    ...cookieOptions(0),
    maxAge: 0,
  })
}

export async function refreshExpiredBlock(user) {
  if (user?.account_status !== 'blocked' || !user.blocked_until) {
    return user
  }

  if (new Date(user.blocked_until).getTime() > Date.now()) {
    return user
  }

  return prisma.users.update({
    where: { id: dbId(user.id) },
    data: {
      account_status: 'active',
      blocked_until: null,
      block_reason: null,
      updated_at: now(),
    },
  })
}

export async function requireAuth(request) {
  const bearer = request.headers.get('authorization')?.startsWith('Bearer ')
    ? request.headers.get('authorization').slice(7)
    : null
  const token = request.cookies.get(env.accessCookieName)?.value || bearer

  if (!token) {
    throw new HttpError(401, 'Нужна авторизация')
  }

  try {
    const payload = jwt.verify(token, env.jwtSecret)
    if (payload.typ !== ACCESS_TOKEN_TYPE || !payload.sid || !payload.jti) {
      throw new HttpError(401, 'Сессия недействительна')
    }

    const session = await prisma.auth_sessions.findFirst({
      where: {
        id: payload.sid,
        user_id: dbId(payload.sub),
        access_jti: payload.jti,
        revoked_at: null,
        expires_at: { gt: now() },
      },
      include: { users: true },
    })

    const user = await refreshExpiredBlock(session?.users)
    if (!user || user.account_status === 'blocked') {
      throw new HttpError(401, 'Сессия недействительна')
    }

    return user
  } catch (error) {
    if (error.status) throw error
    throw new HttpError(401, 'Сессия недействительна')
  }
}

export function requireAdmin(user) {
  if (!isAdmin(user)) {
    throw forbidden('Доступно только администратору')
  }
}

export function requireSelfOrAdmin(user, id) {
  if (isAdmin(user) || Number(id) === Number(user?.id)) {
    return
  }
  throw forbidden()
}
