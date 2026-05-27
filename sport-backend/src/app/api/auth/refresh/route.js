import { env } from '@/lib/server/env'
import { publicUser } from '@/lib/mappers/user'
import { rotateAuthSession, setAuthCookies } from '@/lib/server/auth'
import { json, route } from '@/lib/server/response'

export const POST = route(async (request) => {
  const refreshToken = request.cookies.get(env.refreshCookieName)?.value
  const tokens = await rotateAuthSession(refreshToken, request)
  const response = json({ user: publicUser(tokens.user, { viewer: tokens.user }) })

  setAuthCookies(response, tokens)
  return response
})
