import { badRequest } from './http-error'
import { env } from './env'

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
const VERIFY_TIMEOUT_MS = 5000

function requestIp(request) {
  const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return request.headers.get('cf-connecting-ip') || forwardedFor || request.headers.get('x-real-ip')
}

export async function assertTurnstile(request, token) {
  const responseToken = typeof token === 'string' ? token.trim() : ''
  if (!responseToken) {
    throw badRequest('Подтвердите проверку Turnstile')
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), VERIFY_TIMEOUT_MS)

  let result
  try {
    const response = await fetch(SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        secret: env.turnstileSecretKey,
        response: responseToken,
        remoteip: requestIp(request),
      }),
    })

    if (!response.ok) {
      throw new Error(`Turnstile siteverify failed with status ${response.status}`)
    }

    result = await response.json()
  } catch {
    throw badRequest('Проверка Turnstile временно недоступна')
  } finally {
    clearTimeout(timeout)
  }

  if (!result.success) {
    throw badRequest('Проверка Turnstile не пройдена', {
      turnstileErrors: result['error-codes'] || [],
    })
  }

  return result
}
