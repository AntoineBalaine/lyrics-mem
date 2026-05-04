import { defineCollection, z } from 'astro:content';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseSongFilename, songSlug } from './lib/song-key';

const SONGS_DIR = './src/content/songs';

const songs = defineCollection({
  loader: async () => {
    const files = (await readdir(SONGS_DIR)).filter((f) => f.endsWith('.txt'));
    return Promise.all(
      files.map(async (file) => {
        const { artist, title } = parseSongFilename(file);
        const body = await readFile(join(SONGS_DIR, file), 'utf8');
        return {
          id: songSlug(artist, title),
          artist,
          title,
          body,
        };
      }),
    );
  },
  schema: z.object({
    artist: z.string(),
    title: z.string(),
    body: z.string(),
  }),
});

export const collections = { songs };
