import { json } from '@/lib/server/response'

export function GET() {
  return json({ ok: true })
}
