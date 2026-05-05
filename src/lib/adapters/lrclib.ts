import type { LyricsAdapter, FetchedLyrics } from './types';
import {
  lrclibTrackSchema,
  lrclibSearchResponseSchema,
  type LrclibTrack,
} from './lrclib-schemas';

const BASE = 'https://lrclib.net/api';

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`lrclib HTTP ${res.status}`);
  return res.json();
}

function trackToFetched(track: LrclibTrack): FetchedLyrics | null {
  if (!track.plainLyrics) return null;
  return {
    artist: track.artistName,
    title: track.trackName,
    body: track.plainLyrics,
    source: 'lrclib',
  };
}

/** Fuzzy search by free-form query. Returns up to N matching tracks. */
export async function searchLrclib(query: string): Promise<LrclibTrack[]> {
  const url = `${BASE}/search?${new URLSearchParams({ q: query }).toString()}`;
  const raw = await getJson(url);
  if (raw === null) return [];
  return lrclibSearchResponseSchema.parse(raw);
}

/** Exact lookup by artist + title. */
export async function getLrclib(artist: string, title: string): Promise<LrclibTrack | null> {
  const url = `${BASE}/get?${new URLSearchParams({
    artist_name: artist,
    track_name: title,
  }).toString()}`;
  const raw = await getJson(url);
  if (raw === null) return null;
  return lrclibTrackSchema.parse(raw);
}

export const lrclibAdapter: LyricsAdapter = {
  name: 'lrclib',
  async fetch(query) {
    if ('url' in query) {
      throw new Error('lrclib does not support URL lookups; pass artist + title');
    }
    const track = await getLrclib(query.artist, query.title);
    if (!track) return null;
    return trackToFetched(track);
  },
};
