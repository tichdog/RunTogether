import { NextResponse } from 'next/server'

function allowedOrigins() {
  if (process.env.NODE_ENV === 'production' && !process.env.CLIENT_ORIGIN) {
    throw new Error('Missing required environment variable: CLIENT_ORIGIN')
  }

  return (process.env.CLIENT_ORIGIN || 'http://localhost:5173,http://localhost:5174')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
}

function corsHeaders(request) {
  const origin = request.headers.get('origin')
  const headers = new Headers()
  headers.set('Access-Control-Allow-Credentials', 'true')
  headers.set('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS')
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  headers.set('Vary', 'Origin')

  if (origin && allowedOrigins().includes(origin)) {
    headers.set('Access-Control-Allow-Origin', origin)
  }

  return headers
}

export function middleware(request) {
  const headers = corsHeaders(request)

  if (request.method === 'OPTIONS') {
    return new NextResponse(null, { status: 204, headers })
  }

  const response = NextResponse.next()
  headers.forEach((value, key) => response.headers.set(key, value))
  return response
}

export const config = {
  matcher: ['/api/:path*', '/health', '/uploads/:path*'],
}
