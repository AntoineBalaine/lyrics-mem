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
export const chordChartRecordSchema = z.object({
  id: z.string(),
  title: z.string(),
  composer: z.string(),
  // Only the converted ABC output is stored, never the raw iRealPro URL
  // (explicit project decision) — the URL is consumed once at import time.
  abc: z.string(),
  // The intermediate ABCx (chord-only) text abc was converted from, kept
  // for debugging the conversion pipeline (shown on the chart page below
  // the rendered score). Optional so records saved before this field
  // existed still validate.
  abcx: z.string().optional(),
  savedAt: z.number(),
  source: z.literal('irealpro'),
});

export type ChordChartRecord = z.infer<typeof chordChartRecordSchema>;

const charts = new Map<string, ChordChartRecord>();

export interface AddChordChartInput {
  title: string;
  composer: string;
  abc: string;
  abcx?: string;
}

export async function addChordChart(input: AddChordChartInput): Promise<ChordChartRecord> {
  const record: ChordChartRecord = {
    id: chordSlug(input.title, input.composer),
    title: input.title.trim(),
    composer: input.composer.trim(),
    abc: input.abc,
    abcx: input.abcx,
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
