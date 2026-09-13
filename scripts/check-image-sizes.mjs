#!/usr/bin/env node
import { execFileSync } from 'node:child_process';

const BUDGETS = {
  backend: {
    name: 'ctv-backend:latest',
    maxBytes: 350 * 1024 * 1024, // 350 MB budget (>= 25% reduction from 467 MB)
    baselineMb: 467.04,
  },
  frontend: {
    name: 'ctv-frontend:latest',
    maxBytes: 50 * 1024 * 1024, // 50 MB budget (>= 50% reduction from 102.47 MB)
    baselineMb: 102.47,
  },
};

function getImageSize(imageName) {
  try {
    const output = execFileSync(
      'docker',
      ['image', 'inspect', imageName, '--format', '{{.Size}}'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    );
    return Number.parseInt(output.trim(), 10);
  } catch (error) {
    throw new Error(`Failed to inspect Docker image ${imageName}: ${error.message}`);
  }
}

console.log('========================================');
console.log('   Docker Image Size Regression Gate    ');
console.log('========================================\n');

let failed = false;

for (const [key, config] of Object.entries(BUDGETS)) {
  try {
    const sizeBytes = getImageSize(config.name);
    const sizeMb = (sizeBytes / (1024 * 1024)).toFixed(2);
    const maxMb = (config.maxBytes / (1024 * 1024)).toFixed(2);
    const reductionPercent = (((config.baselineMb - sizeMb) / config.baselineMb) * 100).toFixed(1);

    if (sizeBytes > config.maxBytes) {
      console.error(
        `❌ [FAIL] ${key} (${config.name}): ${sizeMb} MB exceeds budget of ${maxMb} MB! (Baseline: ${config.baselineMb} MB)`,
      );
      failed = true;
    } else {
      console.log(
        `✅ [PASS] ${key} (${config.name}): ${sizeMb} MB (Budget: <= ${maxMb} MB | Baseline: ${config.baselineMb} MB | Reduction: -${reductionPercent}%)`,
      );
    }
  } catch (err) {
    console.error(`⚠️  [ERROR] Could not check ${key}: ${err.message}`);
    failed = true;
  }
}

console.log('');
if (failed) {
  console.error('Image size budget check failed.');
  process.exit(1);
} else {
  console.log('All image size checks passed within approved budget.');
  process.exit(0);
}
