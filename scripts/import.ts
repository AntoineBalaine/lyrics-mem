#!/usr/bin/env tsx
import { copyFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const [artist, title, source] = process.argv.slice(2);

if (!artist || !title || !source) {
  console.error('Usage: npm run import -- "<artist>" "<title>" <path-to-txt>');
  process.exit(1);
}

const dir = resolve('src/content/songs');
const target = resolve(dir, `${artist} - ${title}.txt`);

await mkdir(dir, { recursive: true });
await copyFile(resolve(source), target);

console.log(`Imported → ${target}`);
