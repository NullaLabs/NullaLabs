import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readme = readFileSync(resolve(root, 'README.md'), 'utf8');

for (const forbidden of [
  'file:///',
  'C:\\Users',
  'D:\\',
  'E:\\',
  'steveblackbeard.github.io',
  'raw.githubusercontent.com/SteveBlackbeard',
]) {
  assert.equal(readme.includes(forbidden), false, `forbidden public reference: ${forbidden}`);
}

for (const repository of [
  'CHRONOLITH-by-Ethernium',
  'SENESCHAL-by-Ethernium',
  'FONTS-FORGE-by-Ethernium',
  'KAPTURA-by-Ethernium',
]) {
  assert.ok(readme.includes(`https://github.com/NullaLabs/${repository}`), `missing public repository: ${repository}`);
}

const localImages = [...readme.matchAll(/<img\s+src="([^"?#]+)(?:[?#][^"]*)?"/g)]
  .map((match) => match[1])
  .filter((source) => !source.startsWith('https://'));

assert.ok(localImages.length > 0, 'profile must contain local visual assets');
for (const source of localImages) {
  assert.ok(existsSync(resolve(root, source)), `missing local image: ${source}`);
}

console.log(`Profile contract passed: ${localImages.length} local images verified.`);
