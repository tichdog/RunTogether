import { NextResponse } from 'next/server'

export function json(payload, status = 200) {
  return NextResponse.json(payload, { status })
}

export function noContent() {
  return new NextResponse(null, { status: 204 })
}

export function errorResponse(error) {
  const status = error.status || 500
  const payload = {
    error: error.message || 'Внутренняя ошибка сервера',
  }

  if (error.details) {
    payload.details = error.details
  }

  if (status >= 500) {
    console.error(error)
  }

  return NextResponse.json(payload, { status })
}

export function route(handler) {
  return async (...args) => {
    try {
      return await handler(...args)
    } catch (error) {
      return errorResponse(error)
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
