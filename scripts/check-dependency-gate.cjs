#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const repoRoot = process.cwd();
const policyFile = path.join(repoRoot, 'ai_shared', 'reviews', 'dependency-policy.md');
const exceptionsFile = path.join(repoRoot, 'ai_shared', 'reviews', 'dependency-exceptions.md');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function collectDirectDependencies() {
  const rootPkg = readJson(path.join(repoRoot, 'package.json'));
  const webviewPkg = readJson(path.join(repoRoot, 'webview', 'package.json'));
  const names = new Set();

  [rootPkg.dependencies, rootPkg.devDependencies, webviewPkg.dependencies, webviewPkg.devDependencies]
    .filter(Boolean)
    .forEach((obj) => {
      Object.keys(obj).forEach((name) => names.add(name));
    });

  return names;
}

function parseLedgerPackages(markdown) {
  const packages = new Set();
  for (const line of markdown.split(/\r?\n/)) {
    if (!line.startsWith('|')) continue;
    const cols = line.split('|').map((col) => col.trim());
    if (cols.length < 3) continue;
    const raw = cols[1];
    if (!raw || raw === 'package' || raw.startsWith('---')) continue;
    const normalized = raw.replace(/`/g, '').trim();
    if (!normalized) continue;
    packages.add(normalized);
  }
  return packages;
}

function parseExpiredExceptions(markdown) {
  const expired = [];
  const today = new Date().toISOString().slice(0, 10);
  for (const line of markdown.split(/\r?\n/)) {
    if (!line.startsWith('|')) continue;
    const cols = line.split('|').map((col) => col.trim());
    if (cols.length < 7) continue;
    const pkg = cols[1].replace(/`/g, '').trim();
    const dueDate = cols[5];
    const status = cols[6];
    if (!pkg || pkg === 'package' || pkg.startsWith('---')) continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) continue;
    if (status.toLowerCase() === 'closed') continue;
    if (dueDate < today) {
      expired.push({ pkg, dueDate });
    }
  }
  return expired;
}

function assertExists(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing required file: ${path.relative(repoRoot, filePath)}`);
  }
}

function main() {
  assertExists(policyFile);
  assertExists(exceptionsFile);
  assertExists(path.join(repoRoot, 'package-lock.json'));
  assertExists(path.join(repoRoot, 'webview', 'package-lock.json'));

  const policyText = fs.readFileSync(policyFile, 'utf-8');
  const exceptionsText = fs.readFileSync(exceptionsFile, 'utf-8');
  const policyPackages = parseLedgerPackages(policyText);
  const exceptionPackages = parseLedgerPackages(exceptionsText);
  const allowedPackages = new Set([...policyPackages, ...exceptionPackages]);

  const directDependencies = collectDirectDependencies();
  const missing = [...directDependencies].filter((dep) => !allowedPackages.has(dep));
  const expired = parseExpiredExceptions(exceptionsText);

  if (missing.length > 0) {
    console.error('[dependency:gate] Missing policy entries for direct dependencies:');
    missing.forEach((name) => console.error(`  - ${name}`));
  }

  if (expired.length > 0) {
    console.error('[dependency:gate] Expired dependency exceptions:');
    expired.forEach((entry) => console.error(`  - ${entry.pkg} (due: ${entry.dueDate})`));
  }

  if (missing.length > 0 || expired.length > 0) {
    process.exit(1);
  }

  console.log('[dependency:gate] OK');
}

main();
