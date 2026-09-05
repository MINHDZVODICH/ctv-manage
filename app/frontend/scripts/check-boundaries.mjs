#!/usr/bin/env node

/**
 * Architectural Import-Boundary Checker for CTV Frontend
 *
 * Rules Enforced:
 * 1. SHARED_ISOLATION:
 *    Files in `src/shared/**` must NEVER import from `src/features/**` or `src/app/**`.
 * 2. FEATURE_ENCAPSULATION:
 *    Cross-feature imports between `src/features/<featA>/**` and `src/features/<featB>/**`
 *    must ONLY import through the feature root index (`../<featB>`, `@features/<featB>`, or `@/features/<featB>`),
 *    forbidding deep internal imports into private feature directories (e.g. `../<featB>/components/...`).
 * 3. FEATURE_ISOLATION:
 *    Files in `src/features/**` must NEVER import upward from `src/app/**`.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let tsCompiler = null;
try {
  const tsModule = await import('typescript');
  tsCompiler = tsModule.default || tsModule;
} catch {
  // Graceful fallback to regex parser when typescript package is not present
}

export function extractImportsWithTs(content, filePath, ts) {
  const sf = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);
  const imports = [];

  function visit(node) {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      if (node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        const { line } = sf.getLineAndCharacterOfPosition(node.getStart());
        imports.push({
          specifier: node.moduleSpecifier.text,
          line: line + 1,
        });
      }
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      if (node.arguments.length > 0 && ts.isStringLiteral(node.arguments[0])) {
        const { line } = sf.getLineAndCharacterOfPosition(node.getStart());
        imports.push({
          specifier: node.arguments[0].text,
          line: line + 1,
        });
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sf);
  return imports;
}

export function extractImportsWithRegex(content) {
  // Strip comments while preserving line numbers by replacing multi-line comments with blank lines
  const clean = content
    .replace(/\/\*[\s\S]*?\*\//g, (m) => '\n'.repeat(m.split('\n').length - 1))
    .replace(/\/\/.*$/gm, '');

  const imports = [];
  const regex = /(?:^|\n)\s*(?:import|export)\s+(?:(?:type\s+)?(?:[\w*\s{},$]+|(?:\*\s+as\s+[\w$]+))\s+from\s+)?['"]([^'"]+)['"]/g;
  let m;
  while ((m = regex.exec(clean)) !== null) {
    const prefix = clean.substring(0, m.index);
    const line = prefix.split('\n').length;
    imports.push({ specifier: m[1], line });
  }

  const dynRegex = /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((m = dynRegex.exec(clean)) !== null) {
    const prefix = clean.substring(0, m.index);
    const line = prefix.split('\n').length;
    imports.push({ specifier: m[1], line });
  }

  return imports;
}

export function extractImports(content, filePath) {
  if (tsCompiler) {
    return extractImportsWithTs(content, filePath, tsCompiler);
  }
  return extractImportsWithRegex(content);
}

export function checkImportBoundary(relFile, specifier, srcDir) {
  const normRelFile = relFile.replace(/\\/g, '/');
  const fileParts = normRelFile.split('/');
  const sourceCategory = fileParts[0]; // 'shared', 'features', 'app', etc.
  const sourceFeature = sourceCategory === 'features' ? fileParts[1] : null;

  const cleanSpecifier = specifier.split('?')[0].split('#')[0];
  let relTarget = null;

  if (cleanSpecifier.startsWith('@/')) {
    relTarget = cleanSpecifier.slice(2);
  } else if (cleanSpecifier.startsWith('@features/')) {
    relTarget = 'features/' + cleanSpecifier.slice('@features/'.length);
  } else if (cleanSpecifier.startsWith('@shared/')) {
    relTarget = 'shared/' + cleanSpecifier.slice('@shared/'.length);
  } else if (cleanSpecifier.startsWith('@app/')) {
    relTarget = 'app/' + cleanSpecifier.slice('@app/'.length);
  } else if (cleanSpecifier.startsWith('src/')) {
    relTarget = cleanSpecifier.slice(4);
  } else if (cleanSpecifier.startsWith('./') || cleanSpecifier.startsWith('../')) {
    const absFile = path.resolve(srcDir, normRelFile);
    const absTarget = path.resolve(path.dirname(absFile), cleanSpecifier);
    relTarget = path.relative(srcDir, absTarget).replace(/\\/g, '/');
  }

  // External package or outside src
  if (!relTarget || relTarget.startsWith('..')) {
    return null;
  }

  const targetParts = relTarget.split('/');
  const targetCategory = targetParts[0];

  // Rule 1: Files in src/shared/** must NEVER import from src/features/** or src/app/**
  if (sourceCategory === 'shared') {
    if (targetCategory === 'features') {
      const targetFeature = targetParts[1] || 'features';
      return {
        rule: 'SHARED_ISOLATION',
        message: `Files in 'src/shared' must NEVER import from 'src/features' (attempted import: '${specifier}' -> feature '${targetFeature}').`,
      };
    }
    if (targetCategory === 'app') {
      return {
        rule: 'SHARED_ISOLATION',
        message: `Files in 'src/shared' must NEVER import from 'src/app' (attempted import: '${specifier}').`,
      };
    }
  }

  // Rule 2: Files in src/features/<featA>/** must NOT import from internal subpaths of src/features/<featB>/**
  if (sourceCategory === 'features' && targetCategory === 'features') {
    const targetFeature = targetParts[1];
    if (sourceFeature && targetFeature && sourceFeature !== targetFeature) {
      const isRootImport =
        targetParts.length === 2 ||
        (targetParts.length === 3 && /^index(\.(ts|tsx|js|jsx))?$/.test(targetParts[2]));

      if (!isRootImport) {
        return {
          rule: 'FEATURE_ENCAPSULATION',
          message: `Cross-feature import violation: '${sourceFeature}' imports internal subpath of '${targetFeature}' ('${specifier}'). Only the feature root index (e.g. '../${targetFeature}' or '@features/${targetFeature}') is allowed.`,
        };
      }
    }
  }

  // Rule 3: Features must not import from app
  if (sourceCategory === 'features' && targetCategory === 'app') {
    return {
      rule: 'FEATURE_ISOLATION',
      message: `Feature '${sourceFeature}' must NEVER import upward from 'src/app' (attempted import: '${specifier}').`,
    };
  }

  return null;
}

export function getSourceFiles(dir) {
  let results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(getSourceFiles(fullPath));
    } else if (
      (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) &&
      !entry.name.endsWith('.d.ts')
    ) {
      results.push(fullPath);
    }
  }
  return results;
}

export function scanDirectory(srcDir) {
  const files = getSourceFiles(srcDir);
  const violations = [];
  let totalImports = 0;

  for (const file of files) {
    const relFile = path.relative(srcDir, file).replace(/\\/g, '/');
    const content = fs.readFileSync(file, 'utf8');
    const imports = extractImports(content, file);
    totalImports += imports.length;

    for (const { specifier, line } of imports) {
      const violation = checkImportBoundary(relFile, specifier, srcDir);
      if (violation) {
        violations.push({
          file: relFile,
          line,
          specifier,
          rule: violation.rule,
          message: violation.message,
        });
      }
    }
  }

  return {
    fileCount: files.length,
    totalImports,
    violations,
  };
}

export function runSelfTest(srcDir) {
  const testCases = [
    // Rule 1: Shared isolation
    {
      source: 'shared/ui/Sidebar.tsx',
      specifier: '../../features/auth',
      expectedRule: 'SHARED_ISOLATION',
    },
    {
      source: 'shared/ui/Sidebar.tsx',
      specifier: '@/features/auth',
      expectedRule: 'SHARED_ISOLATION',
    },
    {
      source: 'shared/ui/Sidebar.tsx',
      specifier: '@features/auth',
      expectedRule: 'SHARED_ISOLATION',
    },
    {
      source: 'shared/ui/Sidebar.tsx',
      specifier: '../../app/App',
      expectedRule: 'SHARED_ISOLATION',
    },
    {
      source: 'shared/ui/Sidebar.tsx',
      specifier: '@/app/App',
      expectedRule: 'SHARED_ISOLATION',
    },
    // Rule 1: Valid shared imports
    {
      source: 'shared/ui/Sidebar.tsx',
      specifier: '../../types',
      expectedRule: null,
    },
    {
      source: 'shared/ui/Sidebar.tsx',
      specifier: './TopBar',
      expectedRule: null,
    },
    {
      source: 'shared/ui/Sidebar.tsx',
      specifier: 'react',
      expectedRule: null,
    },
    // Rule 2: Feature encapsulation violations
    {
      source: 'features/schedule/components/ScheduleScreen.tsx',
      specifier: '../../accounts/components/ResetPasswordModal',
      expectedRule: 'FEATURE_ENCAPSULATION',
    },
    {
      source: 'features/schedule/components/ScheduleScreen.tsx',
      specifier: '@/features/accounts/components/ResetPasswordModal',
      expectedRule: 'FEATURE_ENCAPSULATION',
    },
    {
      source: 'features/schedule/components/ScheduleScreen.tsx',
      specifier: '@features/accounts/hooks/useAccounts',
      expectedRule: 'FEATURE_ENCAPSULATION',
    },
    // Rule 2: Allowed cross-feature root imports
    {
      source: 'features/schedule/components/ScheduleScreen.tsx',
      specifier: '../../accounts',
      expectedRule: null,
    },
    {
      source: 'features/schedule/components/ScheduleScreen.tsx',
      specifier: '../../accounts/index',
      expectedRule: null,
    },
    {
      source: 'features/schedule/components/ScheduleScreen.tsx',
      specifier: '@/features/accounts',
      expectedRule: null,
    },
    {
      source: 'features/schedule/components/ScheduleScreen.tsx',
      specifier: '@features/accounts',
      expectedRule: null,
    },
    // Allowed intra-feature imports
    {
      source: 'features/schedule/components/ScheduleScreen.tsx',
      specifier: './CTVScheduleWorkspace',
      expectedRule: null,
    },
    {
      source: 'features/schedule/hooks/useSchedule.ts',
      specifier: '../api/scheduleApi',
      expectedRule: null,
    },
    // Allowed feature -> shared imports
    {
      source: 'features/schedule/components/ScheduleScreen.tsx',
      specifier: '../../../shared/utils/rooms',
      expectedRule: null,
    },
    // Rule 3: Feature upward into app violation
    {
      source: 'features/schedule/components/ScheduleScreen.tsx',
      specifier: '../../../app/App',
      expectedRule: 'FEATURE_ISOLATION',
    },
    {
      source: 'features/schedule/components/ScheduleScreen.tsx',
      specifier: '@/app/App',
      expectedRule: 'FEATURE_ISOLATION',
    },
    // App root coordinating features and shared
    {
      source: 'app/App.tsx',
      specifier: '../features/schedule',
      expectedRule: null,
    },
    {
      source: 'app/App.tsx',
      specifier: '../shared/ui',
      expectedRule: null,
    },
  ];

  let passed = 0;
  let failed = 0;
  for (const tc of testCases) {
    const res = checkImportBoundary(tc.source, tc.specifier, srcDir);
    const actualRule = res ? res.rule : null;
    if (actualRule === tc.expectedRule) {
      passed++;
    } else {
      failed++;
      console.error(
        `Self-test failure for (${tc.source} -> '${tc.specifier}'): expected rule '${tc.expectedRule}', got '${actualRule}'`
      );
    }
  }

  console.log(`Self-tests completed: ${passed} passed, ${failed} failed.`);
  return failed === 0;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === __filename;

if (isMain) {
  const args = process.argv.slice(2);
  const isSelfTest = args.includes('--self-test');
  const srcDir = path.resolve(__dirname, '../src');

  if (isSelfTest) {
    const ok = runSelfTest(srcDir);
    process.exit(ok ? 0 : 1);
  }

  console.log('============================================================');
  console.log('Frontend Architecture Import-Boundary Checker');
  console.log('============================================================');
  console.log(`Scanning directory: ${srcDir}`);

  const { fileCount, totalImports, violations } = scanDirectory(srcDir);
  console.log(`Scanned ${fileCount} files, verified ${totalImports} module imports.\n`);

  if (violations.length > 0) {
    console.error(`❌ Found ${violations.length} import-boundary violation(s):\n`);
    violations.forEach((v, idx) => {
      console.error(`  ${idx + 1}) [${v.rule}]`);
      console.error(`     File:      src/${v.file}:${v.line}`);
      console.error(`     Import:    '${v.specifier}'`);
      console.error(`     Reason:    ${v.message}\n`);
    });
    console.error('FAILED: Please fix architectural boundary violations before proceeding.');
    process.exit(1);
  }

  console.log('✓ Import boundary check passed: 0 architectural violations found.');
  process.exit(0);
}
