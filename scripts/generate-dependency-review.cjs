#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const repoRoot = process.cwd();
const reviewDir = path.join(repoRoot, 'ai_shared', 'reviews', 'dependency-review');
const exceptionsFile = path.join(repoRoot, 'ai_shared', 'reviews', 'dependency-exceptions.md');

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

function main() {
  const now = new Date();
  const yyyymm = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const reportPath = path.join(reviewDir, `${yyyymm}.md`);
  const exceptions = fs.existsSync(exceptionsFile)
    ? fs.readFileSync(exceptionsFile, 'utf-8')
    : '';
  const expired = parseExpiredExceptions(exceptions);

  const lines = [
    `# Dependency Review ${yyyymm}`,
    '',
    `- Generated at: ${now.toISOString()}`,
    '- Scope: root + webview direct dependencies',
    '',
    '## Monthly Checklist',
    '',
    '- [ ] npm audit (high/critical) review completed',
    '- [ ] dependency-policy.md updated for added/updated packages',
    '- [ ] dependency-exceptions.md reviewed and approver signed',
    '- [ ] SBOM artifact generated and archived',
    '',
    '## Expired Exceptions',
    '',
  ];

  if (expired.length === 0) {
    lines.push('- None');
  } else {
    expired.forEach((entry) => {
      lines.push(`- ${entry.pkg} (due: ${entry.dueDate})`);
    });
  }

  lines.push('', '## Notes', '', '- ');
  fs.mkdirSync(reviewDir, { recursive: true });
  fs.writeFileSync(reportPath, `${lines.join('\n')}\n`, 'utf-8');
  console.log(`[dependency:review] Wrote ${path.relative(repoRoot, reportPath)}`);
}

main();
