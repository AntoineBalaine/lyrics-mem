// Use fake-indexeddb so the IDB layer can be exercised in node tests.
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  addSong,
  deleteSong,
  exportLibrary,
  getSong,
  importLibrary,
  listSongs,
  updateSong,
} from './db';

async function clearAll() {
  for (const s of await listSongs()) await deleteSong(s.id);
}

beforeEach(async () => {
  await clearAll();
});

afterEach(async () => {
  await clearAll();
});

describe('addSong / getSong / listSongs', () => {
  it('persists a song and reads it back', async () => {
    const saved = await addSong({
      artist: 'Radiohead',
      title: 'Karma Police',
      body: 'Karma police\nArrest this man\n',
      source: 'lrclib',
    });
    expect(saved.id).toBe('radiohead-karma-police');
    expect(saved.savedAt).toBeGreaterThan(0);

    const fetched = await getSong(saved.id);
    expect(fetched).toEqual(saved);
  });

  it('lists songs ordered by savedAt', async () => {
    const a = await addSong({ artist: 'A', title: '1', body: 'x', source: 'manual' });
    await new Promise((r) => setTimeout(r, 5));
    const b = await addSong({ artist: 'B', title: '2', body: 'y', source: 'manual' });
    const all = await listSongs();
    expect(all.map((s) => s.id)).toEqual([a.id, b.id]);
  });
});

describe('updateSong', () => {
  it('updates body in place when slug is unchanged', async () => {
    const saved = await addSong({
      artist: 'X',
      title: 'Y',
      body: 'old',
      source: 'manual',
    });
    const updated = await updateSong(saved.id, { body: 'new' });
    expect(updated.id).toBe(saved.id);
    expect(updated.body).toBe('new');
    expect(await getSong(saved.id)).toMatchObject({ body: 'new' });
  });

  it('rewrites under the new id when artist or title changes', async () => {
    const saved = await addSong({ artist: 'X', title: 'Y', body: 'b', source: 'manual' });
    const updated = await updateSong(saved.id, { title: 'Z' });
    expect(updated.id).not.toBe(saved.id);
    expect(updated.title).toBe('Z');
    expect(await getSong(saved.id)).toBeUndefined();
    expect(await getSong(updated.id)).toMatchObject({ title: 'Z' });
  });

  it('throws when the id does not exist', async () => {
    await expect(updateSong('does-not-exist', { body: 'x' })).rejects.toThrow();
  });
});

describe('deleteSong', () => {
  it('removes a song', async () => {
    const saved = await addSong({ artist: 'A', title: 'B', body: 'x', source: 'manual' });
    await deleteSong(saved.id);
    expect(await getSong(saved.id)).toBeUndefined();
  });
});

describe('export / import', () => {
  it('round-trips the library', async () => {
    await addSong({ artist: 'A', title: '1', body: 'x', source: 'manual' });
    await addSong({ artist: 'B', title: '2', body: 'y', source: 'lrclib' });
    const dump = await exportLibrary();
    expect(dump.songs).toHaveLength(2);

    await clearAll();
    const count = await importLibrary(dump);
    expect(count).toBe(2);
    expect(await listSongs()).toHaveLength(2);
  });

  it('replace mode wipes existing entries', async () => {
    await addSong({ artist: 'A', title: '1', body: 'x', source: 'manual' });
    const dump = { version: 1 as const, songs: [] };
    await importLibrary(dump, 'replace');
    expect(await listSongs()).toHaveLength(0);
  });

  it('rejects malformed payloads', async () => {
    await expect(importLibrary({ version: 999, songs: [] })).rejects.toThrow();
  });
});
