import { describe, expect, it } from 'vitest';
import { parseChartMeta } from './chart-meta';

const FULL_HEADER = [
  'X:1',
  'T:Black Orpheus',
  'C:Bonfa Louis',
  '%%irealstyle Bossa Nova',
  '%%irealgroove Jazz-Bossa Nova',
  'Q:1/4=140',
  '%%irealrepeats 2',
  'K:C',
  'Am | Bø7 |',
].join('\n');

describe('parseChartMeta', () => {
  it('extracts key, tempo, style, and groove', () => {
    expect(parseChartMeta(FULL_HEADER)).toEqual({
      key: 'C',
      bpm: '140',
      style: 'Bossa Nova',
      groove: 'Jazz-Bossa Nova',
    });
  });

  it('omits groove when it is identical to style', () => {
    const source = 'K:Cm\n%%irealstyle Swing\n%%irealgroove Swing\n';
    expect(parseChartMeta(source).groove).toBeUndefined();
  });

  it('defaults key to C and omits missing fields', () => {
    expect(parseChartMeta('X:1\nT:No metadata\n')).toEqual({ key: 'C' });
  });

  it('parses a minor key literally, without translating it', () => {
    expect(parseChartMeta('K:Cm\n').key).toBe('Cm');
  });
});
