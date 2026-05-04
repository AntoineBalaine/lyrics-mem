export interface FetchedLyrics {
  artist: string;
  title: string;
  body: string;
  source: string;
}

export type LyricsQuery = { artist: string; title: string } | { url: string };

export interface LyricsAdapter {
  readonly name: string;
  fetch(query: LyricsQuery): Promise<FetchedLyrics | null>;
}
