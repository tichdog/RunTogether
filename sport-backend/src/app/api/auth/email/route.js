import { query } from '@/lib/server/db'
import { badRequest } from '@/lib/server/http-error'
import { json, route } from '@/lib/server/response'

const EMAIL_RE = /^[A-Za-z0-9._%+-]{2,64}@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/

function normalizeEmail(email) {
  return email ? String(email).trim().toLowerCase() : null
}

export const GET = route(async (request) => {
  const { searchParams } = new URL(request.url)
  const email = normalizeEmail(searchParams.get('email'))

  if (!email || !EMAIL_RE.test(email)) {
    throw badRequest('Некорректный email')
  }

  const { rowCount } = await query('select 1 from users where lower(email) = $1 limit 1', [email])

  return json({ email, available: rowCount === 0 })
})
