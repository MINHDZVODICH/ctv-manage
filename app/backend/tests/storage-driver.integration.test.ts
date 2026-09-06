import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/shared/prisma.js';
import { envSchema } from '../src/config.js';
import {
  saveBufferToFile,
  deleteFile,
  fileExists,
  downloadFile,
  getStoragePath,
  generateCuid,
  buildStorageKey,
  sha256Of,
  sniffMimeType,
  assertFileMagic,
  setStorageDriverForTest,
  setSupabaseClientForTest,
} from '../src/shared/fileStorage.js';
import * as filesService from '../src/modules/files/files.service.js';
import { loginCookie, resetDatabase, seedActors, validPng, validPdf } from './helpers.js';

const validJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const app = createApp();

function createMockSupabaseClient() {
  const store = new Map<string, { buffer: Buffer; contentType?: string }>();
  let failNextUpload = false;
  let failNextRemove = false;

  return {
    _store: store,
    setFailNextUpload: (fail: boolean) => {
      failNextUpload = fail;
    },
    setFailNextRemove: (fail: boolean) => {
      failNextRemove = fail;
    },
    storage: {
      from: (_bucket: string) => ({
        upload: async (path: string, buffer: Buffer, options?: { contentType?: string; upsert?: boolean }) => {
          if (failNextUpload) {
            failNextUpload = false;
            return { data: null, error: new Error('Simulated Supabase storage upload error') };
          }
          store.set(path, { buffer, contentType: options?.contentType });
          return { data: { path }, error: null };
        },
        download: async (path: string) => {
          const item = store.get(path);
          if (!item) {
            return { data: null, error: new Error('Object not found') };
          }
          return {
            data: {
              arrayBuffer: async () =>
                item.buffer.buffer.slice(
                  item.buffer.byteOffset,
                  item.buffer.byteOffset + item.buffer.byteLength,
                ),
            },
            error: null,
          };
        },
        remove: async (paths: string[]) => {
          if (failNextRemove) {
            failNextRemove = false;
            return { data: null, error: new Error('Simulated Supabase storage remove error') };
          }
          for (const p of paths) {
            store.delete(p);
          }
          return { data: paths, error: null };
        },
        list: async (folder: string, options?: { search?: string }) => {
          const results: { name: string; id: string }[] = [];
          const prefix = folder ? `${folder}/` : '';
          for (const [key] of store) {
            if (key.startsWith(prefix)) {
              const remaining = key.slice(prefix.length);
              const slashIdx = remaining.indexOf('/');
              const name = slashIdx >= 0 ? remaining.slice(0, slashIdx) : remaining;
              if (!options?.search || name.includes(options.search)) {
                if (!results.some((r) => r.name === name)) {
                  results.push({ name, id: name });
                }
              }
            }
          }
          return { data: results, error: null };
        },
      }),
    },
  };
}

describe('Storage Configuration and Drivers (A3, A4, A12)', () => {
  afterAll(async () => {
    setStorageDriverForTest(null);
    setSupabaseClientForTest(null);
    await prisma.$disconnect();
  });

  describe('Config Schema Validation (A3)', () => {
    it('defaults STORAGE_DRIVER to local with valid defaults', () => {
      const parsed = envSchema.safeParse({});
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.STORAGE_DRIVER).toBe('local');
        expect(parsed.data.FILE_STORAGE_ROOT).toBe('uploads');
        expect(parsed.data.SUPABASE_STORAGE_BUCKET).toBe('ctv-files');
      }
    });

    it('fails validation when STORAGE_DRIVER is supabase but SUPABASE_URL is missing', () => {
      const parsed = envSchema.safeParse({
        STORAGE_DRIVER: 'supabase',
        SUPABASE_SERVICE_ROLE_KEY: 'test-key',
        SUPABASE_STORAGE_BUCKET: 'ctv-files',
      });
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        const issues = parsed.error.issues.map((i) => i.path.join('.'));
        expect(issues).toContain('SUPABASE_URL');
      }
    });

    it('fails validation when STORAGE_DRIVER is supabase but SUPABASE_SERVICE_ROLE_KEY is missing', () => {
      const parsed = envSchema.safeParse({
        STORAGE_DRIVER: 'supabase',
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_STORAGE_BUCKET: 'ctv-files',
      });
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        const issues = parsed.error.issues.map((i) => i.path.join('.'));
        expect(issues).toContain('SUPABASE_SERVICE_ROLE_KEY');
      }
    });

    it('fails validation when STORAGE_DRIVER is supabase but SUPABASE_STORAGE_BUCKET is empty', () => {
      const parsed = envSchema.safeParse({
        STORAGE_DRIVER: 'supabase',
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'test-key',
        SUPABASE_STORAGE_BUCKET: '',
      });
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        const issues = parsed.error.issues.map((i) => i.path.join('.'));
        expect(issues).toContain('SUPABASE_STORAGE_BUCKET');
      }
    });

    it('succeeds validation when STORAGE_DRIVER is supabase and all required fields are present', () => {
      const parsed = envSchema.safeParse({
        STORAGE_DRIVER: 'supabase',
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
        SUPABASE_STORAGE_BUCKET: 'ctv-files',
      });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.STORAGE_DRIVER).toBe('supabase');
        expect(parsed.data.SUPABASE_URL).toBe('https://example.supabase.co');
        expect(parsed.data.SUPABASE_SERVICE_ROLE_KEY).toBe('test-service-role-key');
        expect(parsed.data.SUPABASE_STORAGE_BUCKET).toBe('ctv-files');
      }
    });
  });

  describe('Storage Helpers Integrity (A4)', () => {
    it('generates unique cuid-like identifiers', () => {
      const id1 = generateCuid();
      const id2 = generateCuid();
      expect(id1).toMatch(/^c[0-9a-z]+$/);
      expect(id2).toMatch(/^c[0-9a-z]+$/);
      expect(id1).not.toBe(id2);
    });

    it('builds structured storage keys in yyyy/MM format', () => {
      const key = buildStorageKey('test-file.pdf', new Date('2026-09-06T00:00:00Z'));
      expect(key).toMatch(/^2026\/09\/c[0-9a-z]+-test-file\.pdf$/);
    });

    it('computes sha256 checksum correctly', () => {
      const buf = Buffer.from('test sha256', 'utf-8');
      expect(sha256Of(buf)).toBe('c71d137da140c5afefd7db8e7a255df45c2ac46064e934416dc04020a91f3fd2');
    });

    it('sniffs mime types correctly', () => {
      const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      expect(sniffMimeType(pngHeader)).toBe('image/png');

      const jpegHeader = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
      expect(sniffMimeType(jpegHeader)).toBe('image/jpeg');

      const pdfHeader = Buffer.from('%PDF-1.4');
      expect(sniffMimeType(pdfHeader)).toBe('application/pdf');
    });

    it('validates file magic bytes and throws on mismatch', () => {
      const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      expect(() => assertFileMagic(pngHeader, ['image/png'])).not.toThrow();
      expect(() => assertFileMagic(pngHeader, ['application/pdf'])).toThrow();
    });

    it('rejects path traversal in local storage keys', () => {
      expect(() => getStoragePath('../../etc/passwd')).toThrow();
    });
  });

  describe('Direct Driver Unit Operations (A4)', () => {
    it('operates local driver: save, exists, download, delete', async () => {
      setStorageDriverForTest('local');
      const testKey = 'test/local/unit-sample.txt';
      const testBuffer = Buffer.from('hello local driver direct', 'utf-8');

      await saveBufferToFile(testBuffer, testKey);
      expect(await fileExists(testKey)).toBe(true);

      const downloaded = await downloadFile(testKey);
      expect(downloaded).toEqual(testBuffer);

      await deleteFile(testKey);
      expect(await fileExists(testKey)).toBe(false);
      await expect(downloadFile(testKey)).rejects.toThrow();
    });

    it('operates supabase driver (mocked): save, exists, download, delete, error handling', async () => {
      const mockSupabase = createMockSupabaseClient();
      setStorageDriverForTest('supabase');
      setSupabaseClientForTest(mockSupabase);

      const testKey = '2026/09/sample-supabase.txt';
      const testBuffer = Buffer.from('hello supabase driver direct', 'utf-8');

      await saveBufferToFile(testBuffer, testKey);
      expect(await fileExists(testKey)).toBe(true);
      expect(mockSupabase._store.has(testKey)).toBe(true);

      const downloaded = await downloadFile(testKey);
      expect(downloaded).toEqual(testBuffer);

      await deleteFile(testKey);
      expect(await fileExists(testKey)).toBe(false);
      expect(mockSupabase._store.has(testKey)).toBe(false);
      await expect(downloadFile(testKey)).rejects.toThrow();

      // Error handling
      mockSupabase.setFailNextUpload(true);
      await expect(saveBufferToFile(testBuffer, testKey)).rejects.toThrow('Supabase upload failed');

      mockSupabase.setFailNextRemove(true);
      await expect(deleteFile(testKey)).rejects.toThrow('Supabase delete failed');
    });
  });

  // Parameterized integration suite testing both drivers against full workflows (A12)
  for (const driver of ['local', 'supabase'] as const) {
    describe(`End-to-End File Workflows with STORAGE_DRIVER=${driver} (A12)`, () => {
      let mockSupabase: ReturnType<typeof createMockSupabaseClient>;

      beforeEach(async () => {
        await resetDatabase();
        await seedActors();

        if (driver === 'supabase') {
          mockSupabase = createMockSupabaseClient();
          setStorageDriverForTest('supabase');
          setSupabaseClientForTest(mockSupabase);
        } else {
          setStorageDriverForTest('local');
          setSupabaseClientForTest(null);
        }
      });

      it('uploads AVATAR, verifies persistence, downloads as owner and ADMIN, denies other CTV', async () => {
        const ownerCookie = await loginCookie(app, 'ctv.active@ctv.local');
        const adminCookie = await loginCookie(app, 'admin.acceptance@ctv.local');
        const otherCookie = await loginCookie(app, 'ctv.other@ctv.local');

        const uploadRes = await request(app)
          .put('/api/v1/users/me/files/AVATAR')
          .set('Cookie', ownerCookie)
          .attach('file', validPng, { filename: 'avatar.png', contentType: 'image/png' });

        if (uploadRes.status !== 201) {
          throw new Error(`Upload failed for driver ${driver}: status=${uploadRes.status} body=${JSON.stringify(uploadRes.body)}`);
        }
        expect(uploadRes.status).toBe(201);
        const { fileId, originalName, mimeType, sizeBytes } = uploadRes.body.file;
        expect(originalName).toBe('avatar.png');
        expect(mimeType).toBe('image/png');
        expect(sizeBytes).toBe(validPng.length);

        // Database metadata persists
        const asset = await prisma.fileAsset.findUnique({ where: { id: fileId } });
        expect(asset).not.toBeNull();
        expect(asset?.storageKey).toBeDefined();
        expect(asset?.originalName).toBe('avatar.png');
        expect(asset?.mimeType).toBe('image/png');
        expect(asset?.sizeBytes).toBe(validPng.length);
        expect(asset?.sha256).toBe(sha256Of(validPng));

        // Download owned file
        const ownerDl = await request(app)
          .get(`/api/v1/files/${fileId}/content`)
          .set('Cookie', ownerCookie);
        expect(ownerDl.status).toBe(200);
        expect(ownerDl.header['content-type']).toBe('image/png');
        expect(ownerDl.header['content-length']).toBe(String(validPng.length));
        expect(ownerDl.header['content-disposition']).toContain('avatar.png');
        expect(Buffer.compare(ownerDl.body, validPng)).toBe(0);

        // Download authorized file (ADMIN)
        const adminDl = await request(app)
          .get(`/api/v1/files/${fileId}/content`)
          .set('Cookie', adminCookie);
        expect(adminDl.status).toBe(200);
        expect(Buffer.compare(adminDl.body, validPng)).toBe(0);

        // Reject unauthorized download (other CTV)
        const otherDl = await request(app)
          .get(`/api/v1/files/${fileId}/content`)
          .set('Cookie', otherCookie);
        expect(otherDl.status).toBe(403);
      });

      it('uploads CCCD front (JPEG) and CCCD back (JPEG) successfully', async () => {
        const ownerCookie = await loginCookie(app, 'ctv.active@ctv.local');

        // CCCD FRONT
        const frontRes = await request(app)
          .put('/api/v1/users/me/files/CCCD_FRONT')
          .set('Cookie', ownerCookie)
          .attach('file', validJpeg, { filename: 'cccd_front.jpg', contentType: 'image/jpeg' });
        expect(frontRes.status).toBe(201);
        expect(frontRes.body.file.category).toBe('CCCD_FRONT');

        // CCCD BACK
        const backRes = await request(app)
          .put('/api/v1/users/me/files/CCCD_BACK')
          .set('Cookie', ownerCookie)
          .attach('file', validJpeg, { filename: 'cccd_back.jpg', contentType: 'image/jpeg' });
        expect(backRes.status).toBe(201);
        expect(backRes.body.file.category).toBe('CCCD_BACK');
      });

      it('uploads CV (PDF) and downloads it with proper content headers', async () => {
        const ownerCookie = await loginCookie(app, 'ctv.active@ctv.local');

        const cvRes = await request(app)
          .put('/api/v1/users/me/files/CV')
          .set('Cookie', ownerCookie)
          .attach('file', validPdf, { filename: 'resume.pdf', contentType: 'application/pdf' });
        expect(cvRes.status).toBe(201);
        const fileId = cvRes.body.file.fileId;

        const dlRes = await request(app)
          .get(`/api/v1/files/${fileId}/content`)
          .set('Cookie', ownerCookie);
        expect(dlRes.status).toBe(200);
        expect(dlRes.header['content-type']).toBe('application/pdf');
        expect(dlRes.header['content-disposition']).toContain('resume.pdf');
        expect(Buffer.compare(dlRes.body, validPdf)).toBe(0);
      });

      it('rejects upload with invalid MIME or spoofed file magic', async () => {
        const ownerCookie = await loginCookie(app, 'ctv.active@ctv.local');

        // Fake image (magic bytes mismatch)
        const fakeImageRes = await request(app)
          .put('/api/v1/users/me/files/AVATAR')
          .set('Cookie', ownerCookie)
          .attach('file', Buffer.from('plain text pretend png'), { filename: 'fake.png', contentType: 'image/png' });
        expect(fakeImageRes.status).toBe(400);
        expect(fakeImageRes.body.error.code).toBe('INVALID_FILE_TYPE');

        // Disallowed category MIME (e.g. text/plain for CV)
        const badMimeRes = await request(app)
          .put('/api/v1/users/me/files/CV')
          .set('Cookie', ownerCookie)
          .attach('file', Buffer.from('hello plain'), { filename: 'cv.txt', contentType: 'text/plain' });
        expect(badMimeRes.status).toBe(400);
      });

      it('deletes file cleanly and prevents subsequent downloads', async () => {
        const ownerCookie = await loginCookie(app, 'ctv.active@ctv.local');

        const uploadRes = await request(app)
          .put('/api/v1/users/me/files/AVATAR')
          .set('Cookie', ownerCookie)
          .attach('file', validPng, { filename: 'avatar.png', contentType: 'image/png' });
        const fileId = uploadRes.body.file.fileId;

        const deleteRes = await request(app)
          .delete('/api/v1/users/me/files/AVATAR')
          .set('Cookie', ownerCookie);
        expect(deleteRes.status).toBe(204);

        // Download after deletion returns 403 (unattached/deleted link)
        const downloadRes = await request(app)
          .get(`/api/v1/files/${fileId}/content`)
          .set('Cookie', ownerCookie);
        expect(downloadRes.status).toBe(403);
      });

      it('returns 404 when storage object is missing for an active fileAsset', async () => {
        const ownerCookie = await loginCookie(app, 'ctv.active@ctv.local');

        const uploadRes = await request(app)
          .put('/api/v1/users/me/files/AVATAR')
          .set('Cookie', ownerCookie)
          .attach('file', validPng, { filename: 'avatar.png', contentType: 'image/png' });
        const fileId = uploadRes.body.file.fileId;

        const asset = await prisma.fileAsset.findUnique({ where: { id: fileId } });
        expect(asset).not.toBeNull();

        // Remove the physical/mocked storage file behind the scenes
        await deleteFile(asset!.storageKey);

        const downloadRes = await request(app)
          .get(`/api/v1/files/${fileId}/content`)
          .set('Cookie', ownerCookie);
        expect(downloadRes.status).toBe(404);
      });

      it('storage failure does not create inconsistent database metadata', async () => {
        const ownerCookie = await loginCookie(app, 'ctv.active@ctv.local');

        if (driver === 'supabase') {
          mockSupabase.setFailNextUpload(true);
        }

        const countBefore = await prisma.fileAsset.count();

        if (driver === 'supabase') {
          const res = await request(app)
            .put('/api/v1/users/me/files/AVATAR')
            .set('Cookie', ownerCookie)
            .attach('file', validPng, { filename: 'avatar.png', contentType: 'image/png' });

          expect(res.status).toBe(500);
          const countAfter = await prisma.fileAsset.count();
          expect(countAfter).toBe(countBefore);
        }
      });

      it('database failure cleans up newly uploaded storage object', async () => {
        const ctv = await prisma.account.findFirstOrThrow({
          where: { email: 'ctv.active@ctv.local' },
        });

        let uploadedStorageKey: string | null = null;
        const originalTransaction = prisma.$transaction.bind(prisma);

        (prisma as any).$transaction = async () => {
          if (driver === 'supabase') {
            for (const key of mockSupabase._store.keys()) {
              if (key.includes('cleanup-test.png')) {
                uploadedStorageKey = key;
              }
            }
          }
          throw new Error('Simulated DB error');
        };

        try {
          await expect(
            filesService.uploadFileForAccount(ctv.id, 'AVATAR', {
              buffer: validPng,
              originalname: 'cleanup-test.png',
              mimetype: 'image/png',
              size: validPng.length,
            } as Express.Multer.File),
          ).rejects.toThrow('Simulated DB error');
        } finally {
          (prisma as any).$transaction = originalTransaction;
        }

        if (driver === 'supabase' && uploadedStorageKey) {
          expect(mockSupabase._store.has(uploadedStorageKey)).toBe(false);
        }
      });
    });
  }
});
