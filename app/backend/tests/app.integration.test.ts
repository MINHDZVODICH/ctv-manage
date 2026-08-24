import assert from 'node:assert/strict';
import { test } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createLogger } from '../src/shared/logger.js';

test('unknown API routes return the standard request-id error envelope', async () => {
  const response = await request(createApp()).get('/api/v1/missing');

  assert.equal(response.status, 404);
  assert.equal(response.body.error.code, 'RESOURCE_NOT_FOUND');
  assert.match(response.body.error.requestId, /^req_/);
});

test('HTTP request logging redacts authorization credentials', async () => {
  const entries: string[] = [];
  const logger = createLogger({ write: (entry: string) => entries.push(entry) }, 'info');

  await request(createApp({ logger }))
    .get('/api/v1/health')
    .set('authorization', 'Bearer top-secret-token');

  assert.equal(entries.join('').includes('top-secret-token'), false);
});

test('allowlisted browser preflight receives credentialed CORS headers', async () => {
  const response = await request(createApp())
    .options('/api/v1/health')
    .set('origin', 'http://localhost:5173')
    .set('access-control-request-method', 'POST');

  assert.equal(response.status, 204);
  assert.equal(response.headers['access-control-allow-origin'], 'http://localhost:5173');
  assert.equal(response.headers['access-control-allow-credentials'], 'true');
  assert.match(response.headers['access-control-allow-methods'], /POST/);
  assert.match(response.headers['access-control-allow-headers'], /Idempotency-Key/i);
});

test('malformed JSON returns the standard client-input error envelope', async () => {
  const response = await request(createApp())
    .post('/api/v1/health')
    .set('content-type', 'application/json')
    .send('{');

  assert.equal(response.status, 400);
  assert.equal(response.body.error.code, 'INVALID_JSON');
  assert.match(response.body.error.requestId, /^req_/);
});
