process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  process.env.DATABASE_TEST_URL ??
  'postgresql://ctv_manage:ctv_manage@localhost:5432/ctv_manage_test?schema=public';
process.env.FILE_STORAGE_ROOT ??= '.acceptance-uploads';
process.env.CORS_ORIGIN ??= 'http://127.0.0.1:3100';
process.env.SESSION_SECRET ??= 'acceptance-test-secret-not-for-production';
