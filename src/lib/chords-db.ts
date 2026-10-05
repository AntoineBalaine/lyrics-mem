import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { z } from 'zod';
import { chordSlug } from './chord-key';
import { isPersistenceEnabled } from './feature-flags';

/**
 * The chart library, kept either in this browser or only in memory.
 *
 * Which one is a runtime flag rather than a build constant, because the two
 * ways this app is used want opposite answers; `feature-flags.ts` says why.
 * The flag is read on every call, so flipping it takes effect on the next
 * render: turning it on shows the persisted library, turning it off shows
 * the in-memory one, and the charts on the other side are left alone rather
 * than migrated. Nothing is deleted either way.
 *
 * Chord charts live in their own database rather than beside the lyrics
 * songs of `db.ts`. They are unrelated content, and sharing a schema would
 * tie each one's versioning to the other's.
 */

// A chart stores its own iRealPro link and nothing derived from it, so that
// it is scanned, parsed and laid out afresh on every display. That way a
// parser fix improves every chart already in the library rather than only
// newly imported ones, and there is no converted output to go stale. The
// link names one song, rebuilt from the fields read out of whatever
// playlist link the chart was imported from.
export const chordChartRecordSchema = z.object({
  id: z.string(),
  title: z.string(),
  composer: z.string(),
  link: z.string(),
  savedAt: z.number(),
  source: z.literal('irealpro'),
});

export type ChordChartRecord = z.infer<typeof chordChartRecordSchema>;

interface ChordsDB extends DBSchema {
  charts: {
    key: string;
    value: ChordChartRecord;
    indexes: { 'by-savedAt': number };
  };
}

const DB_NAME = 'chords-mem';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<ChordsDB>> | null = null;

function db(): Promise<IDBPDatabase<ChordsDB>> {
  if (!dbPromise) {
    dbPromise = openDB<ChordsDB>(DB_NAME, DB_VERSION, {
      upgrade(connection) {
        const store = connection.createObjectStore('charts', { keyPath: 'id' });
        store.createIndex('by-savedAt', 'savedAt');
      },
    });
  }
  return dbPromise;
}

/** The library held for this page only, used when persistence is off. */
const memory = new Map<string, ChordChartRecord>();

export interface AddChordChartInput {
  title: string;
  composer: string;
  link: string;
}

function toRecord(input: AddChordChartInput): ChordChartRecord {
  const record: ChordChartRecord = {
    // Two charts with the same title and composer are the same chart, so a
    // re-import of a backup overwrites rather than growing duplicates.
    id: chordSlug(input.title, input.composer),
    title: input.title.trim(),
    composer: input.composer.trim(),
    link: input.link,
    savedAt: Date.now(),
    source: 'irealpro',
  };
  chordChartRecordSchema.parse(record);
  return record;
}

export async function addChordChart(input: AddChordChartInput): Promise<ChordChartRecord> {
  const record = toRecord(input);
  if (!isPersistenceEnabled()) {
    memory.set(record.id, record);
    return record;
  }
  const connection = await db();
  await connection.put('charts', record);
  return record;
}

/**
 * Adds many charts at once.
 *
 * A library backup holds several hundred, and writing each in its own
 * transaction makes importing one visibly slow; a single transaction is
 * one round trip instead of hundreds.
 */
export async function addChordCharts(inputs: AddChordChartInput[]): Promise<ChordChartRecord[]> {
  const records = inputs.map(toRecord);
  if (!isPersistenceEnabled()) {
    for (const record of records) memory.set(record.id, record);
    return records;
  }
  const connection = await db();
  const tx = connection.transaction('charts', 'readwrite');
  for (const record of records) void tx.store.put(record);
  await tx.done;
  return records;
}

export async function getChordChart(id: string): Promise<ChordChartRecord | undefined> {
  if (!isPersistenceEnabled()) return memory.get(id);
  const connection = await db();
  return connection.get('charts', id);
}

export async function listChordCharts(): Promise<ChordChartRecord[]> {
  if (!isPersistenceEnabled()) return [...memory.values()].sort((a, b) => a.savedAt - b.savedAt);
  const connection = await db();
  return connection.getAllFromIndex('charts', 'by-savedAt');
}

export async function deleteChordChart(id: string): Promise<void> {
  if (!isPersistenceEnabled()) {
    memory.delete(id);
    return;
  }
  const connection = await db();
  await connection.delete('charts', id);
}

/** Empties whichever library is in use, for a reader who wants to start over. */
export async function clearChordCharts(): Promise<void> {
  if (!isPersistenceEnabled()) {
    memory.clear();
    return;
  }
  const connection = await db();
  await connection.clear('charts');
}
