import { readUpload } from '@/lib/server/uploads'
import { route } from '@/lib/server/response'

export const GET = route(async (_request, context) => {
  const { segments = [] } = await context.params
  const upload = await readUpload(segments)

  return new Response(upload.bytes, {
    headers: {
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Type': upload.contentType,
    },
  })
})
