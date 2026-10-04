/**
 * Reads a pasted iReal Pro chord-chart URL into the per-song link a chart
 * is stored as, and turns that link into a laid-out chart when one is
 * displayed.
 *
 * Nothing is converted at import time any more. The link is the chart's
 * source of truth, so a chart stores a link and is scanned, parsed and laid
 * out on display instead. That way a fix to the parser improves every chart
 * already in the library rather than only newly imported ones, and there is
 * no intermediate format to keep correct: scanning and parsing one chart
 * costs well under a millisecond against a view that only redraws on a user
 * action.
 *
 * All of the work is client side, as the rest of this app is.
 */
import {
  ABCContext,
  buildPlaylistLink,
  layoutChart,
  parseGrid,
  parseIrealKey,
  parsePlaylistLink,
  scanGrid,
  stripChordDataMarker,
  unscramble,
  type ChartLayout,
  type IrealSongFields,
} from 'abcls-parser';
import type { KeySignature } from 'abcls-parser/types/abcjs-ast';

export interface ImportedChart {
  title: string;
  composer: string;
  /** A link naming this one song, rebuilt from the fields read out of it. */
  link: string;
}

/** The metadata iReal Pro carries beside the grid, for the chart view's header. */
export interface ChartMetadata {
  key: string;
  bpm?: string;
  style?: string;
  groove?: string;
}

export interface PreparedChart {
  layout: ChartLayout;
  key: KeySignature;
  metadata: ChartMetadata;
}

function validateIrealLink(link: string): string {
  const trimmed = link.trim();
  if (!trimmed) throw new Error('Paste an iRealPro link first.');
  if (!trimmed.startsWith('irealb://')) {
    throw new Error(
      'That doesn\'t look like an iRealPro link (expected it to start with "irealb://").',
    );
  }
  return trimmed;
}

function toImportedChart(fields: IrealSongFields): ImportedChart {
  return {
    title: fields.title || 'Untitled',
    composer: fields.composer || 'Unknown',
    // A playlist link bundles many songs, so each chart carries a link of
    // its own rather than a reference into a shared one.
    link: buildPlaylistLink({ songs: [fields] }),
  };
}

/**
 * Scans, parses and lays out a stored chart's grid, ready to render.
 *
 * Errors the scanner or the parser reports are deliberately not thrown.
 * Real charts in a real library carry shapes that are worth reporting and
 * still worth drawing, an unclosed repeat among them, and refusing to show
 * a chart because one bar of it is odd would make the library less useful
 * than showing it with that bar as the chart wrote it.
 */
export function prepareChart(link: string): PreparedChart {
  const songs = parsePlaylistLink(link).songs;
  if (songs.length === 0) throw new Error('This chart\'s stored link names no song.');
  const fields = songs[0];
  const ctx = new ABCContext();
  const grid = unscramble(stripChordDataMarker(fields.rawChordData));
  const chart = parseGrid(scanGrid(grid, ctx), ctx);
  return {
    layout: layoutChart(chart),
    key: parseIrealKey(fields.key),
    metadata: {
      key: fields.key || 'C',
      bpm: fields.bpm && fields.bpm !== '0' ? fields.bpm : undefined,
      style: fields.style || undefined,
      groove: fields.groove && fields.groove !== fields.style ? fields.groove : undefined,
    },
  };
}

/**
 * Takes a single `irealb://...` playlist link and returns the first song it
 * contains, for the single-link paste box, where a playlist link is treated
 * as a request to import its first song.
 */
export function importIrealLink(link: string): ImportedChart {
  const playlist = parsePlaylistLink(validateIrealLink(link));
  if (playlist.songs.length === 0) {
    throw new Error('No songs found in that iRealPro link.');
  }
  return toImportedChart(playlist.songs[0]);
}

export interface ImportAllResult {
  charts: ImportedChart[];
  // One message per song that could not be read, so one malformed song in a
  // large playlist link does not block importing the rest of it.
  errors: string[];
}

/**
 * Takes a single `irealb://...` playlist link and returns every song it
 * contains, for bulk library-backup import, where one link bundles many
 * songs.
 */
export function importAllFromIrealLink(link: string): ImportAllResult {
  const trimmed = validateIrealLink(link);
  const charts: ImportedChart[] = [];
  const errors: string[] = [];
  let songs: IrealSongFields[];
  try {
    songs = parsePlaylistLink(trimmed).songs;
  } catch (err) {
    return { charts: [], errors: [err instanceof Error ? err.message : String(err)] };
  }
  for (const song of songs) {
    try {
      charts.push(toImportedChart(song));
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }
  return { charts, errors };
}
