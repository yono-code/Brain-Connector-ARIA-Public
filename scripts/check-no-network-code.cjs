#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const repoRoot = process.cwd();
const scanRoots = ['src', path.join('webview', 'src')];
const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.cjs', '.mjs']);
const blockedDependencyNames = [
  'axios',
  'node-fetch',
  'cross-fetch',
  'got',
  'superagent',
  'ws',
];
const blockedPatterns = [
  { name: 'fetch', regex: /\bfetch\s*\(/ },
  { name: 'XMLHttpRequest', regex: /\bXMLHttpRequest\b/ },
  { name: 'WebSocket', regex: /\bnew\s+WebSocket\s*\(/ },
  { name: 'EventSource', regex: /\bnew\s+EventSource\s*\(/ },
  { name: 'http/https request', regex: /\bhttps?\.(request|get)\s*\(/ },
  { name: 'require(http|https)', regex: /require\(\s*['"]https?['"]\s*\)/ },
];

function walk(dirPath, out) {
  if (!fs.existsSync(dirPath)) {
    return;
  }
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, out);
      continue;
    }
    if (!sourceExtensions.has(path.extname(entry.name))) {
      continue;
    }
    out.push(fullPath);
  }
}

function collectDirectDependencies(packageFilePath) {
  if (!fs.existsSync(packageFilePath)) {
    return [];
  }
  const pkg = JSON.parse(fs.readFileSync(packageFilePath, 'utf-8'));
  const all = {
    ...(pkg.dependencies ?? {}),
    ...(pkg.devDependencies ?? {}),
    ...(pkg.optionalDependencies ?? {}),
  };
  return Object.keys(all);
}

function main() {
  const violations = [];
  const files = [];

  for (const relRoot of scanRoots) {
    walk(path.join(repoRoot, relRoot), files);
  }

  for (const filePath of files) {
    const content = fs.readFileSync(filePath, 'utf-8');
    for (const rule of blockedPatterns) {
      if (rule.regex.test(content)) {
        violations.push({
          type: 'code',
          reason: rule.name,
          file: path.relative(repoRoot, filePath),
        });
      }
    }
  }

  const dependencyNames = new Set([
    ...collectDirectDependencies(path.join(repoRoot, 'package.json')),
    ...collectDirectDependencies(path.join(repoRoot, 'webview', 'package.json')),
  ]);
  for (const blockedName of blockedDependencyNames) {
    if (dependencyNames.has(blockedName)) {
      violations.push({
        type: 'dependency',
        reason: blockedName,
        file: 'package.json/webview/package.json',
      });
    }
  }

  if (violations.length > 0) {
    console.error('[no-network:guard] Blocked network-related code detected:');
    for (const violation of violations) {
      console.error(`  - ${violation.file} (${violation.type}: ${violation.reason})`);
    }
    process.exit(1);
  }

  console.log('[no-network:guard] OK: no blocked network code/dependencies found.');
}

main();
