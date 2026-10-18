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
  'Co-authored-by:',
]) {
  assert.equal(readme.includes(forbidden), false, `forbidden public reference: ${forbidden}`);
}

for (const requiredReference of [
  'https://pypi.org/project/chronolith-pro/',
  'https://pypi.org/project/seneschal/',
  'https://github.com/NullaLabs/FONTS-FORGE-by-Ethernium',
  'https://github.com/NullaLabs/KAPTURA-by-Ethernium',
  'https://github.com/NullaLabs/SCRIBA-by-Ethernium',
  'https://github.com/NullaLabs/RYODAN-ART-CONTEST',
  'Sovereign Custody Pipeline & Holonic Architecture',
]) {
  assert.ok(readme.includes(requiredReference), `missing required profile reference: ${requiredReference}`);
}

const localImages = [...readme.matchAll(/<img\s+src="([^"?#]+)(?:[?#][^"]*)?"/g)]
  .map((match) => match[1])
  .filter((source) => !source.startsWith('https://'));

assert.ok(localImages.length >= 19, 'profile must contain local visual assets and badges');
for (const source of localImages) {
  assert.ok(existsSync(resolve(root, source)), `missing local image: ${source}`);
}

console.log(`Profile contract passed: ${localImages.length} local images and 7 canonical references verified.`);
