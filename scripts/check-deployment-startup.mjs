#!/usr/bin/env node
/**
 * Automated Deployment Regression Check
 * Verifies Docker entrypoint, migration configuration, and startup safety.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve('.');
let failed = false;

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ [FAIL] ${message}`);
    failed = true;
  } else {
    console.log(`✅ [PASS] ${message}`);
  }
}

console.log('========================================');
console.log('   Deployment Startup Regression Gate   ');
console.log('========================================\n');

// 1. Check docker/backend-entrypoint.sh
const entrypointPath = resolve(ROOT, 'docker/backend-entrypoint.sh');
assert(existsSync(entrypointPath), 'docker/backend-entrypoint.sh exists');

if (existsSync(entrypointPath)) {
  const content = readFileSync(entrypointPath, 'utf8');
  assert(
    !content.includes('\r\n'),
    'docker/backend-entrypoint.sh uses LF line endings (required for Alpine /bin/sh)',
  );
  assert(
    content.includes('prisma migrate deploy'),
    'docker/backend-entrypoint.sh invokes prisma migrate deploy',
  );
  assert(
    content.includes('exec "$@"'),
    'docker/backend-entrypoint.sh delegates to exec "$@" for PID 1 signal handling',
  );
}

// 2. Check docker/backend.Dockerfile
const dockerfilePath = resolve(ROOT, 'docker/backend.Dockerfile');
assert(existsSync(dockerfilePath), 'docker/backend.Dockerfile exists');

if (existsSync(dockerfilePath)) {
  const dockerfile = readFileSync(dockerfilePath, 'utf8');
  assert(
    dockerfile.includes('ENTRYPOINT ["/app/entrypoint.sh"]'),
    'backend.Dockerfile sets ENTRYPOINT to /app/entrypoint.sh',
  );
  assert(dockerfile.includes('prisma'), 'backend.Dockerfile includes prisma in production runtime');
}

// 3. Check compose dependency configuration
const composePaths = ['compose.yaml', 'docker/compose.release.yaml', 'release/compose.yaml'];
for (const relPath of composePaths) {
  const fullPath = resolve(ROOT, relPath);
  if (existsSync(fullPath)) {
    const yamlContent = readFileSync(fullPath, 'utf8');
    assert(
      yamlContent.includes('condition: service_healthy'),
      `${relPath} configures backend dependency on postgres service_healthy`,
    );
  }
}

console.log('');
if (failed) {
  console.error('Deployment startup regression checks failed.');
  process.exit(1);
} else {
  console.log('All deployment startup checks passed.');
  process.exit(0);
}
