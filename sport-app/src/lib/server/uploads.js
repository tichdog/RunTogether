import path from 'node:path'
import { randomUUID } from 'node:crypto'
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { env } from './env'
import { badRequest, notFound } from './http-error'
import { logger } from './logger'

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

const s3 = new S3Client({
  endpoint: env.s3Endpoint,
  region: env.s3Region,
  forcePathStyle: env.s3ForcePathStyle,
  credentials: {
    accessKeyId: env.s3AccessKeyId,
    secretAccessKey: env.s3SecretAccessKey,
  },
})

let bucketReadyPromise

async function ensureBucket() {
  bucketReadyPromise ||= (async () => {
    try {
      await s3.send(new HeadBucketCommand({ Bucket: env.s3Bucket }))
    } catch {
      await s3.send(new CreateBucketCommand({ Bucket: env.s3Bucket }))
    }
  })()

  return bucketReadyPromise
}

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

async function bodyToBuffer(body) {
  if (!body) return Buffer.alloc(0)
  if (typeof body.transformToByteArray === 'function') {
    return Buffer.from(await body.transformToByteArray())
  }

  const chunks = []
  for await (const chunk of body) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
}

async function saveImageUploadTo(file, folder) {
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

  await ensureBucket()
  const key = `${folder}/${Date.now()}-${randomUUID()}${extensionFor(file)}`
  await s3.send(
    new PutObjectCommand({
      Bucket: env.s3Bucket,
      Key: key,
      Body: bytes,
      ContentType: file.type,
    })
  )

  return `${env.uploadUrlPath}/${key}`
}

export async function saveImageUpload(file) {
  return saveImageUploadTo(file, 'avatars')
}

export async function saveAchievementIconUpload(file) {
  return saveImageUploadTo(file, 'achievement-icons')
}

function uploadKeyFromUrl(uploadUrl) {
  if (!uploadUrl || typeof uploadUrl !== 'string') return null

  let pathname = uploadUrl
  try {
    pathname = new URL(uploadUrl).pathname
  } catch {
    pathname = uploadUrl
  }

  const prefix = `${env.uploadUrlPath}/`
  if (!pathname.startsWith(prefix)) return null

  const key = pathname.slice(prefix.length)
  if (
    !key ||
    key.includes('..') ||
    path.isAbsolute(key) ||
    (!key.startsWith('avatars/') && !key.startsWith('achievement-icons/'))
  ) {
    return null
  }

  return key
}

export async function deleteImageUpload(uploadUrl) {
  const key = uploadKeyFromUrl(uploadUrl)
  if (!key) return

  try {
    await ensureBucket()
    await s3.send(
      new DeleteObjectCommand({
        Bucket: env.s3Bucket,
        Key: key,
      })
    )
  } catch (error) {
    logger.warn({ err: error, key }, 'Failed to delete image upload')
  }
}

export async function readUpload(segments) {
  const key = segments.join('/')
  if (!key || key.includes('..') || path.isAbsolute(key)) {
    throw notFound()
  }

  try {
    const object = await s3.send(
      new GetObjectCommand({
        Bucket: env.s3Bucket,
        Key: key,
      })
    )

    return {
      bytes: await bodyToBuffer(object.Body),
      contentType: object.ContentType || contentTypeFor(key),
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
