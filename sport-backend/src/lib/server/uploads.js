import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { env } from "./env";
import { uploadDir } from "./upload-env";
import { badRequest, notFound } from "./http-error";

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"]);

function extensionFor(file) {
  const ext = path.extname(file.name || "").toLowerCase();
  if (/^\.[a-z0-9]{1,8}$/.test(ext)) return ext;

  const fallback = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "image/svg+xml": ".svg",
  };
  return fallback[file.type] || "";
}

export async function saveImageUpload(file) {
  if (!file || typeof file.arrayBuffer !== "function") {
    throw badRequest("Файл не передан");
  }
  if (!IMAGE_TYPES.has(file.type)) {
    throw badRequest("Можно загружать только изображения");
  }
  if (file.size > env.maxUploadBytes) {
    throw badRequest("Файл слишком большой");
  }

  const root = uploadDir();
  await fs.mkdir(root, { recursive: true });
  const filename = `${Date.now()}-${randomUUID()}${extensionFor(file)}`;
  const filepath = path.join(root, filename);
  const bytes = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(filepath, bytes);

  return `${env.uploadUrlPath}/${filename}`;
}

export async function readUpload(segments) {
  const filename = segments.join("/");
  const root = path.resolve(uploadDir());
  const filepath = path.resolve(root, filename);

  if (!filepath.startsWith(`${root}${path.sep}`)) {
    throw notFound();
  }

  try {
    return {
      bytes: await fs.readFile(filepath),
      contentType: contentTypeFor(filepath),
    };
  } catch {
    throw notFound();
  }
}

function contentTypeFor(filepath) {
  const ext = path.extname(filepath).toLowerCase();
  return {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
  }[ext] || "application/octet-stream";
}
