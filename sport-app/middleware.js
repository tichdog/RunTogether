import { NextResponse } from 'next/server'

function configuredOrigins() {
  return (process.env.CLIENT_ORIGIN || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
}

function requestOrigin(request) {
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host')
  if (!host) return null

  const protocol =
    request.headers.get('x-forwarded-proto') ||
    (host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https')

  return `${protocol}://${host}`
}

function corsHeaders(request) {
  const origin = request.headers.get('origin')
  const allowedOrigins = new Set([...configuredOrigins(), requestOrigin(request)].filter(Boolean))
  const headers = new Headers()
  headers.set('Access-Control-Allow-Credentials', 'true')
  headers.set('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS')
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  headers.set('Vary', 'Origin')

  if (origin && allowedOrigins.has(origin)) {
    headers.set('Access-Control-Allow-Origin', origin)
  }

  return headers
}

function uploadSecurityHeaders(headers) {
  headers.set('X-Content-Type-Options', 'nosniff')
  headers.set('Content-Security-Policy', "default-src 'none'; img-src 'self' data:; sandbox")
  return headers
}

export function middleware(request) {
  const headers = corsHeaders(request)
  const pathname = request.nextUrl?.pathname || new URL(request.url).pathname
  const isUpload = pathname.startsWith('/uploads/')

  if (isUpload) {
    uploadSecurityHeaders(headers)

    if (pathname.toLowerCase().endsWith('.svg')) {
      return new NextResponse(null, { status: 404, headers })
    }
  }

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
