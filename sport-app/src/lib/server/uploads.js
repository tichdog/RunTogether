import fs from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { env } from './env'
import { uploadDir } from './upload-env'
import { badRequest, notFound } from './http-error'

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

function extensionFor(file) {
  const ext = path.extname(file.name || '').toLowerCase()
  const allowedExtensions = {
    'image/jpeg': new Set(['.jpg', '.jpeg']),
    'image/png': new Set(['.png']),
    'image/webp': new Set(['.webp']),
    'image/gif': new Set(['.gif']),
  }
  if (allowedExtensions[file.type]?.has(ext)) return ext

  const fallback = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
  }
  return fallback[file.type] || ''
}

function detectedImageType(bytes) {
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg'
  }

  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png'
  }

  if (
    bytes.length >= 6 &&
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38 &&
    (bytes[4] === 0x37 || bytes[4] === 0x39) &&
    bytes[5] === 0x61
  ) {
    return 'image/gif'
  }

  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp'
  }

  return null
}

export async function saveImageUpload(file) {
  if (!file || typeof file.arrayBuffer !== 'function') {
    throw badRequest('Файл не передан')
  }
  if (!IMAGE_TYPES.has(file.type)) {
    throw badRequest('Можно загружать только JPEG, PNG, WebP и GIF')
  }
  if (file.size > env.maxUploadBytes) {
    throw badRequest('Файл слишком большой')
  }

  const bytes = Buffer.from(await file.arrayBuffer())
  if (detectedImageType(bytes) !== file.type) {
    throw badRequest('Содержимое файла не похоже на разрешенное изображение')
  }

  const root = uploadDir()
  await fs.mkdir(root, { recursive: true })
  const filename = `${Date.now()}-${randomUUID()}${extensionFor(file)}`
  const filepath = path.join(root, filename)
  await fs.writeFile(filepath, bytes)

  return `${env.uploadUrlPath}/${filename}`
}

export async function readUpload(segments) {
  const filename = segments.join('/')
  const root = path.resolve(uploadDir())
  const filepath = path.resolve(root, filename)

  if (!filepath.startsWith(`${root}${path.sep}`)) {
    throw notFound()
  }

  try {
    return {
      bytes: await fs.readFile(filepath),
      contentType: contentTypeFor(filepath),
    }
  } catch {
    throw notFound()
  }
}

function contentTypeFor(filepath) {
  const ext = path.extname(filepath).toLowerCase()
  return (
    {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.gif': 'image/gif',
    }[ext] || 'application/octet-stream'
  )
}
