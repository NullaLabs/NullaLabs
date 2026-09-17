import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = new URL('../../', import.meta.url);
const baseline = JSON.parse(readFileSync(new URL('./release-baseline.json', import.meta.url), 'utf8'));
const actual = {};
const portableTextExtensions = new Set(['.html','.js','.mjs','.json','.md','.yml','.yaml','.css','.svg','.txt','.gitattributes']);

function portableBytes(relativePath, bytes) {
  const extension = relativePath.slice(relativePath.lastIndexOf('.')).toLowerCase();
  if (!portableTextExtensions.has(extension)) return bytes;
  return Buffer.from(bytes.toString('utf8').replace(/\r\n?/g,'\n'),'utf8');
}

for (const relativePath of Object.keys(baseline.files)) {
  const bytes = readFileSync(new URL(relativePath, root));
  actual[relativePath] = createHash('sha256').update(portableBytes(relativePath,bytes)).digest('hex');
}

if (process.argv.includes('--print')) {
  for (const [path, hash] of Object.entries(actual)) console.log(`${hash}  ${path}`);
} else {
  assert.deepEqual(actual, baseline.files, 'release files differ from the verified SHA-256 baseline');
  console.log(`Release baseline ${baseline.release} verified (${Object.keys(actual).length} files).`);
}
