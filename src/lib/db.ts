import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { z } from 'zod';
import { songSlug } from './song-key';

export const songRecordSchema = z.object({
  id: z.string(),
  artist: z.string(),
  title: z.string(),
  body: z.string(),
  savedAt: z.number(),
  source: z.enum(['lrclib', 'musixmatch', 'manual']),
  sourceUrl: z.string().url().optional(),
});

export type SongRecord = z.infer<typeof songRecordSchema>;

interface LyricsDB extends DBSchema {
  songs: {
    key: string;
    value: SongRecord;
    indexes: { 'by-savedAt': number };
  };
}

const DB_NAME = 'lyrics-mem';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<LyricsDB>> | null = null;

function db(): Promise<IDBPDatabase<LyricsDB>> {
  if (!dbPromise) {
    dbPromise = openDB<LyricsDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const store = db.createObjectStore('songs', { keyPath: 'id' });
        store.createIndex('by-savedAt', 'savedAt');
      },
    });
  }
  return dbPromise;
}

export interface AddSongInput {
  artist: string;
  title: string;
  body: string;
  source: SongRecord['source'];
  sourceUrl?: string;
}

export async function addSong(input: AddSongInput): Promise<SongRecord> {
  const record: SongRecord = {
    id: songSlug(input.artist, input.title),
    artist: input.artist.trim(),
    title: input.title.trim(),
    body: input.body,
    savedAt: Date.now(),
    source: input.source,
    sourceUrl: input.sourceUrl,
  };
  songRecordSchema.parse(record);
  const conn = await db();
  await conn.put('songs', record);
  return record;
}

export async function getSong(id: string): Promise<SongRecord | undefined> {
  const conn = await db();
  return conn.get('songs', id);
}

export async function listSongs(): Promise<SongRecord[]> {
  const conn = await db();
  return conn.getAllFromIndex('songs', 'by-savedAt');
}

export async function updateSong(
  id: string,
  patch: Partial<Pick<SongRecord, 'artist' | 'title' | 'body'>>,
): Promise<SongRecord> {
  const conn = await db();
  const existing = await conn.get('songs', id);
  if (!existing) throw new Error(`No song with id "${id}"`);

  // If artist/title changed, the slug-derived id changes too. Rewrite under
  // the new id and remove the old record so the library doesn't grow stale
  // duplicates.
  const next: SongRecord = {
    ...existing,
    artist: patch.artist?.trim() ?? existing.artist,
    title: patch.title?.trim() ?? existing.title,
    body: patch.body ?? existing.body,
  };
  next.id = songSlug(next.artist, next.title);
  songRecordSchema.parse(next);

  if (next.id !== existing.id) {
    const tx = conn.transaction('songs', 'readwrite');
    await tx.store.delete(existing.id);
    await tx.store.put(next);
    await tx.done;
  } else {
    await conn.put('songs', next);
  }
  return next;
}

export async function deleteSong(id: string): Promise<void> {
  const conn = await db();
  await conn.delete('songs', id);
}

export async function exportLibrary(): Promise<{ version: 1; songs: SongRecord[] }> {
  return { version: 1, songs: await listSongs() };
}

export const importLibrarySchema = z.object({
  version: z.literal(1),
  songs: z.array(songRecordSchema),
});

export async function importLibrary(
  data: unknown,
  mode: 'replace' | 'merge' = 'merge',
): Promise<number> {
  const parsed = importLibrarySchema.parse(data);
  const conn = await db();
  const tx = conn.transaction('songs', 'readwrite');
  if (mode === 'replace') await tx.store.clear();
  for (const song of parsed.songs) await tx.store.put(song);
  await tx.done;
  return parsed.songs.length;
}
