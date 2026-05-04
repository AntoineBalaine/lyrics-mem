import type { LyricsAdapter, FetchedLyrics } from './types';

const APP_ID = 'web-desktop-app-v1.0';
const BASE = 'https://apic-desktop.musixmatch.com/ws/1.1';
const COOKIE = 'AWSELB=0; AWSELBCORS=0';

interface MmHeader {
  status_code: number;
  hint?: string;
}

interface TokenGetResponse {
  message: { header: MmHeader; body: { user_token: string } };
}

interface MacroSubtitlesGetResponse {
  message: {
    header: MmHeader;
    body: {
      macro_calls: {
        'matcher.track.get'?: {
          message: { body: { track?: { artist_name?: string; track_name?: string } } };
        };
        'track.lyrics.get'?: {
          message: { body: { lyrics?: { lyrics_body?: string } } };
        };
        'track.subtitles.get'?: {
          message: {
            body: {
              subtitle_list?: Array<{ subtitle?: { subtitle_body?: string } }>;
            };
          };
        };
      };
    };
  };
}

let cachedToken: string | null = null;

async function fetchToken(): Promise<string> {
  if (cachedToken) return cachedToken;
  const res = await fetch(`${BASE}/token.get?app_id=${APP_ID}`, {
    headers: { Cookie: COOKIE },
  });
  if (!res.ok) throw new Error(`musixmatch token.get HTTP ${res.status}`);
  const data = (await res.json()) as TokenGetResponse;
  const status = data.message?.header?.status_code;
  if (status !== 200) {
    throw new Error(
      `musixmatch token.get status ${status}${data.message?.header?.hint ? ` (${data.message.header.hint})` : ''}`,
    );
  }
  cachedToken = data.message.body.user_token;
  return cachedToken;
}

function stripLrcTimestamps(lrc: string): string {
  return lrc
    .split('\n')
    .map((line) => line.replace(/^\[\d+:\d+(?:\.\d+)?\]\s*/, ''))
    .filter((line) => line.trim().length > 0)
    .join('\n');
}

export const musixmatchAdapter: LyricsAdapter = {
  name: 'musixmatch',
  async fetch(query) {
    if ('url' in query) {
      throw new Error('musixmatch does not support URL lookups; pass artist + title');
    }
    const token = await fetchToken();
    const params = new URLSearchParams({
      format: 'json',
      namespace: 'lyrics_richsynched',
      subtitle_format: 'lrc',
      app_id: APP_ID,
      usertoken: token,
      q_artist: query.artist,
      q_track: query.title,
    });
    const res = await fetch(`${BASE}/macro.subtitles.get?${params.toString()}`, {
      headers: { Cookie: COOKIE },
    });
    if (!res.ok) throw new Error(`musixmatch HTTP ${res.status}`);
    const data = (await res.json()) as MacroSubtitlesGetResponse;
    const status = data.message?.header?.status_code;
    if (status === 404) return null;
    if (status !== 200) {
      throw new Error(
        `musixmatch macro.subtitles.get status ${status}${data.message?.header?.hint ? ` (${data.message.header.hint})` : ''}`,
      );
    }

    const macro = data.message.body.macro_calls;
    const subtitle = macro['track.subtitles.get']?.message?.body?.subtitle_list?.[0]?.subtitle;
    const lyricsBody = macro['track.lyrics.get']?.message?.body?.lyrics?.lyrics_body;
    const trackInfo = macro['matcher.track.get']?.message?.body?.track;

    let body: string | null = null;
    if (subtitle?.subtitle_body) {
      body = stripLrcTimestamps(subtitle.subtitle_body);
    } else if (lyricsBody) {
      body = lyricsBody.replace(/\*+ This Lyrics is NOT for Commercial use \*+/g, '').trim();
    }
    if (!body) return null;

    const result: FetchedLyrics = {
      artist: trackInfo?.artist_name ?? query.artist,
      title: trackInfo?.track_name ?? query.title,
      body,
      source: 'musixmatch',
    };
    return result;
  },
};
