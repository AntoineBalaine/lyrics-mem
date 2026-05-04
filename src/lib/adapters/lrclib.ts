import type { LyricsAdapter, FetchedLyrics } from './types';

const BASE = 'https://lrclib.net/api';

interface LrclibGetResponse {
  artistName: string;
  trackName: string;
  plainLyrics?: string | null;
  syncedLyrics?: string | null;
}

export const lrclibAdapter: LyricsAdapter = {
  name: 'lrclib',
  async fetch(query) {
    if ('url' in query) {
      throw new Error('lrclib does not support URL lookups; pass artist + title');
    }
    const params = new URLSearchParams({
      artist_name: query.artist,
      track_name: query.title,
    });
    const res = await fetch(`${BASE}/get?${params.toString()}`, {
      headers: { 'User-Agent': 'lyrics-mem (https://github.com/abalaine)' },
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`lrclib HTTP ${res.status}`);
    const data = (await res.json()) as LrclibGetResponse;
    if (!data.plainLyrics) return null;
    const result: FetchedLyrics = {
      artist: data.artistName,
      title: data.trackName,
      body: data.plainLyrics,
      source: 'lrclib',
    };
    return result;
  },
};
