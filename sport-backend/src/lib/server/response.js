import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { logger } from './logger'

const REQUEST_ID_HEADER = 'x-request-id'

export function json(payload, status = 200) {
  return NextResponse.json(payload, { status })
}

export function noContent() {
  return new NextResponse(null, { status: 204 })
}

function redactSearchParams(searchParams) {
  const redacted = new URLSearchParams(searchParams)
  for (const key of redacted.keys()) {
    if (/authorization|cookie|jwt|password|secret|token/i.test(key)) {
      redacted.set(key, '[redacted]')
    }
  }

  const value = redacted.toString()
  return value ? `?${value}` : undefined
}

function requestLogContext(request, requestId) {
  if (!request || typeof request !== 'object') {
    return { requestId }
  }

  let path
  let search
  try {
    if (request.url) {
      const url = new URL(request.url)
      path = url.pathname
      search = redactSearchParams(url.searchParams)
    }
  } catch {
    path = undefined
  }

  return {
    requestId,
    req: {
      method: request.method,
      path,
      search,
    },
  }
}

function logRequestCompleted(request, response, startedAt, requestId) {
  const status = response?.status || 200
  const durationMs = Date.now() - startedAt
  const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info'

  logger[level](
    {
      status,
      durationMs,
      ...requestLogContext(request, requestId),
    },
    'Request completed'
  )
}

function setRequestId(response, requestId) {
  if (response?.headers?.set) {
    response.headers.set(REQUEST_ID_HEADER, requestId)
  }

  return response
}

export function errorResponse(error, request, requestId) {
  const status = error.status || 500
  const payload = {
    error: error.message || 'Внутренняя ошибка сервера',
  }

  if (error.details) {
    payload.details = error.details
  }

  if (status >= 500) {
    logger.error(
      { err: error, status, ...requestLogContext(request, requestId) },
      'Unhandled route error'
    )
  }

  return NextResponse.json(payload, { status })
}

export function route(handler) {
  return async (...args) => {
    const request = args[0]
    const requestId = request?.headers?.get(REQUEST_ID_HEADER) || randomUUID()
    const startedAt = Date.now()

    try {
      const response = setRequestId(await handler(...args), requestId)
      logRequestCompleted(request, response, startedAt, requestId)
      return response
    } catch (error) {
      const response = setRequestId(errorResponse(error, request, requestId), requestId)
      logRequestCompleted(request, response, startedAt, requestId)
      return response
    }
  }
}

export async function readJson(request) {
  try {
    return await request.json()
  } catch {
    return {}
  }
}
