#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const scanDir = path.join(repoRoot, 'app', 'frontend', 'src');

// Scannable source code file extensions
const SCANNABLE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.json', '.html', '.css']);

// Allowlist for known intentional domain constants, internal enum values, and language labels
const ALLOWLIST = [
  'Tiếng Việt',
  'Tiếng Anh',
  'Cộng tác viên',
  'Kích hoạt',
  'Vô hiệu hóa',
  'Chờ duyệt',
  'Đã duyệt',
  'Từ chối',
  'Đã đăng ký',
  'Chưa đăng ký',
  'Xin nghỉ',
  'Nghỉ',
  'Sắp diễn ra',
  'Đang diễn ra',
  'Đã kết thúc',
  'Đã hủy',
  'Thấp',
  'Trung bình',
  'Cao',
  'Xám',
  'Lục',
  'Lam',
  'Vàng',
  'Đỏ',
  'Cam',
  'Tím',
  'Sáng',
  'Tối',
  'Buồng',
  'Chưa cập nhật',
  'Chưa gán buồng',
  'Nam',
  'Nữ',
  'Khác',
];

// Regex matching Vietnamese diacritic Unicode characters [À-ỹ]
const VIETNAMESE_REGEX = /[À-ỹ]/u;

function toPosixPath(filePath) {
  return filePath.replace(/\\/g, '/');
}

function isExcluded(relPath) {
  // 1. Exclude translation dictionaries: app/frontend/src/shared/i18n/**
  if (
    relPath.startsWith('app/frontend/src/shared/i18n/') ||
    relPath === 'app/frontend/src/shared/i18n'
  ) {
    return true;
  }
  // 2. Exclude system settings configuration: app/frontend/src/shared/context/SystemSettingsContext.tsx
  if (relPath === 'app/frontend/src/shared/context/SystemSettingsContext.tsx') {
    return true;
  }
  // 3. Exclude internal database/api schema & protocol mapper files
  if (
    relPath.startsWith('app/frontend/src/shared/types/') ||
    relPath === 'app/frontend/src/shared/mappers.ts' ||
    relPath === 'app/frontend/src/shared/utils/rooms.ts'
  ) {
    return true;
  }
  // 4. Exclude test files (*.test.*, *.spec.*)
  const filename = path.basename(relPath);
  if (/\.(test|spec)\.[^.]+$/.test(filename)) {
    return true;
  }
  return false;
}

function getFilesToScan(dir) {
  const files = [];

  function walk(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (SCANNABLE_EXTENSIONS.has(ext)) {
          files.push(fullPath);
        }
      }
    }
  }

  if (fs.existsSync(dir)) {
    walk(dir);
  }
  return files;
}

function checkLineForVietnamese(line) {
  const trimmed = line.trim();
  // Developer comments (Category 4 in plan.md)
  if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return false;
  if (trimmed.startsWith('{/*') && trimmed.endsWith('*/}')) return false;

  // Strip inline comments
  let cleaned = line
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/g, '');

  // Backend message matching patterns (e.g. .includes("..."))
  cleaned = cleaned.replace(/\.(?:includes|match|test)\s*\([^)]*\)/g, '');

  for (const allowed of ALLOWLIST) {
    cleaned = cleaned.replaceAll(allowed, '');
  }

  return VIETNAMESE_REGEX.test(cleaned);
}

function runAudit() {
  console.log('============================================================');
  console.log('       i18n Hard-Coded String Audit (CI Guard)              ');
  console.log('============================================================\n');

  const allFiles = getFilesToScan(scanDir);
  const scannedFiles = [];
  const violations = [];

  for (const fullPath of allFiles) {
    const relPath = toPosixPath(path.relative(repoRoot, fullPath));

    if (isExcluded(relPath)) {
      continue;
    }

    scannedFiles.push(relPath);

    const content = fs.readFileSync(fullPath, 'utf8');
    const lines = content.split('\n');

    lines.forEach((line, idx) => {
      if (checkLineForVietnamese(line)) {
        violations.push({
          file: relPath,
          line: idx + 1,
          content: line.trim(),
        });
      }
    });
  }

  if (violations.length > 0) {
    console.error(`❌ Found ${violations.length} unexpected Vietnamese string violation(s):\n`);

    // Group violations by file for clear logging
    const byFile = new Map();
    for (const v of violations) {
      if (!byFile.has(v.file)) {
        byFile.set(v.file, []);
      }
      byFile.get(v.file).push(v);
    }

    for (const [file, fileViolations] of byFile.entries()) {
      console.error(`  📄 ${file} (${fileViolations.length} violations):`);
      for (const v of fileViolations) {
        console.error(`     Line ${v.line}: ${v.content}`);
      }
      console.error('');
    }

    console.error('------------------------------------------------------------');
    console.error(`Summary: ${violations.length} violation(s) across ${byFile.size} file(s).`);
    console.error(`Scanned: ${scannedFiles.length} file(s) in app/frontend/src.`);
    console.error('All user-facing strings must use t("key") translations.');
    console.error('------------------------------------------------------------\n');

    process.exit(1);
  } else {
    console.log(`✅ Success! All ${scannedFiles.length} scanned frontend source files are clean.`);
    console.log('No unexpected hard-coded Vietnamese strings found.\n');
    process.exit(0);
  }
}

runAudit();
