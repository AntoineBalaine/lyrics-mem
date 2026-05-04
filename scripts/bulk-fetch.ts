#!/usr/bin/env tsx
import { writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { lrclibAdapter } from '../src/lib/adapters/lrclib';
import { musixmatchAdapter } from '../src/lib/adapters/musixmatch';
import type { LyricsAdapter } from '../src/lib/adapters/types';

const adapters: LyricsAdapter[] = [lrclibAdapter, musixmatchAdapter];

const [artistArg, ...titleArgs] = process.argv.slice(2);
if (!artistArg || titleArgs.length === 0) {
  console.error('Usage: tsx scripts/bulk-fetch.ts "<artist>" "<title1>" "<title2>" ...');
  process.exit(1);
}

const dir = resolve('src/content/songs');
await mkdir(dir, { recursive: true });

for (const title of titleArgs) {
  let saved = false;
  for (const adapter of adapters) {
    try {
      const got = await adapter.fetch({ artist: artistArg, title });
      if (got?.body) {
        const target = resolve(dir, `${artistArg} - ${title}.txt`);
        await writeFile(target, got.body.endsWith('\n') ? got.body : `${got.body}\n`, 'utf8');
        console.log(`✓ ${title}  [${adapter.name}]`);
        saved = true;
        break;
      }
    } catch (err) {
      console.error(`  ${adapter.name} error for "${title}":`, err instanceof Error ? err.message : err);
    }
  }
  if (!saved) console.log(`✗ ${title}  (no adapter had it)`);
}
