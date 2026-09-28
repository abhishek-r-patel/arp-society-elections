#!/usr/bin/env node
// Updates ADMIN_PASSWORD_HASH in worker/.dev.vars without ever writing the
// plaintext password to disk. Usage: npm run set-admin-password -- "your password"
import { createHash } from 'node:crypto';
import { existsSync, copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const workerDir = dirname(dirname(fileURLToPath(import.meta.url)));
const devVarsPath = join(workerDir, '.dev.vars');
const devVarsExamplePath = join(workerDir, '.dev.vars.example');

const password = process.argv[2];
if (!password) {
  console.error('Usage: npm run set-admin-password -- "your new password"');
  process.exit(1);
}

if (!existsSync(devVarsPath)) {
  copyFileSync(devVarsExamplePath, devVarsPath);
}

const hash = createHash('sha256').update(password).digest('hex');
const lines = readFileSync(devVarsPath, 'utf8').split(/\r?\n/);
const updated = lines.some((line) => line.startsWith('ADMIN_PASSWORD_HASH='));
const nextLines = updated
  ? lines.map((line) => (line.startsWith('ADMIN_PASSWORD_HASH=') ? `ADMIN_PASSWORD_HASH=${hash}` : line))
  : [...lines, `ADMIN_PASSWORD_HASH=${hash}`];

writeFileSync(devVarsPath, nextLines.join('\n'));
console.log('ADMIN_PASSWORD_HASH updated in .dev.vars. Restart `wrangler dev` for it to take effect.');
