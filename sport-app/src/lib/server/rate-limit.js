import { HttpError } from './http-error'

const globalForRateLimit = globalThis

const buckets = globalForRateLimit.sportRateLimitBuckets || new Map()
globalForRateLimit.sportRateLimitBuckets = buckets

function clientIp(request) {
  const forwardedFor = request.headers.get('x-forwarded-for') || ''
  return (
    forwardedFor.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    request.headers.get('cf-connecting-ip') ||
    'unknown'
  )
}

function cleanup(now) {
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) {
      buckets.delete(key)
    }
  }
}

export function assertRateLimit(request, { keyPrefix, limit, windowMs }) {
  const now = Date.now()
  cleanup(now)

  const key = `${keyPrefix}:${clientIp(request)}`
  const bucket = buckets.get(key)

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return
  }

  bucket.count += 1

  if (bucket.count > limit) {
    const retryAfterSeconds = Math.ceil((bucket.resetAt - now) / 1000)
    throw new HttpError(429, 'Слишком много запросов. Попробуйте позже', {
      retryAfterSeconds,
    })
  }
}
