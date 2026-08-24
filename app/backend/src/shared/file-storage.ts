import { createHash, randomBytes } from 'node:crypto';
import { constants } from 'node:fs';
import { access, mkdir, open, rename, rm, stat } from 'node:fs/promises';
import { basename, extname, resolve, sep } from 'node:path';
import type { FileCategory } from '@prisma/client';
import { config } from '../config.js';
import { ApiError } from './api-error.js';

export interface FileStorageLimits {
  imageMaxBytes: number;
  cvMaxBytes: number;
}

export interface StageFileInput {
  category: FileCategory;
  originalName: string;
  mimeType: string;
  buffer: Buffer;
}

export interface StagedFile {
  category: FileCategory;
  storageKey: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
}

export interface OpenedFile {
  path: string;
  sizeBytes: number;
}

const defaultLimits: FileStorageLimits = {
  imageMaxBytes: config.FILE_IMAGE_MAX_BYTES,
  cvMaxBytes: config.FILE_CV_MAX_BYTES,
};

type FileKind = 'jpg' | 'png' | 'webp' | 'pdf' | 'doc' | 'docx';

const kindRules: Record<FileKind, { extensions: string[]; mimeTypes: string[] }> = {
  jpg: { extensions: ['.jpg', '.jpeg'], mimeTypes: ['image/jpeg'] },
  png: { extensions: ['.png'], mimeTypes: ['image/png'] },
  webp: { extensions: ['.webp'], mimeTypes: ['image/webp'] },
  pdf: { extensions: ['.pdf'], mimeTypes: ['application/pdf'] },
  doc: { extensions: ['.doc'], mimeTypes: ['application/msword'] },
  docx: {
    extensions: ['.docx'],
    mimeTypes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  },
};

export class FileStorage {
  private readonly root: string;
  private readonly limits: FileStorageLimits;

  constructor(root = config.FILE_STORAGE_ROOT, limits: Partial<FileStorageLimits> = {}) {
    this.root = resolve(root);
    this.limits = { ...defaultLimits, ...limits };
  }

  async stage(input: StageFileInput): Promise<StagedFile> {
    const sizeLimit = input.category === 'CV' ? this.limits.cvMaxBytes : this.limits.imageMaxBytes;
    if (input.buffer.length > sizeLimit) {
      throw new ApiError(413, 'FILE_TOO_LARGE', 'The uploaded file exceeds the configured byte limit.');
    }

    const kind = detectKind(input.buffer);
    const allowedKinds = input.category === 'CV'
      ? new Set<FileKind>(['pdf', 'doc', 'docx'])
      : new Set<FileKind>(['jpg', 'png', 'webp']);
    const extension = extname(input.originalName).toLowerCase();
    const rule = kind ? kindRules[kind] : undefined;
    if (
      !kind
      || !allowedKinds.has(kind)
      || !rule?.extensions.includes(extension)
      || !rule.mimeTypes.includes(input.mimeType.toLowerCase())
    ) {
      throw new ApiError(415, 'UNSUPPORTED_FILE_TYPE', 'The uploaded file type is not supported.');
    }

    const storageKey = `${randomBytes(24).toString('hex')}${extension}`;
    const stagingPath = this.pathFor('staging', storageKey);
    await mkdir(resolve(this.root, 'staging'), { recursive: true });
    const handle = await open(stagingPath, 'wx', 0o600);
    try {
      await handle.writeFile(input.buffer);
    } finally {
      await handle.close();
    }

    return {
      category: input.category,
      storageKey,
      originalName: basename(input.originalName).slice(0, 255),
      mimeType: input.mimeType.toLowerCase(),
      sizeBytes: input.buffer.length,
      sha256: createHash('sha256').update(input.buffer).digest('hex'),
    };
  }

  async finalize(file: StagedFile): Promise<void> {
    await mkdir(resolve(this.root, 'active'), { recursive: true });
    await rename(this.pathFor('staging', file.storageKey), this.pathFor('active', file.storageKey));
  }

  async open(storageKey: string): Promise<OpenedFile> {
    const path = this.pathFor('active', storageKey);
    try {
      await access(path, constants.R_OK);
      const metadata = await stat(path);
      return { path, sizeBytes: metadata.size };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(404, 'FILE_NOT_FOUND', 'The requested file does not exist.');
    }
  }

  async remove(storageKey: string): Promise<void> {
    await rm(this.pathFor('active', storageKey), { force: true });
  }

  async discard(file: StagedFile): Promise<void> {
    await rm(this.pathFor('staging', file.storageKey), { force: true });
  }

  async quarantine(file: StagedFile): Promise<void> {
    const quarantineRoot = resolve(this.root, 'quarantine');
    await mkdir(quarantineRoot, { recursive: true });
    const destination = this.pathFor('quarantine', file.storageKey);
    for (const area of ['staging', 'active'] as const) {
      try {
        await rename(this.pathFor(area, file.storageKey), destination);
        return;
      } catch (error) {
        if (!isMissingFile(error)) throw error;
      }
    }
  }

  private pathFor(area: 'staging' | 'active' | 'quarantine', storageKey: string): string {
    if (!/^[a-f0-9]{48}\.[a-z0-9]+$/.test(storageKey)) {
      throw new ApiError(400, 'INVALID_STORAGE_KEY', 'The storage key is invalid.');
    }
    const areaRoot = resolve(this.root, area);
    const candidate = resolve(areaRoot, storageKey);
    if (!candidate.startsWith(`${areaRoot}${sep}`)) {
      throw new ApiError(400, 'INVALID_STORAGE_KEY', 'The storage key is invalid.');
    }
    return candidate;
  }
}

function detectKind(buffer: Buffer): FileKind | undefined {
  if (startsWith(buffer, [0xff, 0xd8, 0xff])) return 'jpg';
  if (startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF'
    && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return 'webp';
  if (buffer.subarray(0, 5).toString('ascii') === '%PDF-') return 'pdf';
  if (startsWith(buffer, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) return 'doc';
  if (startsWith(buffer, [0x50, 0x4b, 0x03, 0x04])) return 'docx';
  return undefined;
}

function startsWith(buffer: Buffer, signature: number[]): boolean {
  return buffer.length >= signature.length && signature.every((byte, index) => buffer[index] === byte);
}

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}
