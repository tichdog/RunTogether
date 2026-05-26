import path from 'node:path'

export function uploadDir() {
  if (!process.env.UPLOAD_DIR) {
    return path.join(process.cwd(), 'public', 'uploads')
  }

  if (path.isAbsolute(process.env.UPLOAD_DIR)) {
    return process.env.UPLOAD_DIR
  }

  return path.join(/* turbopackIgnore: true */ process.cwd(), process.env.UPLOAD_DIR)
}
