import { describe, expect, it } from 'vitest';
import { ABCContext, layoutChart, parseGrid, scanGrid } from 'abcls-parser';
import { flowChart, type FlowedLayout } from './chart-flow';

/**
 * Tests for how a chart's bars are broken into lines.
 *
 * Every fixture is raw iReal Pro grid text. A chart whose bars are mostly
 * written two cells wide, as `C |`, comes eight to a line, and any other
 * chart, with bars written as `C   |`, comes four to a line.
 */
function flowed(grid: string): FlowedLayout {
  const ctx = new ABCContext();
  return flowChart(layoutChart(parseGrid(scanGrid(grid, ctx), ctx)));
}

function bars(count: number, cells = 2): string {
  return Array.from({ length: count }, () => `C${' '.repeat(cells - 1)}|`).join('');
}

function shape(layout: FlowedLayout): string[] {
  return layout.lines.map((line) => `${line.offset}+${line.bars.length}`);
}

describe('flowChart', () => {
  it('draws sections of 32, 16 and 32 bars eight to a line', () => {
    const layout = flowed(`[*A${bars(32)}[*B${bars(16)}[*C${bars(32)}`);
    expect(layout.barsPerLine).to.equal(8);
    expect(layout.lines.length).to.equal(4 + 2 + 4);
  });

  it('draws All of Me four to a line, the way iReal Pro does', () => {
    // The home page's demo chart, whose bars are written four cells wide.
    const layout = flowed(
      '[*AT44C   | x  |E7   | x  |A7   | x  |D-   | x  ][*BE7   | x  |A-   | x  |D7   | x  |D-7   |G7   ]' +
        '[*AC   | x  |E7   | x  |A7   | x  |D-   | x  ][*CF   |F-   |C^7   |A7   |Dh7   |G7   |C   |D-7 G7 Z ',
    );
    expect(layout.barsPerLine).to.equal(4);
    expect(layout.lines.length).to.equal(8);
  });

  it('draws a twelve bar blues of four cell bars four to a line', () => {
    const layout = flowed(`[*A${bars(12, 4)}`);
    expect(layout.barsPerLine).to.equal(4);
    expect(shape(layout)).to.deep.equal(['0+4', '0+4', '0+4']);
  });

  it('does not let a short coda change the line length', () => {
    // Four bars can never fill an eight bar line, so they say nothing
    // about how long a line is.
    const layout = flowed(`[*A${bars(32)}[*B${bars(4)}`);
    expect(layout.barsPerLine).to.equal(8);
    expect(shape(layout)).to.deep.equal(['0+8', '0+8', '0+8', '0+8', '0+4']);
  });

  it('starts every section on a line of its own', () => {
    const layout = flowed(`[*A${bars(10)}[*B${bars(8)}`);
    expect(layout.lines.map((line) => line.sectionLabel)).to.deep.equal(['A', undefined, 'B']);
  });

  it('puts the first ending after the bars before it, and the second under it', () => {
    // Fourteen plain bars, then a two bar first ending and a two bar second
    // ending. The first ending takes the last two slots of the second line,
    // so the second ending starts six slots in on the line after.
    const layout = flowed(`[*A{${bars(14)}N1C |C }N2C |C |`);
    expect(layout.barsPerLine).to.equal(8);
    expect(shape(layout)).to.deep.equal(['0+8', '0+8', '6+2']);
  });

  it('keeps every line of a chart the same length when a few bars are written narrower', () => {
    // Twelve bars of four cells and two of two: most bars are wide, so the
    // chart is four to a line, and the narrow ones do not widen it.
    const layout = flowed(`[*A${bars(6, 4)}${bars(2)}${bars(6, 4)}`);
    expect(layout.barsPerLine).to.equal(4);
    expect(shape(layout)).to.deep.equal(['0+4', '0+4', '0+4', '0+2']);
  });

  it('draws 9.20 Special four to a line, with its second ending under the first', () => {
    // Its bars are written with a comma after the chord, `D9,   |`.
    const layout = flowed(
      '{*AT44D9,   |F-6,   |D9,   |F-6   |C,   |sC7,B7,Bb7,A7|N1lD9,   |G7, sAb7,G7}        |N2lD9,   |G7, C6 ]' +
        '[*BC7,   | x  |F6,   | x  |D7,   | x  |G7,   | x  ]',
    );
    expect(layout.barsPerLine).to.equal(4);
    expect(shape(layout)).to.deep.equal(['0+4', '0+4', '2+2', '0+4', '0+4']);
  });

  it('keeps the repeat signs at the ends of a repeat that the parser split across two lines', () => {
    // The parser breaks after four bars, so the bar that begins its second
    // line carries only the opening half of the barline before it. At eight
    // to a line both halves meet on one row, and the repeat signs must
    // still stand at the two ends and nowhere in between.
    const layout = flowed('[*A{C |C |C |C |C |C |C |C }');
    expect(layout.barsPerLine).to.equal(8);
    expect(layout.lines.length).to.equal(1);
    expect(layout.lines[0].bars.map((bar) => bar.openBarline)).to.deep.equal([
      'openRepeat',
      ...Array.from({ length: 7 }, () => 'plain'),
    ]);
    expect(layout.lines[0].closeBarline).to.equal('closeRepeat');
  });

  it('carries on along the same line when the meter changes', () => {
    // The parser starts a section at each change of meter, which would put
    // every change on a line of its own. iReal Pro writes the new meter
    // above the bar it begins at and keeps going.
    const layout = flowed('[*AT34C |C |C |T24C |C |C |C |C ');
    expect(layout.lines.length).to.equal(1);
    expect(layout.lines[0].bars.length).to.equal(8);
    expect(layout.lines[0].meterChanges.map((change) => change.position)).to.deep.equal([3]);
    expect(layout.lines[0].meterChanges[0].timeSignature.numerator).to.equal(2);
  });

  it('keeps a coda on lines of its own, and out of the line length', () => {
    // A coda is a section without a label, but it is a place to jump to,
    // so it is not folded into the section before it the way a change of
    // meter is, and its bars start a line of their own.
    const layout = flowed(`[*A${bars(32)}][Q${bars(4)}`);
    expect(layout.barsPerLine).to.equal(8);
    expect(shape(layout)).to.deep.equal(['0+8', '0+8', '0+8', '0+8', '0+4']);
  });
});
