import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/server/db'
import { badRequest, HttpError } from '@/lib/server/http-error'
import { json, readJson, route } from '@/lib/server/response'
import { publicUser } from '@/lib/mappers/user'
import { createAuthSession, setAuthCookies } from '@/lib/server/auth'
import { assertRateLimit } from '@/lib/server/rate-limit'

function normalizeEmail(email) {
  return email ? String(email).trim().toLowerCase() : null
}

function normalizePhone(phone) {
  const value = phone ? String(phone).trim() : ''
  return value || null
}

const NAME_RE = /^\p{L}{2,15}$/u
const LAST_NAME_RE = /^\p{L}{2,15}(?:-\p{L}{2,15})?$/u
const EMAIL_RE = /^[A-Za-z0-9._%+-]{2,64}@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/
const STRONG_PASSWORD_RE = /^(?=.*[a-zа-яё])(?=.*[A-ZА-ЯЁ])(?=.*\d)(?=.*[^A-Za-zА-Яа-яЁё0-9]).{8,}$/

export const POST = route(async (request) => {
  assertRateLimit(request, {
    keyPrefix: 'auth:register',
    limit: 3,
    windowMs: 5 * 60 * 1000,
  })

  const body = await readJson(request)
  const email = normalizeEmail(body.email)
  const phone = normalizePhone(body.phone)
  const password = String(body.password || '')
  const firstName = String(body.firstName || '').trim()
  const lastName = String(body.lastName || '').trim()
  const gender = String(body.gender || '').trim()
  const fullName = `${firstName} ${lastName}`.trim()

  if (!NAME_RE.test(firstName)) {
    throw badRequest('Имя должно содержать только буквы, от 2 до 15 символов')
  }
  if (!LAST_NAME_RE.test(lastName)) {
    throw badRequest(
      'Фамилия должна содержать буквы от 2 до 15 символов. Двойная фамилия пишется через дефис'
    )
  }
  if (!email || !EMAIL_RE.test(email)) {
    throw badRequest('Некорректный email')
  }
  if (!['male', 'female'].includes(gender)) {
    throw badRequest('Укажите пол')
  }
  if (!STRONG_PASSWORD_RE.test(password)) {
    throw badRequest(
      'Пароль должен быть от 8 символов и содержать прописные, строчные буквы, цифры и символы'
    )
  }

  const existing = await prisma.users.findFirst({
    where: {
      OR: [{ email: { equals: email, mode: 'insensitive' } }, ...(phone ? [{ phone }] : [])],
    },
    select: { email: true, phone: true },
  })
  if (existing?.email?.toLowerCase() === email) {
    throw new HttpError(409, 'Пользователь с такой почтой уже существует')
  }
  if (phone && existing?.phone === phone) {
    throw new HttpError(409, 'Пользователь с таким телефоном уже существует')
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10)
    const newUser = await prisma.users.create({
      data: {
        email,
        phone,
        password_hash: passwordHash,
        first_name: firstName,
        last_name: lastName,
        gender,
        full_name: fullName,
      },
    })

    const response = json({ user: publicUser(newUser, { viewer: newUser }) }, 201)
    setAuthCookies(response, await createAuthSession(newUser, request))
    return response
  } catch (error) {
    if (error.code === 'P2002') {
      throw new HttpError(409, 'Пользователь с такой почтой или телефоном уже существует')
    }
    throw error
  }
})
