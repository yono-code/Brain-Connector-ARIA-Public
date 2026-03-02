#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const repoRoot = process.cwd();
const outputDir = path.join(repoRoot, 'artifacts');
const outputFile = path.join(outputDir, 'sbom.spdx.json');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function normalizePackageName(lockPackageName, lockPath, fallbackName) {
  if (lockPackageName) return lockPackageName;
  if (!lockPath || lockPath === '') return fallbackName;
  const match = lockPath.match(/node_modules\/(.+)$/);
  return match ? match[1] : lockPath;
}

function collectPackages(lockPath, projectLabel, fallbackRootName) {
  const lockJson = readJson(lockPath);
  const packages = lockJson.packages || {};
  const list = [];

  for (const [pkgPath, pkg] of Object.entries(packages)) {
    const name = normalizePackageName(pkg.name, pkgPath, fallbackRootName);
    if (!name) continue;

    list.push({
      SPDXID: `SPDXRef-Package-${projectLabel}-${name.replace(/[^A-Za-z0-9.-]/g, '-')}`,
      name: `${projectLabel}:${name}`,
      versionInfo: pkg.version || 'UNKNOWN',
      downloadLocation: 'NOASSERTION',
      licenseConcluded: 'NOASSERTION',
      licenseDeclared: 'NOASSERTION',
      supplier: 'NOASSERTION',
      filesAnalyzed: false,
    });
  }

  return list;
}

function main() {
  const rootPackageJson = readJson(path.join(repoRoot, 'package.json'));
  const webviewPackageJson = readJson(path.join(repoRoot, 'webview', 'package.json'));

  const packages = [
    ...collectPackages(path.join(repoRoot, 'package-lock.json'), 'root', rootPackageJson.name),
    ...collectPackages(path.join(repoRoot, 'webview', 'package-lock.json'), 'webview', webviewPackageJson.name),
  ];

  const sbom = {
    spdxVersion: 'SPDX-2.3',
    dataLicense: 'CC0-1.0',
    SPDXID: 'SPDXRef-DOCUMENT',
    name: 'ARIA Dependency SBOM',
    documentNamespace: `https://aria.local/spdx/${Date.now()}`,
    creationInfo: {
      created: new Date().toISOString(),
      creators: ['Tool: aria-generate-sbom.cjs'],
    },
    packages,
  };

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(outputFile, `${JSON.stringify(sbom, null, 2)}\n`, 'utf-8');
  console.log(`[dependency:sbom] Wrote ${path.relative(repoRoot, outputFile)}`);
}

main();
