import { describe, it, expect } from 'vitest';
import { parseSongFilename, songSlug } from './song-key';

describe('parseSongFilename', () => {
  it('parses artist and title separated by " - "', () => {
    expect(parseSongFilename('Radiohead - Karma Police.txt')).toEqual({
      artist: 'Radiohead',
      title: 'Karma Police',
    });
  });

  it('preserves dashes inside the title', () => {
    expect(parseSongFilename('Foo - Bar - Baz.txt')).toEqual({
      artist: 'Foo',
      title: 'Bar - Baz',
    });
  });

  it('throws when separator is missing', () => {
    expect(() => parseSongFilename('lonely.txt')).toThrow();
  });
});

describe('songSlug', () => {
  it('lowercases and dasherizes', () => {
    expect(songSlug('Radiohead', 'Karma Police')).toBe('radiohead-karma-police');
  });

  it('strips diacritics', () => {
    expect(songSlug('Édith Piaf', 'Non, je ne regrette rien')).toBe(
      'edith-piaf-non-je-ne-regrette-rien',
    );
  });
});
