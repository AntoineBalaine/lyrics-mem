import { describe, expect, it } from 'vitest';
import { extractChordChartBody } from './chord-chart-text';

const AUTUMN_LEAVES_ABC = [
  'X:1',
  '% iReal Pro source: irealb://Autumn Leaves=Kosma== =Cm=0=...',
  'T:Autumn Leaves',
  'C:Kosma',
  '%%irealrepeats 1',
  'K:Cm',
  '"Cm7"x4 "F7"x4 | "Bbmaj7"x4 "Ebmaj7"x4 |',
  '"Am7b5"x4 "D7"x4 | "Gm7"x4 "Gm7"x4 |',
].join('\n');

describe('extractChordChartBody', () => {
  it('drops header fields and comment lines, and unwraps chords to plain text', () => {
    const result = extractChordChartBody(AUTUMN_LEAVES_ABC);
    expect(result).toBe('Cm7 F7 | Bbmaj7 Ebmaj7 |\nAm7b5 D7 | Gm7 Gm7 |');
  });

  it('returns an empty string for a header-only chart', () => {
    expect(extractChordChartBody('X:1\nT:Empty\nK:C\n')).toBe('');
  });

  it('unwraps blanked (cloze-hidden) chords the same way', () => {
    const abc = 'K:C\n"----"x4 "--"x4 |';
    expect(extractChordChartBody(abc)).toBe('---- -- |');
  });
});
