import { prisma } from '@/lib/server/db'
import { INPUT_LIMITS } from '@/lib/input-limits'
import { badRequest } from '@/lib/server/http-error'
import { json, route } from '@/lib/server/response'

const EMAIL_RE = /^[A-Za-z0-9._%+-]{2,64}@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/

function normalizeEmail(email) {
  return email ? String(email).trim().toLowerCase() : null
}

export const GET = route(async (request) => {
  const { searchParams } = new URL(request.url)
  const email = normalizeEmail(searchParams.get('email'))

  if (!email || email.length > INPUT_LIMITS.email || !EMAIL_RE.test(email)) {
    throw badRequest('Некорректный email')
  }

  const existing = await prisma.users.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    select: { id: true },
  })

  return json({ email, available: !existing })
})
