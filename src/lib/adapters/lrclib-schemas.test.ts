import { describe, it, expect } from 'vitest';
import {
  lrclibTrackSchema,
  lrclibSearchResponseSchema,
} from './lrclib-schemas';

describe('lrclibTrackSchema', () => {
  it('accepts a complete response', () => {
    const sample = {
      id: 12345,
      artistName: 'Radiohead',
      trackName: 'Karma Police',
      albumName: 'OK Computer',
      duration: 261,
      instrumental: false,
      plainLyrics: "Karma police\nArrest this man\n...",
      syncedLyrics: '[00:00.00] Karma police\n[00:02.50] Arrest this man',
    };
    const parsed = lrclibTrackSchema.parse(sample);
    expect(parsed.artistName).toBe('Radiohead');
    expect(parsed.plainLyrics).toContain('Karma police');
  });

  it('accepts null for nullable optional fields', () => {
    const sample = {
      artistName: 'X',
      trackName: 'Y',
      albumName: null,
      duration: null,
      plainLyrics: null,
      syncedLyrics: null,
    };
    expect(() => lrclibTrackSchema.parse(sample)).not.toThrow();
  });

  it('accepts minimal response (only required fields)', () => {
    expect(() =>
      lrclibTrackSchema.parse({ artistName: 'X', trackName: 'Y' }),
    ).not.toThrow();
  });

  it('ignores unexpected extra fields', () => {
    const sample = {
      artistName: 'X',
      trackName: 'Y',
      somethingNew: 'whatever',
    };
    expect(() => lrclibTrackSchema.parse(sample)).not.toThrow();
  });

  it('rejects when required field is missing', () => {
    expect(() => lrclibTrackSchema.parse({ trackName: 'Y' })).toThrow();
  });

  it('rejects when types are wrong', () => {
    expect(() =>
      lrclibTrackSchema.parse({ artistName: 'X', trackName: 'Y', duration: 'long' }),
    ).toThrow();
  });
});

describe('lrclibSearchResponseSchema', () => {
  it('accepts an array of tracks', () => {
    const sample = [
      { artistName: 'A', trackName: '1' },
      { artistName: 'B', trackName: '2', plainLyrics: 'x' },
    ];
    const parsed = lrclibSearchResponseSchema.parse(sample);
    expect(parsed).toHaveLength(2);
  });

  it('accepts an empty array', () => {
    expect(lrclibSearchResponseSchema.parse([])).toEqual([]);
  });

  it('rejects a non-array', () => {
    expect(() => lrclibSearchResponseSchema.parse({ artistName: 'X' })).toThrow();
  });
});
