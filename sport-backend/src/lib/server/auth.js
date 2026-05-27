import { createHash, randomBytes, randomUUID } from 'node:crypto'
import jwt from 'jsonwebtoken'
import { env } from './env'
import { query } from './db'
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
      sub: user.id,
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

  await query(
    `insert into auth_sessions (
       id, user_id, access_jti, refresh_token_hash, user_agent, ip_address, expires_at
     ) values ($1, $2, $3, $4, $5, $6, $7)`,
    [sessionId, user.id, accessJti, hashToken(refreshToken), userAgent, ipAddress, refreshExpiresAt()]
  )

  return {
    accessToken: signAccessToken(user, sessionId, accessJti),
    refreshToken,
  }
}

export async function rotateAuthSession(refreshToken, request) {
  if (!refreshToken) {
    throw new HttpError(401, 'Нужна авторизация')
  }

  const { rows } = await query(
    `select s.id as session_id,
            s.expires_at as session_expires_at,
            s.revoked_at as session_revoked_at,
            u.*
       from auth_sessions s
       join users u on u.id = s.user_id
      where s.refresh_token_hash = $1
      limit 1`,
    [hashToken(refreshToken)]
  )
  const session = rows[0]

  if (
    !session ||
    session.session_revoked_at ||
    new Date(session.session_expires_at).getTime() <= Date.now()
  ) {
    throw new HttpError(401, 'Сессия недействительна')
  }

  const user = await refreshExpiredBlock(session)
  if (!user || user.account_status === 'blocked') {
    await revokeAuthSessionById(session.session_id)
    throw new HttpError(401, 'Сессия недействительна')
  }

  const nextAccessJti = randomUUID()
  const nextRefreshToken = createRefreshToken()
  const { userAgent, ipAddress } = clientInfo(request)

  await query(
    `update auth_sessions
        set access_jti = $1,
            refresh_token_hash = $2,
            user_agent = coalesce($3, user_agent),
            ip_address = coalesce($4, ip_address),
            expires_at = $5,
            last_used_at = now(),
            updated_at = now()
      where id = $6`,
    [
      nextAccessJti,
      hashToken(nextRefreshToken),
      userAgent,
      ipAddress,
      refreshExpiresAt(),
      session.session_id,
    ]
  )

  return {
    accessToken: signAccessToken(user, session.session_id, nextAccessJti),
    refreshToken: nextRefreshToken,
    user,
  }
}

async function revokeAuthSessionById(sessionId) {
  if (!sessionId) return
  await query(
    `update auth_sessions
        set revoked_at = coalesce(revoked_at, now()),
            updated_at = now()
      where id = $1`,
    [sessionId]
  )
}

export async function revokeAuthSession(request) {
  const refreshToken = request.cookies.get(env.refreshCookieName)?.value
  if (refreshToken) {
    await query(
      `update auth_sessions
          set revoked_at = coalesce(revoked_at, now()),
              updated_at = now()
        where refresh_token_hash = $1`,
      [hashToken(refreshToken)]
    )
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

  const { rows } = await query(
    `update users
        set account_status = 'active',
            blocked_until = null,
            block_reason = null,
            updated_at = now()
      where id = $1
      returning *`,
    [user.id]
  )
  return rows[0] || user
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

    const { rows } = await query(
      `select u.*
         from auth_sessions s
         join users u on u.id = s.user_id
        where s.id = $1
          and s.user_id = $2
          and s.access_jti = $3
          and s.revoked_at is null
          and s.expires_at > now()
        limit 1`,
      [payload.sid, payload.sub, payload.jti]
    )

    const user = await refreshExpiredBlock(rows[0])
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
