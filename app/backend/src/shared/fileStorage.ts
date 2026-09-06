import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Errors } from './errors.js';
import { config } from '../config.js';

/**
 * Base upload directory: app/backend/uploads
 * Backend npm scripts run with app/backend as process.cwd(), in both dev and production.
 */
const BASE_DIR = path.resolve(process.cwd(), config.FILE_STORAGE_ROOT);

export function getBaseDir(): string {
  return BASE_DIR;
}

/** Ensure the uploads directory (or a sub-directory of it) exists. Returns the absolute dir path. */
export async function ensureUploadDir(subDir?: string): Promise<string> {
  const dir = subDir ? path.join(BASE_DIR, subDir) : BASE_DIR;
  await fsPromises.mkdir(dir, { recursive: true });
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

let activeDriverOverride: 'local' | 'supabase' | null = null;
let customSupabaseClient: SupabaseClient | any | null = null;

export function setStorageDriverForTest(driver: 'local' | 'supabase' | null): void {
  activeDriverOverride = driver;
}

export function setSupabaseClientForTest(client: SupabaseClient | any | null): void {
  customSupabaseClient = client;
}

export function getStorageDriver(): 'local' | 'supabase' {
  return activeDriverOverride ?? config.STORAGE_DRIVER;
}

export function getSupabaseClient(): SupabaseClient {
  if (customSupabaseClient) {
    return customSupabaseClient;
  }
  if (!config.SUPABASE_URL || !config.SUPABASE_SERVICE_ROLE_KEY) {
    throw Errors.internal('Supabase configuration (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY) is required');
  }
  return createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

/** Write a buffer asynchronously at the given storageKey (local disk or Supabase Storage). */
export async function saveBufferToFile(buffer: Buffer, storageKey: string): Promise<string> {
  const driver = getStorageDriver();
  if (driver === 'supabase') {
    const client = getSupabaseClient();
    const contentType = sniffMimeType(buffer) ?? 'application/octet-stream';
    const { error } = await client.storage
      .from(config.SUPABASE_STORAGE_BUCKET)
      .upload(storageKey, buffer, {
        contentType,
        upsert: true,
      });
    if (error) {
      throw Errors.internal(`Supabase upload failed: ${error.message}`);
    }
    return storageKey;
  }

  const fullPath = getStoragePath(storageKey);
  await fsPromises.mkdir(path.dirname(fullPath), { recursive: true });
  await fsPromises.writeFile(fullPath, buffer);
  return fullPath;
}

/** Delete a file by storageKey asynchronously (local disk or Supabase Storage). */
export async function deleteFile(storageKey: string): Promise<void> {
  const driver = getStorageDriver();
  if (driver === 'supabase') {
    const client = getSupabaseClient();
    const { error } = await client.storage
      .from(config.SUPABASE_STORAGE_BUCKET)
      .remove([storageKey]);
    if (error) {
      throw Errors.internal(`Supabase delete failed: ${error.message}`);
    }
    return;
  }

  const fullPath = getStoragePath(storageKey);
  try {
    await fsPromises.unlink(fullPath);
  } catch (e: any) {
    if (e?.code === 'ENOENT') return;
    throw e;
  }
  try {
    const dir = path.dirname(fullPath);
    if (dir !== BASE_DIR) {
      const remaining = await fsPromises.readdir(dir);
      if (remaining.length === 0) {
        await fsPromises.rmdir(dir);
      }
    }
  } catch {
    // best effort only
  }
}

/** Check whether a file exists for the given storageKey (local disk or Supabase Storage). */
export async function fileExists(storageKey: string): Promise<boolean> {
  const driver = getStorageDriver();
  if (driver === 'supabase') {
    const client = getSupabaseClient();
    const lastSlash = storageKey.lastIndexOf('/');
    const folder = lastSlash >= 0 ? storageKey.slice(0, lastSlash) : '';
    const fileName = lastSlash >= 0 ? storageKey.slice(lastSlash + 1) : storageKey;
    const { data, error } = await client.storage
      .from(config.SUPABASE_STORAGE_BUCKET)
      .list(folder, {
        search: fileName,
        limit: 100,
      });
    if (error || !data) return false;
    return data.some((item: any) => item.name === fileName);
  }

  try {
    const stat = await fsPromises.stat(getStoragePath(storageKey));
    return stat.isFile();
  } catch {
    return false;
  }
}

/** Download the file buffer by storageKey asynchronously (local disk or Supabase Storage). */
export async function downloadFile(storageKey: string): Promise<Buffer> {
  const driver = getStorageDriver();
  if (driver === 'supabase') {
    const client = getSupabaseClient();
    const { data, error } = await client.storage
      .from(config.SUPABASE_STORAGE_BUCKET)
      .download(storageKey);
    if (error || !data) {
      throw Errors.notFound('Tệp không tồn tại trên hệ thống lưu trữ');
    }
    const arrayBuffer = await data.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  const fullPath = getStoragePath(storageKey);
  try {
    return await fsPromises.readFile(fullPath);
  } catch (e: any) {
    if (e?.code === 'ENOENT') {
      throw Errors.notFound('Tệp không tồn tại trên hệ thống lưu trữ');
    }
    throw e;
  }
}

/** Return a read stream for the file at storageKey. Deprecated: use downloadFile instead. */
export function streamFile(storageKey: string): fs.ReadStream {
  return fs.createReadStream(getStoragePath(storageKey));
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
