import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import { Errors } from './errors.js';

/**
 * Base upload directory: app/backend/uploads
 * __dirname is src/shared (tsx dev) or dist/shared (compiled) — both resolve to app/backend/uploads.
 */
const BASE_DIR = process.env.FILE_STORAGE_ROOT
  ? path.resolve(process.cwd(), process.env.FILE_STORAGE_ROOT)
  : path.resolve(__dirname, '..', '..', 'uploads');

export function getBaseDir(): string {
  return BASE_DIR;
}

/** Ensure the uploads directory (or a sub-directory of it) exists. Returns the absolute dir path. */
export function ensureUploadDir(subDir?: string): string {
  const dir = subDir ? path.join(BASE_DIR, subDir) : BASE_DIR;
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Generate a cuid-like unique id.
 * Needed when the id must be known BEFORE inserting (e.g. FileAsset id is part of the storageKey).
 */
export function generateCuid(): string {
  return 'c' + Date.now().toString(36) + randomBytes(10).toString('hex');
}

function sanitizeFileName(name: string): string {
  const base = (name ?? '').replace(/[\\/]/g, '_').trim() || 'file';
  return base.slice(0, 120);
}

/** Build a storage key in the format yyyy/MM/<cuid>-<originalName> */
export function buildStorageKey(originalName: string, now: Date = new Date()): string {
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  return `${yyyy}/${mm}/${generateCuid()}-${sanitizeFileName(originalName)}`;
}

/** Resolve a storageKey to an absolute path under BASE_DIR (rejects path traversal). */
export function getStoragePath(storageKey: string): string {
  const full = path.resolve(BASE_DIR, storageKey);
  if (full !== BASE_DIR && !full.startsWith(BASE_DIR + path.sep)) {
    throw Errors.badRequest('INVALID_STORAGE_KEY', 'Storage key không hợp lệ');
  }
  return full;
}

/** Write a buffer to disk at the given storageKey. Creates parent directories as needed. */
export function saveBufferToFile(buffer: Buffer, storageKey: string): string {
  const fullPath = getStoragePath(storageKey);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, buffer);
  return fullPath;
}

/** Delete a file by storageKey. Ignores ENOENT; best-effort removes the emptied yyyy/MM dir. */
export function deleteFile(storageKey: string): void {
  const fullPath = getStoragePath(storageKey);
  try {
    fs.unlinkSync(fullPath);
  } catch (e: any) {
    if (e?.code === 'ENOENT') return;
    throw e;
  }
  try {
    const dir = path.dirname(fullPath);
    if (dir !== BASE_DIR && fs.readdirSync(dir).length === 0) {
      fs.rmdirSync(dir);
    }
  } catch {
    // best effort only
  }
}

/** Return a read stream for the file at storageKey. */
export function streamFile(storageKey: string): fs.ReadStream {
  return fs.createReadStream(getStoragePath(storageKey));
}

/** Check whether a file exists on disk for the given storageKey. */
export function fileExists(storageKey: string): boolean {
  try {
    return fs.statSync(getStoragePath(storageKey)).isFile();
  } catch {
    return false;
  }
}

export function sha256Of(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

/**
 * Sniff the MIME type from magic bytes. Returns null when unrecognized.
 * Note: OLE compound files are reported as application/msword (legacy .doc;
 * could also be .xls — callers only allow .doc in this app).
 */
export function sniffMimeType(buf: Buffer): string | null {
  if (!buf || buf.length < 4) return null;

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
  ) {
    return 'image/png';
  }
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return 'image/jpeg';
  }
  // GIF
  if (buf.length >= 6) {
    const head6 = buf.subarray(0, 6).toString('ascii');
    if (head6 === 'GIF87a' || head6 === 'GIF89a') return 'image/gif';
  }
  // PDF: %PDF-
  if (buf.length >= 5 && buf.subarray(0, 5).toString('ascii') === '%PDF-') {
    return 'application/pdf';
  }
  // OLE compound document (legacy Office .doc): D0 CF 11 E0 A1 B1 1A E1
  if (
    buf.length >= 8 &&
    buf[0] === 0xd0 && buf[1] === 0xcf && buf[2] === 0x11 && buf[3] === 0xe0 &&
    buf[4] === 0xa1 && buf[5] === 0xb1 && buf[6] === 0x1a && buf[7] === 0xe1
  ) {
    return 'application/msword';
  }
  // ZIP container (.docx and other OOXML): PK\x03\x04 | PK\x05\x06 | PK\x07\x08
  if (buf[0] === 0x50 && buf[1] === 0x4b && (buf[2] === 0x03 || buf[2] === 0x05 || buf[2] === 0x07) && buf[3] === 0x0a) {
    return 'application/zip';
  }
  return null;
}

/** ZIP-based MIME types that are accepted when magic bytes detect a ZIP container. */
const ZIP_BASED_MIMES = new Set<string>([
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

/**
 * Validate buffer magic bytes against an allowed MIME list.
 * Throws AppError 400 INVALID_FILE_TYPE on mismatch.
 */
export function assertFileMagic(buffer: Buffer, allowedMimes: string[]): void {
  const detected = sniffMimeType(buffer);
  if (!detected) {
    throw Errors.badRequest('INVALID_FILE_TYPE', 'Không nhận diện được loại tệp');
  }
  if (allowedMimes.includes(detected)) return;
  if (detected === 'application/zip' && allowedMimes.some((m) => ZIP_BASED_MIMES.has(m))) return;
  throw Errors.badRequest('INVALID_FILE_TYPE', 'Loại tệp không hợp lệ');
}
