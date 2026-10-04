import { z } from 'zod';
import { chordSlug } from './chord-key';

// Storage is temporarily unhooked from IndexedDB (was `idb`-backed) and
// kept in a plain in-memory Map instead, cleared on every page reload.
// While the iRealPro -> ABC conversion pipeline is still actively
// changing, a persisted chart from an earlier conversion looked
// indistinguishable from a fresh one, so every manual test required
// deleting and re-importing to be sure of what was actually being
// rendered. An in-memory store makes that impossible by construction: a
// reload always starts empty, so there is never stale converted output
// to accidentally look at. Swap back to the idb-backed version (see git
// history for this file) once the conversion pipeline has settled down.

// Kept in a separate IndexedDB object store from the lyrics `songs` store
// (see src/lib/db.ts) — chord charts are a distinct, unrelated content
// type, and keeping them in their own store avoids any coupling to the
// lyrics schema/versioning.
// A chart stores its own iRealPro link and nothing derived from it, so
// that it is scanned, parsed and laid out afresh on every display. This
// replaces an earlier decision to store converted ABC and never the link:
// that decision had the conversion as the thing worth keeping, and with
// the conversion gone the link is the only source of truth left. Storing
// it means a parser fix improves every chart already in the library rather
// than only newly imported ones.
//
// The link held here names one song, rebuilt from the fields read out of
// whatever playlist link the chart was imported from, so that a chart
// carries its own source rather than a reference into a playlist of
// several hundred others.
export const chordChartRecordSchema = z.object({
  id: z.string(),
  title: z.string(),
  composer: z.string(),
  link: z.string(),
  savedAt: z.number(),
  source: z.literal('irealpro'),
});

export type ChordChartRecord = z.infer<typeof chordChartRecordSchema>;

const charts = new Map<string, ChordChartRecord>();

export interface AddChordChartInput {
  title: string;
  composer: string;
  link: string;
}

export async function addChordChart(input: AddChordChartInput): Promise<ChordChartRecord> {
  const record: ChordChartRecord = {
    id: chordSlug(input.title, input.composer),
    title: input.title.trim(),
    composer: input.composer.trim(),
    link: input.link,
    savedAt: Date.now(),
    source: 'irealpro',
  };
  chordChartRecordSchema.parse(record);
  charts.set(record.id, record);
  return record;
}

export async function getChordChart(id: string): Promise<ChordChartRecord | undefined> {
  return charts.get(id);
}

export async function listChordCharts(): Promise<ChordChartRecord[]> {
  return [...charts.values()].sort((a, b) => a.savedAt - b.savedAt);
}

export async function deleteChordChart(id: string): Promise<void> {
  charts.delete(id);
}
