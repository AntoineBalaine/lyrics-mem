import { describe, expect, it } from 'vitest';
import { buildPlaylistLink, type IrealSongFields } from 'abcls-parser';
import { importAllFromIrealLink, importIrealLink, prepareChart } from './ireal-import';

/**
 * Tests for reading a link into a chart, and for the metadata line the
 * chart view shows.
 *
 * The metadata cases are ported from the retired chart-meta spec, which
 * tested the same rules against ABC header lines. They now read the song's
 * own fields, which is where the values were all along; recovering them
 * from a header we had written ourselves was a round trip through a lossy
 * format for no reason.
 */
function link(fields: Partial<IrealSongFields>): string {
  return buildPlaylistLink({
    songs: [
      {
        title: 'Test',
        composer: 'Composer',
        style: '',
        key: 'C',
        transpose: '0',
        // A minimal grid: one bar, scrambling is applied by the builder's
        // caller rather than here, so the raw field is given as iReal
        // writes it, marker and all.
        rawChordData: '1r34LbKcu7C^7 |',
        ...fields,
      },
    ],
  });
}

describe('prepareChart metadata', () => {
  it('reads key, tempo, style and groove from the song fields', () => {
    const { metadata } = prepareChart(
      link({ key: 'C', bpm: '140', style: 'Bossa Nova', groove: 'Jazz-Bossa Nova' }),
    );
    expect(metadata).toEqual({
      key: 'C',
      bpm: '140',
      style: 'Bossa Nova',
      groove: 'Jazz-Bossa Nova',
    });
  });

  it('omits groove when it is identical to style', () => {
    const { metadata } = prepareChart(link({ style: 'Swing', groove: 'Swing' }));
    expect(metadata.groove).toBeUndefined();
  });

  it('defaults key to C and omits missing fields', () => {
    const { metadata } = prepareChart(link({ key: '' }));
    expect(metadata).toEqual({ key: 'C' });
  });

  it('keeps a minor key as iReal Pro spells it, with the trailing hyphen', () => {
    expect(prepareChart(link({ key: 'C-' })).metadata.key).toBe('C-');
  });

  it('omits a tempo of zero, which iReal Pro writes for no tempo', () => {
    expect(prepareChart(link({ bpm: '0' })).metadata.bpm).toBeUndefined();
  });

  it('reads the key into a signature the degree arithmetic can use', () => {
    const { key } = prepareChart(link({ key: 'Eb-' }));
    expect(key.root).toBe('E');
    expect(key.acc).toBe('b');
    expect(key.mode).toBe('m');
  });
});

describe('importIrealLink', () => {
  it('refuses anything that is not an iRealPro link', () => {
    expect(() => importIrealLink('https://example.com')).toThrow(/iRealPro link/);
    expect(() => importIrealLink('   ')).toThrow(/Paste an iRealPro link/);
  });

  it('names a song with no title or composer rather than leaving them blank', () => {
    const chart = importIrealLink(link({ title: '', composer: '' }));
    expect(chart.title).toBe('Untitled');
    expect(chart.composer).toBe('Unknown');
  });

  it('gives each chart a link of its own rather than the playlist it came from', () => {
    // A playlist link bundles many songs, so a chart that stored the
    // playlist link would carry several hundred other charts with it.
    const playlist = buildPlaylistLink({
      songs: [
        { title: 'A', composer: 'x', style: '', key: 'C', transpose: '0', rawChordData: '1r34LbKcu7C^7 |' },
        { title: 'B', composer: 'y', style: '', key: 'F', transpose: '0', rawChordData: '1r34LbKcu7F^7 |' },
      ],
    });
    const { charts } = importAllFromIrealLink(playlist);
    expect(charts.map((c) => c.title)).toEqual(['A', 'B']);
    for (const chart of charts) {
      expect(prepareChart(chart.link)).toBeTruthy();
    }
  });
});
