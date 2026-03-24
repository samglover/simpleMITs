import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const rootDir = resolve(import.meta.dirname, '..');
const packageJsonPath = resolve(rootDir, 'package.json');
const indexHtmlPath = resolve(rootDir, 'index.html');
const versionPattern = /([?&]ver=)([^"']+)/g;
const simpleMitsVersionPattern = /(<span\s+id="simplemits-version">)(.*?)(<\/span>)/;

const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
const version = packageJson.version;
const indexHtml = readFileSync(indexHtmlPath, 'utf8');

if (!version) {
  throw new Error('package.json is missing a version value.');
}

if (!versionPattern.test(indexHtml)) {
  throw new Error('No versioned asset URLs were found in index.html.');
}

if (!simpleMitsVersionPattern.test(indexHtml)) {
  throw new Error('The #simplemits-version element was not found in index.html.');
}

const updatedIndexHtml = indexHtml
  .replace(versionPattern, `$1${version}`)
  .replace(simpleMitsVersionPattern, `$1${version}$3`);

writeFileSync(indexHtmlPath, updatedIndexHtml);

console.log(`Synchronized index.html asset URLs and #simplemits-version to ${version}.`);