import { clearAuthCookies, revokeAuthSession } from '@/lib/server/auth'
import { noContent, route } from '@/lib/server/response'

export const POST = route(async (request) => {
  await revokeAuthSession(request)
  const response = noContent()
  clearAuthCookies(response)
  return response
})
